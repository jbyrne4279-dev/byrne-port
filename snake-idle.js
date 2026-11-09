/* AFK Snake screensaver — extracted from script.js */
'use strict';
(function initScreensaver() {
  const saver = document.getElementById('screensaver');
  const canvas = document.getElementById('screensaverCanvas');
  if (!saver || !canvas) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IDLE_MS = 30000;
  const STEP_MS = 70;                 // one move every 70ms (slower with slow-mo)
  const ctx = canvas.getContext('2d');
  const backBtn = document.getElementById('screensaverBack');
  const scoreEl = document.getElementById('screensaverScore');

  const POWERS = {
    shield: { color: '#4da3ff', glow: 'rgba(77,163,255,.9)',  label: 'Shield',   ms: 10000 },
    slow:   { color: '#3ee6e0', glow: 'rgba(62,230,224,.9)',  label: 'Slow-mo',  ms: 6000 },
    double: { color: '#ffc93c', glow: 'rgba(255,201,60,.9)',  label: '2× points', ms: 8000 },
    shrink: { color: '#b57bff', glow: 'rgba(181,123,255,.9)', label: 'Shrink',   ms: 0 }
  };
  const POWER_TYPES = Object.keys(POWERS);

  let dpr = 1, cell = 28, cols = 0, rows = 0, ox = 0, oy = 0;
  let snake = [], dir = [1, 0], apple = null, grow = 0, lastStep = 0, now = 0;
  let bombs = [], power = null, effects = { shield: 0, slow: 0, double: 0 };
  let particles = [], floaters = [], rings = [], pulseAt = -1e9, shakeUntil = 0, deadUntil = 0;
  let raf = null, active = false, timer = null;
  let manual = false, queued = null, score = 0, best = 0;

  const key = (x, y) => y * cols + x;
  const cx = x => ox + x * cell + cell / 2;
  const cy = y => oy + y * cell + cell / 2;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    cell = Math.round((window.innerWidth < 600 ? 22 : 28) * dpr);
    cols = Math.max(8, Math.floor(canvas.width / cell));
    rows = Math.max(8, Math.floor(canvas.height / cell));
    ox = (canvas.width - cols * cell) / 2; oy = (canvas.height - rows * cell) / 2;
    reset();
  }

  function reset() {
    const y = Math.floor(rows / 2), x = Math.floor(cols / 4);
    snake = [[x, y], [x - 1, y], [x - 2, y], [x - 3, y]];
    dir = [1, 0]; grow = 0;
    manual = false; queued = null; score = 0;
    bombs = []; power = null; effects = { shield: 0, slow: 0, double: 0 };
    apple = freeCell();
    showScore();
  }

  function occupied() {
    const s = new Set(snake.map(([x, y]) => key(x, y)));
    bombs.forEach(b => s.add(key(b.x, b.y)));
    if (apple) s.add(key(apple[0], apple[1]));
    if (power) s.add(key(power.x, power.y));
    return s;
  }
  // A random empty cell, kept a few squares clear of the snake's head
  function freeCell() {
    const taken = occupied(), h = snake[0];
    for (let tries = 0; tries < 400; tries++) {
      const x = (Math.random() * cols) | 0, y = (Math.random() * rows) | 0;
      if (taken.has(key(x, y))) continue;
      if (h && Math.abs(x - h[0]) + Math.abs(y - h[1]) < 4) continue;
      return [x, y];
    }
    return null;
  }

  function showScore() {
    if (!scoreEl) return;
    const on = Object.keys(effects).filter(k => effects[k] > now).map(k => POWERS[k].label);
    scoreEl.textContent = (manual || best)
      ? `Score ${score}${best ? ` · Best ${best}` : ''}${on.length ? ` · ${on.join(' · ')}` : ''}`
      : '';
  }

  /* ── Autopilot: shortest safe path to the apple, else chase its tail ── */
  function bfs(from, to, blocked) {
    const prev = new Int32Array(cols * rows).fill(-1);
    const seen = new Uint8Array(cols * rows);
    const q = [key(from[0], from[1])];
    seen[q[0]] = 1;
    const goal = key(to[0], to[1]);
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (k === goal) break;
      const x = k % cols, y = (k / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nk = key(nx, ny);
        if (seen[nk] || (blocked.has(nk) && nk !== goal)) continue;
        seen[nk] = 1; prev[nk] = k; q.push(nk);
      }
    }
    if (!seen[goal]) return null;
    let k = goal, first = goal;
    while (prev[k] !== -1) { first = k; k = prev[k]; }
    return [first % cols - from[0], ((first / cols) | 0) - from[1]];
  }
  function chooseDir() {
    const head = snake[0];
    const blocked = new Set(snake.slice(0, -1).map(([x, y]) => key(x, y)));
    bombs.forEach(b => blocked.add(key(b.x, b.y)));
    return bfs(head, apple, blocked) || bfs(head, snake[snake.length - 1], blocked) ||
      [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => {
        const nx = head[0] + dx, ny = head[1] + dy;
        return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !blocked.has(key(nx, ny));
      }) || null;
  }

  /* ── Effects ── */
  function burst(x, y, colors, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * speed * dpr;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, life: 500 + Math.random() * 500,
        color: colors[(Math.random() * colors.length) | 0], size: (2 + Math.random() * 3) * dpr });
    }
  }
  function floatText(x, y, text, color) { floaters.push({ x, y, text, color, born: now }); }

  function explode(x, y) {
    burst(x, y, ['#ff3b1f', '#ff8a1f', '#ffd27a', '#ffffff'], 70, 0.55);
    rings.push({ x, y, born: now, color: 'rgba(255,120,40,', max: cell * 4 });
    shakeUntil = now + 450;
  }

  function die(x, y) {
    explode(x, y);
    floatText(canvas.width / 2, canvas.height * 0.28, `Game over · ${score}`, '#ff3b5c');
    best = Math.max(best, score);
    deadUntil = now + 900;            // freeze briefly on the explosion, then restart
  }

  /* ── One move ── */
  function step() {
    // Bombs come and go; more of them the higher your score
    bombs = bombs.filter(b => {
      if (now - b.born < b.life) return true;
      burst(cx(b.x), cy(b.y), ['#555', '#999'], 10, 0.2);
      return false;
    });
    const want = manual ? Math.min(9, 2 + Math.floor(score / 2)) : 3;
    while (bombs.length < want) {
      const c = freeCell(); if (!c) break;
      bombs.push({ x: c[0], y: c[1], born: now, life: 9000 + Math.random() * 9000 });
    }
    if (power && now - power.born > 9000) power = null;
    if (!power && Math.random() < 0.007) {
      const c = freeCell();
      if (c) power = { x: c[0], y: c[1], type: POWER_TYPES[(Math.random() * POWER_TYPES.length) | 0], born: now };
    }

    let nx, ny;
    if (manual) {
      if (queued) { dir = queued; queued = null; }
      nx = snake[0][0] + dir[0]; ny = snake[0][1] + dir[1];
      const shielded = effects.shield > now;
      const offBoard = nx < 0 || ny < 0 || nx >= cols || ny >= rows;
      if (offBoard) {
        if (!shielded) { die(cx(snake[0][0]), cy(snake[0][1])); return; }
        nx = (nx + cols) % cols; ny = (ny + rows) % rows;     // shield wraps you through the wall
        effects.shield = 0; floatText(cx(nx), cy(ny), 'Shield used', POWERS.shield.color);
      }
      const hitSelf = snake.slice(0, -1).some(([x, y]) => x === nx && y === ny);
      if (hitSelf) {
        if (effects.shield <= now) { die(cx(nx), cy(ny)); return; }
        effects.shield = 0; floatText(cx(nx), cy(ny), 'Shield used', POWERS.shield.color);
      }
    } else {
      const d = chooseDir();
      if (!d) { reset(); return; }
      dir = d; nx = snake[0][0] + dir[0]; ny = snake[0][1] + dir[1];
    }

    const bi = bombs.findIndex(b => b.x === nx && b.y === ny);
    if (bi >= 0) {
      const b = bombs.splice(bi, 1)[0];
      if (!manual || effects.shield <= now) { die(cx(b.x), cy(b.y)); return; }
      explode(cx(b.x), cy(b.y)); effects.shield = 0;
      floatText(cx(b.x), cy(b.y), 'Shield used', POWERS.shield.color);
    }

    snake.unshift([nx, ny]);

    if (apple && nx === apple[0] && ny === apple[1]) {
      const pts = effects.double > now ? 2 : 1;
      grow += 3;
      if (manual) score += pts;
      burst(cx(nx), cy(ny), ['#2ee082', '#9dffc9', '#ff3b5c', '#ffffff'], 26, 0.32);
      rings.push({ x: cx(nx), y: cy(ny), born: now, color: 'rgba(46,224,130,', max: cell * 2.2 });
      floatText(cx(nx), cy(ny) - cell * 0.4, `+${pts}`, pts > 1 ? POWERS.double.color : '#2ee082');
      pulseAt = now;
      apple = freeCell();
      showScore();
    }

    if (power && nx === power.x && ny === power.y) {
      const p = POWERS[power.type];
      burst(cx(nx), cy(ny), [p.color, '#ffffff'], 22, 0.3);
      rings.push({ x: cx(nx), y: cy(ny), born: now, color: p.glow.replace(/[\d.]+\)$/, ''), max: cell * 2.6 });
      floatText(cx(nx), cy(ny) - cell * 0.4, p.label, p.color);
      if (power.type === 'shrink') {
        const cut = Math.floor(snake.length / 3);
        for (let i = 0; i < cut && snake.length > 4; i++) {
          const t = snake.pop(); burst(cx(t[0]), cy(t[1]), ['#b57bff', '#e0c8ff'], 3, 0.15);
        }
      } else effects[power.type] = now + p.ms;
      power = null;
      showScore();
    }

    if (grow > 0) grow--; else snake.pop();
    if (!manual && snake.length > cols * rows * 0.35) reset();
  }

  /* ── Drawing ── */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawBomb(b) {
    const x = cx(b.x), y = cy(b.y) + cell * 0.05, r = cell * 0.34;
    const left = b.life - (now - b.born);
    const blink = left < 2500 && Math.floor(now / 160) % 2 === 0;   // flashes before it relocates
    ctx.shadowColor = 'rgba(255, 60, 30, .7)'; ctx.shadowBlur = (blink ? 18 : 8) * dpr;
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, blink ? '#5a2a2a' : '#4a4a52'); g.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = Math.max(1, cell * 0.06);
    ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.75); ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.25, x + r * 1.1, y - r * 1.05); ctx.stroke();
    // flickering spark on the fuse
    const sx = x + r * 1.1, sy = y - r * 1.05, f = 0.6 + Math.random() * 0.6;
    ctx.shadowColor = 'rgba(255, 200, 80, 1)'; ctx.shadowBlur = 12 * dpr;
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.arc(sx, sy, cell * 0.08 * f, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPower(p) {
    const P = POWERS[p.type], x = cx(p.x), y = cy(p.y);
    const bob = Math.sin(now / 220) * cell * 0.06, r = cell * 0.34;
    const fading = now - p.born > 6500 && Math.floor(now / 140) % 2 === 0;
    ctx.globalAlpha = fading ? 0.35 : 1;
    ctx.shadowColor = P.glow; ctx.shadowBlur = 20 * dpr;
    ctx.fillStyle = P.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + bob + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0b10';
    ctx.font = `700 ${Math.round(cell * 0.36)}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ shield: 'S', slow: '◷', double: '×2', shrink: '−' }[p.type], x, y + bob + cell * 0.02);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 450 * 9 * dpr;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    // faint board grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(ox + x * cell + 0.5, oy); ctx.lineTo(ox + x * cell + 0.5, oy + rows * cell); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(ox, oy + y * cell + 0.5); ctx.lineTo(ox + cols * cell, oy + y * cell + 0.5); }
    ctx.stroke();

    bombs.forEach(drawBomb);
    if (power) drawPower(power);

    // green apple with a little leaf, gently breathing
    if (apple) {
      const ax = cx(apple[0]), ay = cy(apple[1]), br = 1 + Math.sin(now / 300) * 0.06;
      ctx.shadowColor = 'rgba(39, 208, 127, 0.9)'; ctx.shadowBlur = 18 * dpr;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(ax, ay + cell * 0.04, cell * 0.36 * br, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f7a3f';
      ctx.beginPath(); ctx.ellipse(ax + cell * 0.12, ay - cell * 0.34, cell * 0.13, cell * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    }

    // red snake, brightest at the head; a gulp ripples down it after eating
    const shielded = effects.shield > now, dead = now < deadUntil;
    const pad = Math.max(1, cell * 0.08), age = (now - pulseAt) / 45;
    ctx.shadowColor = shielded ? 'rgba(77,163,255,.9)' : 'rgba(255, 20, 60, 0.8)'; ctx.shadowBlur = 14 * dpr;
    snake.forEach(([x, y], i) => {
      const t = i / Math.max(1, snake.length - 1);
      const bulge = age < snake.length + 6 ? 0.28 * Math.exp(-((age - i) ** 2) / 3) : 0;
      const s = (cell - pad * 2) * (1 + bulge), off = (cell - s) / 2;
      ctx.fillStyle = dead ? `rgba(120,30,30,${1 - t * 0.6})`
        : i === 0 ? '#ff3b5c' : `rgb(${Math.round(224 - t * 90)}, ${Math.round(20 - t * 10)}, ${Math.round(60 - t * 25)})`;
      roundRect(ox + x * cell + off, oy + y * cell + off, s, s, cell * 0.28);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    if (shielded) {
      ctx.strokeStyle = 'rgba(77,163,255,.8)'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(cx(snake[0][0]), cy(snake[0][1]), cell * 0.62, 0, Math.PI * 2); ctx.stroke();
    }
    // eyes
    const [hx, hy] = snake[0];
    const ex = -dir[1], ey = dir[0];
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx(hx) + dir[0] * cell * 0.16 + ex * s * cell * 0.17, cy(hy) + dir[1] * cell * 0.16 + ey * s * cell * 0.17, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // expanding rings, sparks and floating labels
    rings = rings.filter(r => now - r.born < 500);
    rings.forEach(r => {
      const k = (now - r.born) / 500;
      ctx.strokeStyle = r.color + (1 - k) + ')'; ctx.lineWidth = 3 * dpr * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, cell * 0.4 + r.max * k, 0, Math.PI * 2); ctx.stroke();
    });
    particles = particles.filter(p => now - p.born < p.life);
    particles.forEach(p => {
      const k = (now - p.born) / p.life, d = (now - p.born) / 16;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x + p.vx * d * 6, p.y + p.vy * d * 6 + k * k * cell * 0.8, p.size * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    floaters = floaters.filter(f => now - f.born < 1100);
    floaters.forEach(f => {
      const k = (now - f.born) / 1100;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = f.color;
      ctx.font = `700 ${Math.round(cell * 0.6)}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = f.color; ctx.shadowBlur = 10 * dpr;
      ctx.fillText(f.text, f.x, f.y - k * cell * 1.6);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw(t) {
    if (!active) return;
    now = t;
    const stepMs = effects.slow > now ? STEP_MS * 1.8 : STEP_MS;
    if (!lastStep || t - lastStep > stepMs * 4) lastStep = t;
    if (deadUntil) {
      if (t >= deadUntil) { deadUntil = 0; reset(); lastStep = t; }
    } else {
      while (t - lastStep >= stepMs) { step(); lastStep += stepMs; if (deadUntil) break; }
    }
    if (Math.floor(t / 250) !== Math.floor((t - 16) / 250)) showScore();   // keep power-up timers fresh
    render();
    raf = requestAnimationFrame(draw);
  }

  function activate() {
    if (active) return;
    // Never cover the coursework viewer while someone is reading a file
    if (document.documentElement.classList.contains('cv-open')) { timer = setTimeout(activate, IDLE_MS); return; }
    active = true;
    document.documentElement.style.overflow = 'hidden';
    saver.classList.add('is-active');
    saver.setAttribute('aria-hidden', 'false');
    if (!reduce) { now = performance.now(); resize(); lastStep = 0; raf = requestAnimationFrame(draw); }
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.documentElement.style.overflow = '';
    saver.classList.remove('is-active');
    saver.setAttribute('aria-hidden', 'true');
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  // Steering: arrow keys / WASD, or a swipe on touch screens
  function steer(dx, dy) {
    if (!active || reduce || deadUntil) return;
    if (!manual) { manual = true; score = 0; bombs = []; showScore(); }   // any key takes over
    const cur = queued || dir;
    if (dx === -cur[0] && dy === -cur[1] && snake.length > 1) return;   // no reversing into yourself
    queued = [dx, dy];
  }
  const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
  window.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') { deactivate(); onActivity(); return; }
    const k = KEYS[e.key];
    if (k) { e.preventDefault(); steer(k[0], k[1]); }
    e.stopImmediatePropagation();   // keep the keys away from the page underneath
  }, true);
  let touch0 = null;
  saver.addEventListener('touchstart', e => { const t = e.touches[0]; touch0 = [t.clientX, t.clientY]; }, { passive: true });
  saver.addEventListener('touchmove', e => { if (active) e.preventDefault(); }, { passive: false });
  saver.addEventListener('touchend', e => {
    if (!touch0) return;
    const t = e.changedTouches[0], dx = t.clientX - touch0[0], dy = t.clientY - touch0[1];
    touch0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0); else steer(0, Math.sign(dy));
  });
  if (backBtn) backBtn.addEventListener('click', () => { deactivate(); onActivity(); });

  // While the idle screen is up, moving the mouse or pressing keys no
  // longer closes it: only "Back to website" (or Esc) does.
  function onActivity() {
    if (active) return;
    clearTimeout(timer);
    timer = setTimeout(activate, IDLE_MS);
  }

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(ev =>
    window.addEventListener(ev, onActivity, { passive: true })
  );
  window.addEventListener('resize', () => { if (active) resize(); });
  onActivity();   // start the idle countdown
})();
