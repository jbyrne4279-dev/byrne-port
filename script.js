/* ============================================================
   JOSEPH BYRNE PORTFOLIO — script.js
   ============================================================ */

'use strict';

/* ── MATRIX RAIN INTRO (red) ── */
(function initMatrixIntro() {
  const wrap = document.getElementById('matrixIntro');
  const canvas = document.getElementById('matrixCanvas');
  if (!wrap || !canvas) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    wrap.classList.add('is-done');
    setTimeout(() => wrap.remove(), 950);
    return;
  }

  const ctx = canvas.getContext('2d');
  const chars = 'アカサタナハマヤラワ0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜｵ<>*/#JBAX'.split('');
  let dpr = 1, fontSize = 16, cols = 0, drops = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    fontSize = 16 * dpr;
    cols = Math.ceil(canvas.width / fontSize);
    drops = Array.from({ length: cols }, () => Math.random() * -40);
  }
  resize();
  window.addEventListener('resize', resize);

  let raf, running = true;
  function draw() {
    if (!running) return;
    // fade the previous frame for the trailing streak
    const lightRain = !document.documentElement.classList.contains('theme-dark');
    ctx.fillStyle = lightRain ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.09)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + 'px "Space Mono", monospace';
    for (let i = 0; i < cols; i++) {
      const ch = chars[(Math.random() * chars.length) | 0];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      // bright leading glyph, dimmer red trail
      ctx.fillStyle = lightRain ? (Math.random() > 0.975 ? '#8A8A93' : '#C7C7CC')
                                : (Math.random() > 0.975 ? '#FF6961' : '#FF453A');
      ctx.fillText(ch, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    raf = requestAnimationFrame(draw);
  }
  draw();

  // Let the rain fall, then start fading the overlay out WHILE it keeps
  // raining — so the site materialises through the falling code, as if the
  // rain is drawing it into existence. Once faded, stop and remove.
  setTimeout(() => wrap.classList.add('is-done'), 1200);
  setTimeout(() => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    wrap.remove();
  }, 3100);
})();

