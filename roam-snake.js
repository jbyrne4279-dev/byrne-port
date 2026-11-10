/* ============================================================
   ROAMING SNAKE | roam-snake.js
   A hidden gem: a tiny snake, drawn like the idle-screen game, glides
   around the homepage on its own, hunting little green apples. It
   grows as it eats, then sheds back down and carries on. It never
   blocks clicks, pauses when the tab is hidden or the idle game is
   showing, and doesn't run for reduced motion.
   ============================================================ */
'use strict';

(function initRoamingSnake() {
  if (!document.getElementById('home')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'roam-snake';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const CELL = 12, STEP_MS = 135, MIN_LEN = 5, MAX_LEN = 14;
  let dpr = 1, cols = 0, rows = 0;
  let snake = [], prev = [], dir = [1, 0], apple = null, grow = 0;
  let lastStep = 0, pulseAt = -1e9, sparks = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    cols = Math.floor(innerWidth / CELL);
    rows = Math.floor(innerHeight / CELL);
    if (!snake.length || snake.some(([x, y]) => x >= cols || y >= rows)) reset();
    if (apple && (apple[0] >= cols || apple[1] >= rows)) placeApple();
  }

  function reset() {
    const y = Math.floor(rows * 0.8), x = 4;
    snake = Array.from({ length: MIN_LEN }, (_, i) => [x - i, y]);
    prev = snake.map(s => s.slice());
    dir = [1, 0];
    placeApple();
  }

  const onSnake = (x, y) => snake.some(s => s[0] === x && s[1] === y);
  function placeApple() {
    // keep apples off the very edges and away from the nav bar
    for (let i = 0; i < 50; i++) {
      const x = 2 + Math.floor(Math.random() * Math.max(1, cols - 4));
      const y = 8 + Math.floor(Math.random() * Math.max(1, rows - 11));
      if (!onSnake(x, y)) { apple = [x, y]; return; }
    }
    apple = [Math.floor(cols / 2), Math.floor(rows / 2)];
  }

  // Head for the apple, with a little wandering; never turn back or hit itself
  function chooseDir() {
    const [hx, hy] = snake[0];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !(d[0] === -dir[0] && d[1] === -dir[1]));
    const safe = options.filter(([dx, dy]) => {
      const nx = hx + dx, ny = hy + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !snake.slice(0, -1).some(s => s[0] === nx && s[1] === ny);
    });
    if (!safe.length) return null;
    const dist = ([dx, dy]) => Math.abs(hx + dx - apple[0]) + Math.abs(hy + dy - apple[1]);
    safe.sort((a, b) => dist(a) - dist(b));
    // mostly take the best move, sometimes keep going straight for a natural glide
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
      grow += 2;
      pulseAt = now;
      burst(head);
      placeApple();
    }
    if (grow > 0) { grow--; prev.push(prev[prev.length - 1]); }
    else snake.pop();
    // once it's long enough it sheds back down to a small snake
    if (snake.length > MAX_LEN) { snake.length = MIN_LEN; prev.length = MIN_LEN; }
  }

  function burst([x, y]) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.4;
      sparks.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: performance.now() });
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function render(now) {
    const k = Math.min(1, (now - lastStep) / STEP_MS);   // glide between cells
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // apple with a leaf, gently breathing
    if (apple) {
      const ax = (apple[0] + 0.5) * CELL, ay = (apple[1] + 0.5) * CELL, br = 1 + Math.sin(now / 300) * 0.06;
      ctx.shadowColor = 'rgba(39, 208, 127, 0.8)'; ctx.shadowBlur = 8 * dpr;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(ax, ay + CELL * 0.04, CELL * 0.34 * br, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f7a3f';
      ctx.beginPath(); ctx.ellipse(ax + CELL * 0.12, ay - CELL * 0.32, CELL * 0.13, CELL * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    }

    // snake: brightest at the head, a gulp ripples down it after eating
    const pad = CELL * 0.1, age = (now - pulseAt) / 45;
    ctx.shadowColor = 'rgba(255, 69, 58, 0.6)'; ctx.shadowBlur = 6 * dpr;
    for (let i = snake.length - 1; i >= 0; i--) {
      const a = prev[i] || snake[i], b = snake[i];
      const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
      const t = i / Math.max(1, snake.length - 1);
      const bulge = age < snake.length + 6 ? 0.3 * Math.exp(-((age - i) ** 2) / 3) : 0;
      const s = (CELL - pad * 2) * (1 + bulge), off = (CELL - s) / 2;
      ctx.fillStyle = i === 0 ? '#FF6961' : `rgb(${Math.round(224 - t * 90)}, ${Math.round(20 - t * 10)}, ${Math.round(60 - t * 25)})`;
      roundRect(x * CELL + off, y * CELL + off, s, s, CELL * 0.28);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // eyes
    const h0 = prev[0] || snake[0], h1 = snake[0];
    const hx = (h0[0] + (h1[0] - h0[0]) * k + 0.5) * CELL, hy = (h0[1] + (h1[1] - h0[1]) * k + 0.5) * CELL;
    const ex = -dir[1], ey = dir[0];
    ctx.fillStyle = '#fff';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + dir[0] * CELL * 0.16 + ex * sd * CELL * 0.17, hy + dir[1] * CELL * 0.16 + ey * sd * CELL * 0.17, CELL * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // little green sparks when an apple is eaten
    sparks = sparks.filter(p => now - p.born < 500);
    for (const p of sparks) {
      const q = (now - p.born) / 500, d = (now - p.born) / 16;
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(p.x + p.vx * d * 1.6, p.y + p.vy * d * 1.6, 1.6 * (1 - q * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const paused = () => document.hidden || document.documentElement.classList.contains('cv-open') ||
    (document.getElementById('screensaver') || {}).classList?.contains('is-active');

  function loop(now) {
    if (!paused()) {
      if (!lastStep) lastStep = now;
      while (now - lastStep >= STEP_MS) { step(now); lastStep += STEP_MS; if (now - lastStep > 1000) lastStep = now; }
      render(now);
    } else {
      lastStep = 0;
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
