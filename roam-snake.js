/* ============================================================
   ROAMING SNAKE | roam-snake.js
   A hidden gem: a tiny snake, drawn like the idle-screen game, glides
   around one section of the homepage at a time, hunting little green
   apples. It lives inside that section, so it scrolls away with it;
   once its section has been off screen for a moment it moves into the
   section you're looking at. A flashing "Click me" floats above its
   head and opens the full snake game.
   Never blocks clicks (apart from the label), pauses when the tab is
   hidden or the game is showing, and doesn't run for reduced motion.
   ============================================================ */
'use strict';

(function initRoamingSnake() {
  if (!document.getElementById('home')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const HOSTS = ['home', 'about', 'portfolio', 'websites', 'tools', 'contact']
    .map(id => document.getElementById(id)).filter(Boolean);
  if (!HOSTS.length) return;

  const CELL = 12, STEP_MS = 135, MIN_LEN = 5, MAX_LEN = 14;

  const canvas = document.createElement('canvas');
  canvas.className = 'roam-snake';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');

  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'roam-snake__tag';
  tag.textContent = 'Click me';
  tag.setAttribute('aria-label', 'Play snake');
  tag.addEventListener('click', e => {
    e.preventDefault();
    if (window.__jbOpenSnake) window.__jbOpenSnake();
  });

  let host = null, bandTop = 0, bandH = 0, w = 0;
  let dpr = 1, cols = 0, rows = 0;
  let snake = [], prev = [], dir = [1, 0], apple = null, grow = 0;
  let lastStep = 0, pulseAt = -1e9, sparks = [], offSince = 0;

  /* ── Which section it lives in, and the band of that section it roams ── */
  function visibleArea(el) {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  }
  function moveTo(el) {
    host = el;
    host.classList.add('roam-host');
    const r = el.getBoundingClientRect();
    w = el.clientWidth;
    bandH = Math.min(el.offsetHeight, Math.max(320, innerHeight));
    // put the band over the part of the section that's on screen now
    const onScreenTop = Math.max(0, -r.top);
    bandTop = Math.max(0, Math.min(onScreenTop, el.offsetHeight - bandH));
    canvas.style.top = bandTop + 'px';
    canvas.style.height = bandH + 'px';
    host.appendChild(canvas);
    host.appendChild(tag);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(bandH * dpr);
    cols = Math.floor(w / CELL);
    rows = Math.floor(bandH / CELL);
    reset();
  }
  function bestHost() {
    let best = HOSTS[0], area = -1;
    HOSTS.forEach(el => { const a = visibleArea(el); if (a > area) { area = a; best = el; } });
    return best;
  }
  function bandOnScreen() {
    if (!host) return false;
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }

  /* ── Snake ── */
  function reset() {
    const y = Math.floor(rows * 0.75), x = Math.min(4, cols - 1);
    snake = Array.from({ length: MIN_LEN }, (_, i) => [Math.max(0, x - i), y]);
    prev = snake.map(s => s.slice());
    dir = [1, 0]; grow = 0;
    placeApple();
  }
  const onSnake = (x, y) => snake.some(s => s[0] === x && s[1] === y);
  function placeApple() {
    for (let i = 0; i < 50; i++) {
      const x = 2 + Math.floor(Math.random() * Math.max(1, cols - 4));
      const y = 3 + Math.floor(Math.random() * Math.max(1, rows - 6));
      if (!onSnake(x, y)) { apple = [x, y]; return; }
    }
    apple = [Math.floor(cols / 2), Math.floor(rows / 2)];
  }
  function chooseDir() {
    const [hx, hy] = snake[0];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !(d[0] === -dir[0] && d[1] === -dir[1]));
    const safe = options.filter(([dx, dy]) => {
      const nx = hx + dx, ny = hy + dy;
      return nx >= 0 && ny >= 2 && nx < cols && ny < rows && !snake.slice(0, -1).some(s => s[0] === nx && s[1] === ny);
    });
    if (!safe.length) return null;
    const dist = ([dx, dy]) => Math.abs(hx + dx - apple[0]) + Math.abs(hy + dy - apple[1]);
    safe.sort((a, b) => dist(a) - dist(b));
    const straight = safe.find(d => d[0] === dir[0] && d[1] === dir[1]);
    if (straight && dist(straight) <= dist(safe[0]) + 1 && Math.random() < 0.35) return straight;
    return safe[0];
  }
  function step(now) {
    const d = chooseDir();
    if (!d) { reset(); return; }
    dir = d;
    prev = snake.map(s => s.slice());
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    snake.unshift(head);
    if (head[0] === apple[0] && head[1] === apple[1]) {
      grow += 2; pulseAt = now; burst(head); placeApple();
    }
    if (grow > 0) { grow--; prev.push(prev[prev.length - 1]); }
    else snake.pop();
    if (snake.length > MAX_LEN) { snake.length = MIN_LEN; prev.length = MIN_LEN; }
  }
  function burst([x, y]) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.4;
      sparks.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: performance.now() });
    }
  }

  /* ── Drawing ── */
  function roundRect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
  }
  function render(now) {
    const k = Math.min(1, (now - lastStep) / STEP_MS);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, bandH);

    if (apple) {
      const ax = (apple[0] + 0.5) * CELL, ay = (apple[1] + 0.5) * CELL, br = 1 + Math.sin(now / 300) * 0.06;
      ctx.shadowColor = 'rgba(39, 208, 127, 0.8)'; ctx.shadowBlur = 8 * dpr;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(ax, ay + CELL * 0.04, CELL * 0.34 * br, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f7a3f';
      ctx.beginPath(); ctx.ellipse(ax + CELL * 0.12, ay - CELL * 0.32, CELL * 0.13, CELL * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    }

    const pad = CELL * 0.1, age = (now - pulseAt) / 45;
    ctx.shadowColor = 'rgba(255, 69, 58, 0.6)'; ctx.shadowBlur = 6 * dpr;
    for (let i = snake.length - 1; i >= 0; i--) {
      const a = prev[i] || snake[i], b = snake[i];
      const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
      const t = i / Math.max(1, snake.length - 1);
      const bulge = age < snake.length + 6 ? 0.3 * Math.exp(-((age - i) ** 2) / 3) : 0;
      const sz = (CELL - pad * 2) * (1 + bulge), off = (CELL - sz) / 2;
      ctx.fillStyle = i === 0 ? '#FF6961' : `rgb(${Math.round(224 - t * 90)}, ${Math.round(20 - t * 10)}, ${Math.round(60 - t * 25)})`;
      roundRect(x * CELL + off, y * CELL + off, sz, sz, CELL * 0.28);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const h0 = prev[0] || snake[0], h1 = snake[0];
    const hx = (h0[0] + (h1[0] - h0[0]) * k + 0.5) * CELL, hy = (h0[1] + (h1[1] - h0[1]) * k + 0.5) * CELL;
    const ex = -dir[1], ey = dir[0];
    ctx.fillStyle = '#fff';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + dir[0] * CELL * 0.16 + ex * sd * CELL * 0.17, hy + dir[1] * CELL * 0.16 + ey * sd * CELL * 0.17, CELL * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    sparks = sparks.filter(p => now - p.born < 500);
    for (const p of sparks) {
      const q = (now - p.born) / 500, d = (now - p.born) / 16;
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(p.x + p.vx * d * 1.6, p.y + p.vy * d * 1.6, 1.6 * (1 - q * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // "Click me" floats just above the head
    tag.style.transform = `translate(${hx.toFixed(1)}px, ${(bandTop + hy - CELL * 1.4).toFixed(1)}px) translate(-50%, -100%)`;
  }

  const paused = () => document.hidden || document.documentElement.classList.contains('cv-open') ||
    (document.getElementById('screensaver') || {}).classList?.contains('is-active');

  function loop(now) {
    if (!paused()) {
      // its section has gone off screen for a while: move into the one in view
      if (!bandOnScreen()) {
        if (!offSince) offSince = now;
        if (now - offSince > 1200) { offSince = 0; moveTo(bestHost()); lastStep = now; }
      } else offSince = 0;
      if (!lastStep) lastStep = now;
      while (now - lastStep >= STEP_MS) { step(now); lastStep += STEP_MS; if (now - lastStep > 1000) lastStep = now; }
      render(now);
    } else {
      lastStep = 0;
    }
    requestAnimationFrame(loop);
  }

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => moveTo(host || bestHost()), 200); });
  moveTo(bestHost());
  requestAnimationFrame(loop);
})();