/* ── AFK SCREENSAVER (idle → a game of Snake) ──
   After 30s idle the screen shows "Still here?" over a game of Snake that
   plays itself. Any arrow key / WASD / swipe takes over. Apples grow the
   snake; bombs end the game; power-ups (shield, slow-mo, double points,
   shrink) appear now and then. Only "Back to website" or Esc closes it. */
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
    cell = Math.round((window.innerWidth < 600 ? 30 : 40) * dpr);
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

  /* ── Scoreboard + event feed (styled like a competitive shooter's) ── */
  const stats = { apples: 0, powers: 0, deaths: 0 };
  const ICON = {
    snake: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="6" height="6" rx="1.6"/><rect x="9" y="9" width="6" height="6" rx="1.6"/><rect x="15" y="7" width="7" height="8" rx="2"/><circle cx="19.5" cy="10" r="1" fill="#000"/></svg>',
    apple: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#2ee082"/><path d="M12 7c0-2 1-3.5 3-4" stroke="#7a4b23" stroke-width="1.6" fill="none"/><ellipse cx="15" cy="5.5" rx="2.6" ry="1.3" fill="#0f7a3f" transform="rotate(-30 15 5.5)"/></svg>',
    bomb: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7" fill="#3a3a40" stroke="#9a9aa2" stroke-width="1.4"/><path d="M15 8l3-3" stroke="#aaa" stroke-width="1.8"/><circle cx="19" cy="4.5" r="2" fill="#ffc93c"/></svg>',
    wall: '<svg viewBox="0 0 24 24" fill="#c9c9cf"><rect x="2" y="4" width="9" height="5" rx="1"/><rect x="13" y="4" width="9" height="5" rx="1"/><rect x="2" y="10" width="4" height="5" rx="1"/><rect x="8" y="10" width="9" height="5" rx="1"/><rect x="19" y="10" width="3" height="5" rx="1"/><rect x="2" y="16" width="9" height="5" rx="1"/><rect x="13" y="16" width="9" height="5" rx="1"/></svg>',
    self: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF6961" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#4da3ff"/></svg>',
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="#3ee6e0" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/></svg>',
    double: '<svg viewBox="0 0 24 24"><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="800" fill="#ffc93c" font-family="system-ui">2×</text></svg>',
    shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="#b57bff" stroke-width="2.4" stroke-linecap="round"><path d="M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
    start: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#2ee082"/></svg>'
  };
  const board = document.createElement('div');
  board.className = 'sg-board';
  board.setAttribute('aria-live', 'polite');
  board.innerHTML = `
    <div class="sg-board__head"><span class="sg-board__title">Snake</span><span class="sg-board__mode">Competitive</span></div>
    <div class="sg-board__cols"><span>Player</span><span>${ICON.apple}</span><span>${ICON.shield}</span><span>${ICON.bomb}</span><span>Score</span><span>Best</span></div>
    <div class="sg-board__row"><span class="sg-board__player">${ICON.snake}<b class="sg-who">Autopilot</b></span><span class="sg-a">0</span><span class="sg-p">0</span><span class="sg-d">0</span><span class="sg-s">0</span><span class="sg-b">0</span></div>
    <div class="sg-board__fx"></div>`;
  const killfeed = document.createElement('div');
  killfeed.className = 'sg-feed';
  saver.appendChild(board);
  saver.appendChild(killfeed);
  function feed(kind, text, bad) {
    const row = document.createElement('div');
    row.className = 'sg-feed__row' + (bad ? ' is-bad' : '');
    row.innerHTML = `<span class="sg-feed__ico">${ICON.snake}</span><span class="sg-feed__arrow"></span><span class="sg-feed__ico">${ICON[kind] || ICON.apple}</span><span class="sg-feed__txt"></span>`;
    row.querySelector('.sg-feed__txt').textContent = text;
    killfeed.prepend(row);
    while (killfeed.children.length > 5) killfeed.lastChild.remove();
    setTimeout(() => row.classList.add('is-old'), 4200);
    setTimeout(() => row.remove(), 4800);
  }
  function paintBoard() {
    board.querySelector('.sg-who').textContent = manual ? 'You' : 'Autopilot';
    board.classList.toggle('is-you', manual);
    board.querySelector('.sg-a').textContent = manual ? stats.apples : '–';
    board.querySelector('.sg-p').textContent = manual ? stats.powers : '–';
    board.querySelector('.sg-d').textContent = stats.deaths;
    board.querySelector('.sg-s').textContent = manual ? score : '–';
    board.querySelector('.sg-b').textContent = best;
    const fx = Object.keys(effects).filter(k => effects[k] > now);
    board.querySelector('.sg-board__fx').innerHTML = fx.map(k =>
      `<span class="sg-fx">${ICON[k]}<i>${Math.ceil((effects[k] - now) / 1000)}s</i></span>`).join('');
  }

  function showScore() {
    paintBoard();
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

  function die(x, y, cause) {
    explode(x, y);
    if (manual) {
      stats.deaths++;
      feed(cause === 'bomb' ? 'bomb' : cause === 'wall' ? 'wall' : 'self',
        cause === 'bomb' ? `Hit a bomb · ${score} pts` : cause === 'wall' ? `Hit the wall · ${score} pts` : `Bit its own tail · ${score} pts`, true);
    }
    floatText(canvas.width / 2, canvas.height * 0.28, `Game over · ${score}`, '#FF6961');
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
      if (offBoard) {                      // walls are solid — no wrap to the opposite side
        die(cx(snake[0][0]), cy(snake[0][1]), 'wall'); return;
      }
      const hitSelf = snake.slice(0, -1).some(([x, y]) => x === nx && y === ny);
      if (hitSelf) {
        if (effects.shield <= now) { die(cx(nx), cy(ny), 'self'); return; }
        effects.shield = 0; floatText(cx(nx), cy(ny), 'Shield used', POWERS.shield.color); feed('shield', 'Shield saved you');
      }
    } else {
      const d = chooseDir();
      if (!d) { reset(); return; }
      dir = d; nx = snake[0][0] + dir[0]; ny = snake[0][1] + dir[1];
    }

    if (hitsBackButton(nx, ny)) {
      burst(cx(nx), cy(ny), ['#FF6961', '#2ee082', '#ffffff'], 26, 0.32);
      deactivate(); onActivity(); return;
    }

    const bi = bombs.findIndex(b => b.x === nx && b.y === ny);
    if (bi >= 0) {
      const b = bombs.splice(bi, 1)[0];
      if (!manual || effects.shield <= now) { die(cx(b.x), cy(b.y), 'bomb'); return; }
      explode(cx(b.x), cy(b.y)); effects.shield = 0;
      floatText(cx(b.x), cy(b.y), 'Shield used', POWERS.shield.color); feed('bomb', 'Bomb blocked by shield');
    }

    snake.unshift([nx, ny]);

    if (apple && nx === apple[0] && ny === apple[1]) {
      const pts = effects.double > now ? 2 : 1;
      grow += 3;
      if (manual) { score += pts; stats.apples++; feed('apple', pts > 1 ? `Apple +${pts} (2×)` : 'Apple +1'); }
      burst(cx(nx), cy(ny), ['#2ee082', '#9dffc9', '#FF6961', '#ffffff'], 26, 0.32);
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
      if (manual) { stats.powers++; feed(power.type, p.label); }
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
    const lightBoard = !document.documentElement.classList.contains('theme-dark');
    ctx.fillStyle = lightBoard ? '#FFFFFF' : '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 450 * 9 * dpr;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    // faint board grid
    ctx.strokeStyle = lightBoard ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.035)';
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

    // the snake: glossy rounded blocks like the homepage snake, red to deep
    // red down the body, a tail that shrinks away, and a cartoon head
    const shielded = effects.shield > now, dead = now < deadUntil;
    const age = (now - pulseAt) / 45, n = snake.length, TAILN = 4, lw = 1.5 * dpr;
    const mix = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
    const HEADC = [255, 77, 94], TAILC = [176, 18, 42];
    if (shielded) { ctx.shadowColor = 'rgba(77,163,255,.9)'; ctx.shadowBlur = 16 * dpr; }
    for (let i = n - 1; i >= 1; i--) {
      const [x, y] = snake[i], t = i / Math.max(1, n - 1), fromEnd = n - 1 - i;
      const shrink = fromEnd < TAILN ? 0.5 + 0.5 * (fromEnd / TAILN) : 1;
      const bulge = age < n + 6 ? 0.25 * Math.exp(-((age - i) ** 2) / 3) : 0;
      const sz = cell * 0.86 * shrink * (1 + bulge), bx = cx(x) - sz / 2, by = cy(y) - sz / 2;
      const c = dead ? [120, 40, 46] : mix(HEADC, TAILC, t);
      ctx.fillStyle = '#6E0C1B'; roundRect(bx - lw, by - lw, sz + lw * 2, sz + lw * 2, sz * 0.28 + lw); ctx.fill();
      ctx.fillStyle = `rgb(${c})`; roundRect(bx, by, sz, sz, sz * 0.28); ctx.fill();
      const hl = mix(c, [255, 255, 255], 0.35);
      ctx.fillStyle = `rgb(${hl})`; roundRect(bx + sz * 0.16, by + sz * 0.12, sz * 0.5, sz * 0.2, sz * 0.1); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // head
    const [hx, hy] = snake[0], HS = cell, ang = Math.atan2(dir[1], dir[0]);
    let open = 0;
    if (apple && !dead) {
      const d = Math.abs(apple[0] - hx) + Math.abs(apple[1] - hy);
      open = Math.max(0, Math.min(1, (3 - d) / 2));
    }
    const chompT = (now - pulseAt) / 220, chomp = chompT < 1 ? Math.sin(chompT * Math.PI) : 0;
    ctx.save();
    ctx.translate(cx(hx), cy(hy)); ctx.rotate(ang); ctx.scale(1 + chomp * 0.14, 1 - chomp * 0.1);
    ctx.fillStyle = '#6E0C1B'; roundRect(-HS / 2 - lw, -HS / 2 - lw, HS + lw * 2, HS + lw * 2, HS * 0.3 + lw); ctx.fill();
    ctx.fillStyle = dead ? 'rgb(120,40,46)' : `rgb(${HEADC})`; roundRect(-HS / 2, -HS / 2, HS, HS, HS * 0.3); ctx.fill();
    ctx.fillStyle = 'rgb(255,160,168)'; roundRect(-HS * 0.34, -HS * 0.38, HS * 0.45, HS * 0.16, HS * 0.08); ctx.fill();
    if (open > 0.02) {
      const mh = HS * 0.34 * open;
      ctx.fillStyle = '#3A0610';
      ctx.beginPath(); ctx.moveTo(HS * 0.12, 0); ctx.lineTo(HS / 2 + lw, -mh); ctx.lineTo(HS / 2 + lw, mh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FF2D55'; ctx.beginPath(); ctx.ellipse(HS * 0.34, 0, HS * 0.12, mh * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const sd of [-1, 1]) { const fy = sd * mh * 0.78; ctx.beginPath(); ctx.moveTo(HS * 0.36, fy); ctx.lineTo(HS * 0.46, fy); ctx.lineTo(HS * 0.41, fy - sd * HS * 0.12 * open); ctx.closePath(); ctx.fill(); }
    }
    const blink = (now % 4200) < 140;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-HS * 0.02, sd * HS * 0.2, HS * 0.15, blink || dead ? HS * 0.03 : HS * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      if (!blink && !dead) {
        ctx.fillStyle = '#1A0306'; ctx.beginPath(); ctx.arc(HS * 0.04, sd * HS * 0.19, HS * 0.075, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(HS * 0.015, sd * HS * 0.165, HS * 0.025, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    if (shielded) {
      ctx.strokeStyle = 'rgba(77,163,255,.8)'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(cx(hx), cy(hy), cell * 0.72, 0, Math.PI * 2); ctx.stroke();
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

  // mode 'game': opened from the homepage's roaming snake ("Click me").
  // It hides the idle messages and the button reads "Back to portfolio".
  let gameMode = false;
  function activate(mode) {
    if (active) return;
    gameMode = mode === 'game';
    saver.classList.toggle('is-game', gameMode);
    if (backBtn) backBtn.textContent = gameMode ? 'Back to portfolio' : 'Back to website';
    // Never cover the coursework viewer while someone is reading a file
    if (document.documentElement.classList.contains('cv-open')) { timer = setTimeout(activate, IDLE_MS); return; }
    active = true;
    document.documentElement.style.overflow = 'hidden';
    saver.classList.add('is-active');
    saver.setAttribute('aria-hidden', 'false');
    if (!reduce) { now = performance.now(); resize(); lastStep = 0; raf = requestAnimationFrame(draw); }
    if (gameMode && backBtn) setTimeout(() => backBtn.focus({ preventScroll: true }), 50);
  }
  window.__jbOpenSnake = () => { clearTimeout(timer); activate('game'); };

  // Steering the snake into the back button takes you back to the site
  function hitsBackButton(x, y) {
    if (!backBtn || !manual) return false;
    const r = backBtn.getBoundingClientRect();
    const px = cx(x) / dpr, py = cy(y) / dpr;
    return px >= r.left - 4 && px <= r.right + 4 && py >= r.top - 4 && py <= r.bottom + 4;
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
    if (!manual) { manual = true; score = 0; bombs = []; stats.apples = 0; stats.powers = 0; feed('start', 'You took control'); showScore(); }   // any key takes over
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

/* ── PORTFOLIO FILTER SWEEP (visual only — never changes the category) ── */
(function initFilterSweep() {
  const btns = Array.from(document.querySelectorAll('.portfolio__filter .filter-btn'));
  if (!btns.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function sweep() {
    btns.forEach((btn, i) => {
      setTimeout(() => {
        btn.classList.add('is-sweeping');
        setTimeout(() => btn.classList.remove('is-sweeping'), 800);
      }, i * 190);
    });
    schedule();
  }
  function schedule() {
    setTimeout(sweep, 5000 + Math.random() * 5000);   // every 5–10s
  }
  schedule();
})();

/* ── CUSTOM CURSOR ── */
(function initCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(hover: none)').matches) return;

  let mx = 0, my = 0, cx = 0, cy = 0;
  let raf;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  function tick() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const hoverTargets = 'a, button, .project-card, .skill-tag, .academic-row, .filter-btn';
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('cursor--hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--hover'));
  });

  // Cursor flash on click (accent colour of the current theme)
  document.addEventListener('mousedown', () => {
    cursor.style.opacity = '1';
    cursor.style.border = '1px solid var(--red, #FF453A)';
    const glow = document.documentElement.classList.contains('theme-dark') ? '255, 69, 58' : '77, 77, 85';
    cursor.style.boxShadow = `0 0 24px rgba(${glow},0.45), inset 0 0 16px rgba(${glow},0.2)`;
  });
  document.addEventListener('mouseup', () => {
    cursor.style.opacity = '';
    cursor.style.border = '';
    cursor.style.boxShadow = '';
  });
})();

/* ── NAV: scroll state + active link ── */
(function initNav() {
  const nav     = document.getElementById('nav');
  if (!nav) return;
  // Subpages keep a solid bar and their own highlighted section
  if (!document.getElementById('home')) { nav.classList.add('is-scrolled'); return; }
  const links   = nav.querySelectorAll('.nav__links a');
  const sections = document.querySelectorAll('section[id]');

  // Scroll background
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Active link via IntersectionObserver
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(s => io.observe(s));
})();

/* ── MOBILE MENU ── */
(function initMobileMenu() {
  const btn       = document.getElementById('menuBtn');
  const menu      = document.getElementById('mobileMenu');
  const closeBtn  = document.getElementById('menuClose');
  if (!menu || !btn || window.__jbNavMenu) return;
  window.__jbNavMenu = true;
  const mobileLinks = menu.querySelectorAll('.mobile-link');

  function open() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    btn.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    btn.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => menu.classList.contains('is-open') ? close() : open());
  closeBtn.addEventListener('click', close);
  mobileLinks.forEach(a => a.addEventListener('click', close));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ── PROJECTS CINEMA CAROUSEL (coverflow + filter) ── */
(function initCarousel() {
  const carousel = document.getElementById('projectCarousel');
  const stage    = document.getElementById('carouselStage');
  if (!carousel || !stage) return;

  const btns     = Array.from(document.querySelectorAll('.filter-btn'));
  const allCards = Array.from(stage.querySelectorAll('.project-card'));

  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Centre on the clothing-brand project when it's in the given list,
  // otherwise fall back to the middle of that list.
  function startIndexIn(list) {
    const i = list.findIndex(c => {
      const link = c.querySelector('.project-card__cover-link');
      return link && /clothing-brand/.test(link.getAttribute('href') || '');
    });
    return i >= 0 ? i : Math.floor(list.length / 2);
  }

  let visible    = allCards.slice();               // cards in the current filter
  let pos        = startIndexIn(allCards);         // current centre (float, unbounded)
  let vel        = 0;                              // scroll speed (cards/sec)
  let snapTarget = null;                           // eased target for click / keyboard
  let lastT      = 0;                              // last frame timestamp
  let rafId      = null;
  let dragging   = false;                          // finger/mouse currently dragging
  let flinging   = false;                          // swipe momentum decaying
  let prevPos    = pos;                            // last frame's position (for speed)
  let motionBlur = 0;                              // current blur (px), from speed

  const MAX_SPEED = 7;     // cards/sec the reel scrolls at the far edge (hover)
  const DEAD      = 0.08;  // central rest zone (fraction of half width)
  const SNAP_EASE = 0.10;  // ease factor when settling onto a card (slow, cinematic glide)

  // Swipe / flick momentum: the speed of the swipe modifies the scroll speed
  const FRICTION   = 0.93;  // momentum decay per 60fps frame
  const FLICK_MULT = 1.25;  // swipe-speed → scroll-speed modifier
  const FLICK_MIN  = 1.4;   // min swipe speed (cards/sec) to fling
  const MAX_FLING  = 24;    // cap on fling speed (cards/sec)
  const VEL_MIN    = 0.2;   // momentum stops below this (cards/sec)

  // Motion blur driven by how fast the reel is actually moving on screen
  const BLUR_MIN_SPEED = 1.0;  // cards/sec below which there's no blur
  const BLUR_PER_SPEED = 1.5;  // px of blur per card/sec above the floor
  const MAX_BLUR       = 11;   // cap (px)
  const DIM_PER_SPEED  = 0.05; // extra darken per card/sec while transitioning

  // Responsive coverflow parameters
  function params() {
    const w = window.innerWidth;
    if (w < 560) return { step: 38, rot: 0, z: 40, maxVis: 2 };
    if (w < 900) return { step: 43, rot: 0, z: 55, maxVis: 3 };
    return { step: 40, rot: 0, z: 60, maxVis: 5 };
  }

  // The reel wraps into an infinite loop only when there are enough cards
  // to keep the wrap seam (offset ≈ N/2) hidden off-screen.
  function isLoop(p) {
    return visible.length > 2 * (p || params()).maxVis + 1;
  }

  const mod = (n, m) => ((n % m) + m) % m;

  // Render the reel for a fractional centre position
  function layout(center) {
    const p = params();
    const N = visible.length;
    const loop = isLoop(p);
    const centreIndex = mod(Math.round(center), N);

    visible.forEach((card, i) => {
      let offset = i - center;
      if (loop) offset -= N * Math.round(offset / N);  // shortest wrapped path
      const abs    = Math.abs(offset);
      const sign   = offset === 0 ? 0 : (offset > 0 ? 1 : -1);
      const clamp  = Math.min(abs, 3);

      const scale  = Math.max(0.55, 1 - abs * 0.14);
      const rot    = -sign * clamp * p.rot;
      const tx     = offset * p.step;           // % of card width
      const tz     = -abs * p.z;                // push side cards back
      // Cinematic dip: darken and pull back on top of the normal
      // side-card falloff while the reel is actually moving, so the
      // whole transition reads like a graded video cut rather than a
      // mechanical slide.
      const moveDim = Math.min(0.35, motionBlur * 0.03);
      const bright  = Math.max(0.55, 1 - abs * 0.08 - moveDim);
      const hidden  = abs > p.maxVis + 0.5;
      const moveScale = 1 - Math.min(0.04, motionBlur * 0.004);

      card.style.transform =
        `translate(-50%, -50%) translateX(${tx}%) translateZ(${tz}px) ` +
        `rotateY(${rot}deg) scale(${(scale * moveScale).toFixed(4)})`;
      card.style.zIndex  = String(100 - Math.round(abs));
      card.style.opacity = hidden ? '0' : '1';
      card.style.filter  = motionBlur > 0.05
        ? `brightness(${bright.toFixed(3)}) blur(${motionBlur.toFixed(2)}px) saturate(${(1 - moveDim * 0.6).toFixed(3)})`
        : `brightness(${bright.toFixed(3)})`;
      card.style.pointerEvents = hidden ? 'none' : 'auto';
      card.classList.toggle('is-active', i === centreIndex);
    });
  }

  function draw() {
    let c = pos;
    if (!isLoop()) c = clampN(c, 0, visible.length - 1);
    layout(c);
  }

  // Single rAF loop handling four modes, in priority:
  //  · dragging  — pos is set live in pointermove; keep the loop alive
  //  · flinging  — swipe momentum: glide on and decay by friction, then snap
  //  · vel != 0  — cursor-held scroll (hold the mouse to one side)
  //  · snapTarget— ease onto the nearest / chosen card and rest
  function frame(t) {
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    let running = false;

    if (dragging) {
      running = true;                        // pos updated by pointermove
    } else if (flinging) {
      pos += vel * dt;
      vel *= Math.pow(FRICTION, dt * 60);    // frame-rate-independent decay
      if (Math.abs(vel) <= VEL_MIN) { vel = 0; flinging = false; snapTarget = Math.round(pos); }
      running = true;
    } else if (vel !== 0) {
      pos += vel * dt;                        // continuous cursor-driven scroll
      snapTarget = null;
      running = true;
    } else if (snapTarget !== null) {
      pos += (snapTarget - pos) * SNAP_EASE;
      if (Math.abs(snapTarget - pos) < 0.001) { pos = snapTarget; snapTarget = null; }
      else running = true;
    }

    if (!isLoop()) pos = clampN(pos, 0, visible.length - 1);

    // Motion blur from the reel's real on-screen speed (cards/sec)
    if (running) {
      const speed = Math.abs(pos - prevPos) / dt;
      const target = Math.min(MAX_BLUR, Math.max(0, speed - BLUR_MIN_SPEED) * BLUR_PER_SPEED);
      motionBlur += (target - motionBlur) * 0.4;
      if (motionBlur < 0.05) motionBlur = 0;
    } else {
      motionBlur = 0;
    }
    prevPos = pos;

    draw();
    rafId = running ? requestAnimationFrame(frame) : null;
  }

  function ensureLoop() {
    if (rafId == null) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  function settleToNearest() {
    vel = 0;
    snapTarget = Math.round(pos);
    ensureLoop();
  }

  // Step by ±1 (keyboard / wheel / swipe); loops forever when looping is on.
  // Accumulates off the pending target so rapid steps add up (e.g. spinning
  // the wheel) instead of collapsing onto the same card.
  function step(dir) {
    vel = 0;
    const from = (snapTarget !== null) ? snapTarget : Math.round(pos);
    snapTarget = from + dir;
    if (!isLoop()) snapTarget = clampN(snapTarget, 0, visible.length - 1);
    ensureLoop();
  }

  // Centre a specific card via the shortest (possibly wrapped) path.
  // `instant` snaps straight there (used for clicks) instead of easing.
  function focus(idx, instant) {
    vel = 0;
    const N = visible.length;
    const target = isLoop() ? idx + N * Math.round((pos - idx) / N)
                             : clampN(idx, 0, N - 1);
    if (instant) {
      pos = target;
      snapTarget = null;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      draw();
    } else {
      snapTarget = target;
      ensureLoop();
    }
  }

  // Delegated click: click a side card to jump straight to it; click the
  // centred card to open it. Delegating (instead of per-card listeners) is
  // robust against pointer-capture retargeting and the 3D transforms, which
  // offset each card's hit-box from where it visually appears — so we resolve
  // the target by hit-test first, then fall back to the nearest card by x.
  carousel.addEventListener('click', e => {
    if (suppressClick) { e.preventDefault(); return; }
    const N = visible.length;
    if (!N) return;

    let card = document.elementFromPoint(e.clientX, e.clientY);
    card = card && card.closest ? card.closest('.project-card') : null;
    if (!card || visible.indexOf(card) === -1) {
      // No direct hit — pick the visible card whose centre is nearest the click
      let best = null, bestD = Infinity;
      visible.forEach(c => {
        if (getComputedStyle(c).opacity === '0') return;
        const r = c.getBoundingClientRect();
        const d = Math.abs((r.left + r.width / 2) - e.clientX);
        if (d < bestD) { bestD = d; best = c; }
      });
      card = best;
    }
    const idx = card ? visible.indexOf(card) : -1;
    if (idx === -1) return;

    const centreIndex = mod(Math.round(pos), N);
    if (idx !== centreIndex) {
      e.preventDefault();          // side card → just centre it, instantly
      focus(idx, true);
    } else {
      const link = card.querySelector('.project-card__cover-link');
      if (link) {                  // centred card → open its project
        e.preventDefault();
        window.location.href = link.getAttribute('href');
      }
    }
  });

  // Filter buttons rebuild the visible set
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const filter = btn.dataset.filter;
      allCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
        card.style.display = match ? '' : 'none';
      });
      visible    = allCards.filter(c => c.style.display !== 'none');
      pos        = startIndexIn(visible);
      vel        = 0;
      snapTarget = null;
      draw();
    });
  });

  // ── Pointer interaction: drag-to-scrub with flick momentum (all pointers)
  //    plus, on fine pointers, cursor-position velocity scrubbing ──
  let startX = 0, startPos = 0, lastX = 0, lastMoveT = 0, dragVel = 0;
  let suppressClick = false;

  // Cached instead of read on every pointermove: offsetWidth forces a
  // synchronous layout, and reading it after every drag frame's style
  // writes (in draw()) was forcing that layout on *every single*
  // finger movement — the actual cause of the swipe lag. Recomputed
  // once per drag (cheap) and on resize, not per pixel of movement.
  let cachedPxPerCard = 100;
  function pxPerCard() {
    const w = allCards[0] ? allCards[0].offsetWidth
                          : carousel.getBoundingClientRect().width * 0.3;
    return Math.max(60, w * (params().step / 100));
  }
  window.addEventListener('resize', () => { cachedPxPerCard = pxPerCard(); }, { passive: true });

  let activePointerId = null;

  carousel.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = lastX = e.clientX;
    startPos = pos;
    lastMoveT = performance.now();
    dragVel = 0;
    dragging = true;
    flinging = false;
    suppressClick = false;
    activePointerId = e.pointerId;
    vel = 0;
    snapTarget = null;
    cachedPxPerCard = pxPerCard(); // one layout read for the whole drag
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    // NOTE: pointer capture is deferred until an actual drag starts (below).
    // Capturing on pointerdown makes the follow-up `click` fire on the
    // carousel instead of the card, which breaks clicking cards on desktop.
  });

  carousel.addEventListener('pointermove', e => {
    // Active drag: track the pointer 1:1 and measure its speed for the flick
    if (dragging) {
      const now = performance.now();
      const ppc = cachedPxPerCard;
      const dx  = e.clientX - startX;
      if (Math.abs(dx) > 6 && !suppressClick) {
        suppressClick = true;              // it's a drag, not a click
        try { carousel.setPointerCapture(e.pointerId); } catch (_) {}
      }
      pos = startPos - dx / ppc;
      if (!isLoop()) pos = clampN(pos, 0, visible.length - 1);
      const ddt = (now - lastMoveT) / 1000;
      if (ddt > 0) {
        const instant = -((e.clientX - lastX) / ppc) / ddt;  // cards/sec
        dragVel = dragVel * 0.7 + instant * 0.3;             // smooth the estimate
      }
      lastX = e.clientX;
      lastMoveT = now;
      draw();
      return;
    }
    // Cursor-position velocity scrub (fine pointers, when idle)
    if (canHover && !reduce && !flinging) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const r = carousel.getBoundingClientRect();
      const norm = clampN(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      const a = Math.abs(norm);
      if (a <= DEAD) {
        vel = 0;
        if (snapTarget === null) snapTarget = Math.round(pos);  // rest on a card
      } else {
        const m = (a - DEAD) / (1 - DEAD);          // 0..1 outside the dead zone
        vel = Math.sign(norm) * m * m * MAX_SPEED;  // quadratic: fine near centre
      }
      ensureLoop();
    }
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (activePointerId != null) {
      try { carousel.releasePointerCapture(activePointerId); } catch (_) {}
      activePointerId = null;
    }
    // The swipe's speed becomes the scroll speed: a faster flick sends the
    // reel further and quicker; a gentle release just settles on a card.
    if (Math.abs(dragVel) > FLICK_MIN) {
      vel = clampN(dragVel * FLICK_MULT, -MAX_FLING, MAX_FLING);
      flinging = true;
      ensureLoop();
    } else {
      settleToNearest();
    }
    setTimeout(() => { suppressClick = false; }, 0);
  };
  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);

  // Leaving with a fine pointer settles onto a card (unless mid-fling/drag)
  if (canHover && !reduce) {
    carousel.addEventListener('pointerleave', () => {
      if (dragging || flinging) return;
      settleToNearest();
    });
  }

  // Track whether the carousel is on screen, so global arrow/wheel input
  // only drives it while it's actually in view.
  let inView = false;
  new IntersectionObserver(
    entries => { inView = entries[0].isIntersecting; },
    { threshold: 0.25 }
  ).observe(carousel);

  // Keyboard navigation — works whenever the carousel is on screen (no need
  // to click it first). Left/Right don't scroll the page, so intercepting
  // them is safe.
  window.addEventListener('keydown', e => {
    if (!inView) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  // Scroll-wheel navigation — a horizontal trackpad swipe over the carousel
  // steps through the reel. Vertical wheel input (a normal mouse wheel, or
  // scrolling the page on a trackpad) is left alone so the page keeps
  // scrolling normally instead of getting stuck scrubbing the reel.
  // Accumulate delta so one notch is roughly one card regardless of device.
  let wheelAcc = 0;
  const WHEEL_STEP = 120;
  carousel.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;  // vertical → let the page scroll
    let d = e.deltaX;
    if (e.deltaMode === 1) d *= 16;   // line units → approx pixels
    if (d === 0) return;
    e.preventDefault();               // scrub the reel instead of the page
    vel = 0;                          // wheel overrides hover-scroll
    wheelAcc += d;
    while (Math.abs(wheelAcc) >= WHEEL_STEP) {
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP;
    }
  }, { passive: false });

  let resizeRAF;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(draw);
  });

  draw();
  cachedPxPerCard = pxPerCard();
})();

/* ── SCROLL REVEAL ── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ── CONTACT FORM ── */
(function initForm() {
  const form      = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  if (!form) return;

  function validate(field) {
    const group = field.closest('.form-group');
    const valid = field.checkValidity();
    group.classList.toggle('has-error', !valid);
    return valid;
  }

  form.querySelectorAll('input, textarea').forEach(field => {
    field.addEventListener('blur', () => validate(field));
    field.addEventListener('input', () => {
      if (field.closest('.form-group').classList.contains('has-error')) validate(field);
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    let allValid = true;
    form.querySelectorAll('input, textarea').forEach(field => {
      if (!validate(field)) allValid = false;
    });
    if (!allValid) return;

    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Sending…';

    try {
      const res = await fetch('https://formspree.io/f/xbdbnvye', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      if (!res.ok) throw new Error('Network error');
      submitBtn.innerHTML = 'Message Sent! ✓';
      submitBtn.style.background = '#2d7a4a';
      form.reset();
      form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.background = '';
      }, 3000);
    } catch (err) {
      submitBtn.innerHTML = 'Try Again';
      submitBtn.style.background = '#c0392b';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.background = '';
      }, 3000);
    }
  });
})();

/* ── SCANLINE INJECTION ── */
(function addScanlines() {
  document.querySelectorAll('.project-card__img').forEach(img => {
    const sl = document.createElement('div');
    sl.className = 'scanline';
    img.prepend(sl);
  });
})();

/* ── COUNT-UP ANIMATION ── */
(function initCountUp() {
  const DURATION = 1400;

  function runCount(el) {
    const raw = el.textContent.trim();
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const suffix = raw.replace(/[\d.]/g, '');
    const start = performance.now();

    el.textContent = '0' + suffix;

    function step(now) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = Math.round(eased * num) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        runCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.stat__num, .academic-row__pct').forEach(el => {
    observer.observe(el);
  });
})();


/* ── RED MIST (hero + portfolio) · BLACK SMOKE (contact) ── */
['heroMist', 'portfolioMist', 'contactSmoke'].forEach(initMist);
function initMist(canvasId) {
  // colour palette per canvas: red mist by default, charcoal smoke for contact
  const SMOKE = canvasId === 'contactSmoke';
  const PALETTE = SMOKE ? ['255,69,58', '150,30,26'] : ['255,69,58', '170,36,30'];   // Apple system red, light and deep
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Scale particle density to canvas height so taller sections (like the
  // portfolio, which is much taller than the hero's 100vh) don't read as
  // sparser than the hero's mist.
  const COUNT = Math.round(Math.max(30, canvas.height / 26));
  const particles = [];

  function MistParticle(initialY) {
    this.reset = function(initial) {
      this.x          = Math.random() * canvas.width;
      this.y          = initial ? Math.random() * canvas.height : canvas.height + 60;
      // On narrow canvases (phones) the mist clouds are huge relative to the
      // viewport, so with 'lighter' blending they stack into a solid red wash
      // and the subtle rising-ember effect is lost. Scale each particle's size
      // — and tone down how hard they stack — to the canvas width so the mist
      // reads the same on mobile as it does on desktop. Read canvas.width live
      // so the scale follows a resize / orientation change.
      const sizeScale = Math.min(1, Math.max(0.4, canvas.width / 1200));
      this.radius     = (90 + Math.random() * 200) * sizeScale;
      this.opacity    = 0;
      this.maxOpacity = (SMOKE
        ? 0.14 + Math.random() * 0.16
        : 0.09 + Math.random() * 0.13) * (0.6 + 0.4 * sizeScale);
      this.vy         = -(0.15 + Math.random() * 0.45);
      this.vx         = (Math.random() - 0.5) * 0.25;
      this.phase      = Math.random() * Math.PI * 2;
      this.growing    = true;
      this.color      = Math.random() > 0.35 ? PALETTE[0] : PALETTE[1];
    };
    this.reset(!!initialY);

    this.update = function() {
      this.y     += this.vy;
      this.x     += this.vx + Math.sin(this.phase) * 0.18;
      this.phase += 0.004;

      if (this.growing) {
        this.opacity = Math.min(this.opacity + 0.003, this.maxOpacity);
        if (this.opacity >= this.maxOpacity) this.growing = false;
      } else {
        this.opacity -= 0.0008;
      }

      if (this.opacity <= 0 || this.y < -this.radius * 2) this.reset(false);
    };

    this.draw = function() {
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      g.addColorStop(0,   `rgba(${this.color},${this.opacity})`);
      g.addColorStop(0.45,`rgba(${this.color},${this.opacity * 0.55})`);
      g.addColorStop(1,   `rgba(${this.color},0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(new MistParticle(true));

  ctx.globalCompositeOperation = 'lighter';

  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  })();
}

/* ── HEADING TERMINAL FLICKER ── */
/* Decodes heading text in from random terminal glyphs, like a console
   resolving a string, then re-flickers it on an ambient interval.
   Applies to the hero h1 and each section's main heading.
   Exposed on window so project.js can (re)trigger it once the real
   project title replaces the "Loading…" placeholder. */
window.TerminalFlicker = (function () {
  const CHARS = '!<>-_\\/[]{}=+*^?#01';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scramble(el, finalText, { duration = 650, attr } = {}) {
    if (reduceMotion || !finalText) {
      el.textContent = finalText;
      if (attr) el.setAttribute(attr, finalText);
      return;
    }

    const len   = finalText.length;
    const start = performance.now();
    el.classList.add('is-decoding');

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const revealCount = Math.floor(t * len);
      let out = '';
      for (let i = 0; i < len; i++) {
        out += (finalText[i] === ' ' || i < revealCount)
          ? finalText[i]
          : CHARS[(Math.random() * CHARS.length) | 0];
      }
      el.textContent = out;
      if (attr) el.setAttribute(attr, out);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = finalText;
        if (attr) el.setAttribute(attr, finalText);
        el.classList.remove('is-decoding');
      }
    }
    requestAnimationFrame(tick);
  }

  function arm(h1, { repeat = true } = {}) {
    if (!h1 || h1._flickerArmed) return;
    h1._flickerArmed = true;

    // Elements with data-text (e.g. hero__name-line spans) keep their
    // attribute in sync with the scrambled/resolved text.
    const lines   = h1.querySelectorAll('[data-text]');
    const targets = lines.length ? Array.from(lines) : [h1];

    targets.forEach(t => {
      t._flickerText = t.hasAttribute('data-text') ? t.getAttribute('data-text') : t.textContent;
    });

    function run() {
      targets.forEach(t => scramble(t, t._flickerText, {
        attr: t.hasAttribute('data-text') ? 'data-text' : null
      }));
    }

    run();
    if (repeat && !reduceMotion) {
      setInterval(run, 20000);
    }
  }

  const HEADING_SELECTOR = 'h1:not([data-flicker-manual]), h2.section__title:not([data-flicker-manual]), h2.about__heading';
  document.querySelectorAll(HEADING_SELECTOR).forEach(h1 => arm(h1));

  return { arm };
})();

/* ── TYPE-IN TEXT REVEAL ── */
/* Fades body copy in word by word, typewriter-style, once it scrolls
   into view. Words wrap in place around any existing inline markup
   (the red highlight spans in the about/websites copy) so only the
   opacity/position animate — colors and structure are untouched.
   Exposed on window so project.js can run it on description
   paragraphs it injects after this script has already scanned the DOM. */
window.TypeReveal = (function () {
  const STAGGER     = 25;  // ms between each word's reveal
  const MAX_STAGGER = 450; // cap so long paragraphs don't crawl
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-typed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  function wrapWords(node, counter) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (part === '') return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'word-fade';
          span.style.transitionDelay = Math.min(counter.i++ * STAGGER, MAX_STAGGER) + 'ms';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(child => wrapWords(child, counter));
    }
  }

  function run(el) {
    if (!el || el._typeArmed || !el.textContent.trim()) return;
    el._typeArmed = true;
    if (reduceMotion) return;

    wrapWords(el, { i: 0 });

    // Project card descriptions are hidden (opacity: 0) until the card
    // is hovered, so scroll-visibility isn't the right trigger for them —
    // type in on the first hover instead, once, like everything else.
    const card = el.closest('.project-card');
    if (card) {
      card.addEventListener('mouseenter', () => el.classList.add('is-typed'), { once: true });
      return;
    }

    // Delayed past the h1 terminal-scramble window (TerminalFlicker's
    // default duration is 650ms) before the first intersection check.
    // The scramble forces a monospace font on the title while it runs,
    // which briefly changes its line-wrap and shifts everything below
    // it — including, on project pages, this description. Observing too
    // early can catch that transient layout and mark an element that's
    // really below the fold as already-visible, permanently unobserving
    // it before it ever gets to animate.
    setTimeout(() => io.observe(el), 800);
  }

  document.querySelectorAll('.type-reveal').forEach(run);

  return { run };
})();

/* ── ABOUT DECK (draggable sticky cards) ── */
(function initAboutDeck() {
  const deck = document.getElementById('aboutDeck');
  if (!deck) return;
  const stack = deck.querySelector('.about-deck__stack');
  if (!stack) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE_MS = 20000;        // how long the dropped card lingers + fades
  let order = Array.from(stack.querySelectorAll('.about-card'));

  // Position every non-floating card into its slot in the stack.
  function applyStack() {
    order.forEach((card, i) => {
      if (card.dataset.floating === '1') return;
      const rot = i === 0 ? 0 : (i % 2 ? 2.4 : -2.4);
      card.style.zIndex = String(50 - i);
      card.style.transform = `translate(${i * 5}px, ${i * 12}px) rotate(${rot}deg)`;
      card.style.opacity = '1';
      card.classList.toggle('is-front', i === 0);
      card.style.cursor = i === 0 ? 'grab' : 'default';
    });
  }
  applyStack();

  let drag = null;

  stack.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button, .inspo-pill')) return;   // let links & pills work
    const card = e.target.closest('.about-card');
    if (!card) return;
    const floating = card.dataset.floating === '1';
    // Only the front card of the deck, or any card that's already floating,
    // can be picked up.
    if (!floating && card !== order[0]) return;

    // A floating card being re-grabbed: cancel its pending fade/return and
    // continue from wherever it currently sits.
    if (floating) {
      clearTimeout(card._deckTimer);
      card.style.opacity = '1';
    }
    const baseX = floating ? (card._tx || 0) : 0;
    const baseY = floating ? (card._ty || 0) : 0;

    drag = { card, id: e.pointerId, sx: e.clientX, sy: e.clientY,
             baseX, baseY, curX: baseX, curY: baseY, floating };
    card.setPointerCapture(e.pointerId);
    card.classList.add('is-dragging');
    card.style.transition = 'none';
    card.style.zIndex = '60';
    deck.classList.add('has-dragged', 'hint-gone');   // hint goes for good on first touch
  });

  stack.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.curX = drag.baseX + (e.clientX - drag.sx);
    drag.curY = drag.baseY + (e.clientY - drag.sy);
    const rot = Math.max(-14, Math.min(14, drag.curX * 0.05));
    drag.card.style.transform = `translate(${drag.curX}px, ${drag.curY}px) rotate(${rot}deg)`;
  });

  function startFade(card) {
    const tx = card._tx || 0, ty = card._ty || 0;
    const rot = Math.max(-14, Math.min(14, tx * 0.05));
    card.style.transition = 'none';
    card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    requestAnimationFrame(() => {
      card.style.transition = reduce ? 'none' : `opacity ${FADE_MS}ms linear`;
      card.style.opacity = reduce ? '1' : '0';
    });
    clearTimeout(card._deckTimer);
    card._deckTimer = setTimeout(() => {
      card.dataset.floating = '0';
      card.style.transition = 'transform 0.6s var(--ease-out), opacity 0.6s var(--ease-out)';
      applyStack();
      // Once every card is home again, bring the hint back.
      if (!stack.querySelector('.about-card[data-floating="1"]')) {
        deck.classList.remove('has-dragged');
      }
    }, reduce ? 0 : FADE_MS);
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const card = drag.card;
    const wasFloating = drag.floating;
    const curX = drag.curX, curY = drag.curY;
    const moved = Math.hypot(curX - drag.baseX, curY - drag.baseY) > 26;
    card.classList.remove('is-dragging');
    try { card.releasePointerCapture(drag.id); } catch (_) {}
    drag = null;

    // A tiny drag on the deck's front card is treated as a mis-click: snap back.
    if (!wasFloating && !moved) {
      card.style.transition = '';
      applyStack();
      return;
    }

    // Freeze wherever it was dropped and (re)start the 20s fade + return.
    card._tx = curX;
    card._ty = curY;
    card.dataset.floating = '1';
    card.classList.remove('is-front');

    if (!wasFloating) {
      // First time out of the deck: reveal the card beneath it.
      order = order.slice(1).concat(card);
      applyStack();
    }
    startFade(card);
  }

  stack.addEventListener('pointerup', endDrag);
  stack.addEventListener('pointercancel', endDrag);
})();

/* ── INSPIRATION PILLS: cartoon pop + particles on click ── */
(function initInspoPills() {
  const card = document.querySelector('.about-card--inspire');
  if (!card) return;
  const scatter = card.querySelector('.inspo-scatter');
  if (!scatter) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burst(pill) {
    if (reduce) return;
    const r = pill.getBoundingClientRect();
    const sr = scatter.getBoundingClientRect();
    const cx = r.left - sr.left + r.width / 2;
    const cy = r.top - sr.top + r.height / 2;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span');
      p.className = 'inspo-particle';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      scatter.appendChild(p);
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.6;
      const dist = 42 + Math.random() * 54;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
      ], { duration: 500 + Math.random() * 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
        .onfinish = () => p.remove();
    }
  }

  function popPill(pill, respawnMs) {
    burst(pill);
    pill.classList.add('is-popping');
    setTimeout(() => {
      pill.classList.remove('is-popping');
      pill.classList.add('is-hidden');
      setTimeout(() => {
        pill.classList.remove('is-hidden');
        // If the card has since faded out (dragged away), just restore silently.
        if (card.dataset.floating === '1') return;
        pill.classList.add('is-returning');
        setTimeout(() => pill.classList.remove('is-returning'), 520);
      }, respawnMs);
    }, 440);
  }

  /* ── 15-second bubble-pop mini-game ── */
  const gameEl = document.getElementById('inspoGame');
  const pills = Array.from(scatter.querySelectorAll('.inspo-pill'));
  const scoreB = gameEl && gameEl.querySelector('.inspo-game__score b');
  const timeB = gameEl && gameEl.querySelector('.inspo-game__time b');
  const resultB = gameEl && gameEl.querySelector('.inspo-game__result-score b');
  const DURATION = 15;
  let playing = false, score = 0, timeLeft = DURATION, tick = null;

  function startGame() {
    if (!gameEl) return;
    playing = true;
    score = 0;
    timeLeft = DURATION;
    if (scoreB) scoreB.textContent = '0';
    if (timeB) timeB.textContent = String(DURATION);
    gameEl.classList.remove('is-over');
    gameEl.classList.add('is-playing');
    card.classList.remove('is-over');
    card.classList.add('is-playing');
    // reset every bubble to a clean, clickable state
    pills.forEach(p => p.classList.remove('is-hidden', 'is-popping', 'is-returning'));

    clearInterval(tick);
    tick = setInterval(() => {
      timeLeft--;
      if (timeB) timeB.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  function endGame() {
    playing = false;
    clearInterval(tick);
    if (!gameEl) return;
    gameEl.classList.remove('is-playing');
    gameEl.classList.add('is-over');
    card.classList.remove('is-playing');
    card.classList.add('is-over');
    if (resultB) resultB.textContent = String(score);
  }

  if (gameEl) {
    gameEl.addEventListener('pointerup', e => {
      const btn = e.target.closest('[data-game="start"], [data-game="restart"]');
      if (btn) { e.preventDefault(); startGame(); }
    });
  }

  // Pop on pointerdown so taps register instantly on touch (click is laggy /
  // sometimes swallowed on mobile).
  let lastPop = 0;
  scatter.addEventListener('pointerdown', e => {
    const pill = e.target.closest('.inspo-pill');
    if (!pill || pill.classList.contains('is-hidden') || pill.classList.contains('is-popping')) return;
    // guard against the same touch firing twice
    const now = e.timeStamp || Date.now();
    if (now - lastPop < 40) return;
    lastPop = now;
    e.preventDefault();

    if (playing) {
      score++;
      if (scoreB) scoreB.textContent = String(score);
      popPill(pill, 500 + Math.random() * 700);   // bubbles reappear fast during play
    } else {
      popPill(pill, 5000);
    }
  });
})();

/* ── SMOOTH ANCHOR SCROLL (cross-browser fallback) ── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
