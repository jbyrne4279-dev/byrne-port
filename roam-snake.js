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

  const CELL = 24, STEP_MS = 170, MIN_LEN = 10, MAX_LEN = 20;

  const canvas = document.createElement('canvas');
  canvas.className = 'roam-snake';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');

  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'roam-snake__tag';
  tag.textContent = 'Click me';
  tag.setAttribute('aria-label', 'Play snake');
  let hoverTag = false;
  tag.addEventListener('pointerenter', () => { hoverTag = true; });
  tag.addEventListener('pointerleave', () => { hoverTag = false; });
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
    tagX = tagY = null;
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
    const y = Math.floor(rows * 0.75), x = Math.min(MIN_LEN + 1, cols - 1);
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

  /* ── Drawing: a smooth, glossy cartoon snake ──
     The body is one rounded tube through the segment centres: a dark
     outline, a red gradient from head to tail, and a glossy highlight
     along the back. It tapers to a pointed tail that wags as it slithers,
     and the head has big eyes and a tongue that flicks out now and then. */
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const HEAD_RGB = [255, 77, 94], TAIL_RGB = [176, 18, 42];

  function render(now) {
    const k = Math.min(1, (now - lastStep) / STEP_MS);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, bandH);

    // apple: glossy green with a leaf, gently bobbing
    if (apple) {
      const ax = (apple[0] + 0.5) * CELL, ay = (apple[1] + 0.5) * CELL + Math.sin(now / 300) * 1.5;
      ctx.shadowColor = 'rgba(39, 208, 127, 0.55)'; ctx.shadowBlur = 8 * dpr;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(ax, ay + 1, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(ax - CELL * 0.1, ay - CELL * 0.08, CELL * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f7a3f';
      ctx.beginPath(); ctx.ellipse(ax + CELL * 0.12, ay - CELL * 0.32, CELL * 0.13, CELL * 0.06, -0.6, 0, Math.PI * 2); ctx.fill();
    }

    // segment centres this frame (gliding between cells)
    const n = snake.length;
    const C = snake.map((b, i) => {
      const a = prev[i] || b;
      return [(a[0] + (b[0] - a[0]) * k + 0.5) * CELL, (a[1] + (b[1] - a[1]) * k + 0.5) * CELL];
    });
    // dense points along the body so it reads as one smooth tube
    const pts = [];
    const SUB = 14;
    for (let i = 0; i < n - 1; i++) {
      for (let s2 = 0; s2 < SUB; s2++) {
        const u = s2 / SUB;
        pts.push([C[i][0] + (C[i + 1][0] - C[i][0]) * u, C[i][1] + (C[i + 1][1] - C[i][1]) * u, (i + u) / (n - 1)]);
      }
    }
    pts.push([C[n - 1][0], C[n - 1][1], 1]);
    // tail wag: a sideways wave that grows towards the tip
    for (let q = 0; q < pts.length; q++) {
      const p = pts[q], t = p[2];
      if (t < 0.45) continue;
      const a = pts[Math.max(0, q - 1)], b = pts[Math.min(pts.length - 1, q + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const amt = Math.sin(now / 150 - t * 9) * CELL * 0.22 * Math.pow((t - 0.45) / 0.55, 1.5);
      p[3] = p[0] - dy * amt; p[4] = p[1] + dx * amt;
    }
    const X = p => (p[3] != null ? p[3] : p[0]), Y = p => (p[4] != null ? p[4] : p[1]);
    const R = CELL * 0.4;
    const rad = t => R * (t < 0.55 ? 1 : 1 - 0.92 * Math.pow((t - 0.55) / 0.45, 1.3));   // pointed tail

    const gulpAt = (now - pulseAt) / STEP_MS / Math.max(1, n - 1);
    // outline, then the red body, tail first so the head sits on top
    ctx.fillStyle = '#6E0C1B';
    for (let q = pts.length - 1; q >= 0; q--) { const p = pts[q]; ctx.beginPath(); ctx.arc(X(p), Y(p), rad(p[2]) + 1.6, 0, Math.PI * 2); ctx.fill(); }
    for (let q = pts.length - 1; q >= 0; q--) {
      const p = pts[q], t = p[2];
      const bulge = gulpAt < 1.15 ? Math.exp(-((t - gulpAt) ** 2) / 0.004) * 0.35 : 0;   // a gulp travels down
      const c = mix(HEAD_RGB, TAIL_RGB, t);
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(X(p), Y(p), rad(t) * (1 + bulge), 0, Math.PI * 2); ctx.fill();
    }
    // glossy highlight along the back (solid colours, so no beading where they overlap)
    for (let q = pts.length - 1; q >= 0; q--) {
      const p = pts[q], t = p[2];
      if (t > 0.88) continue;
      const c = mix(mix(HEAD_RGB, TAIL_RGB, t), [255, 255, 255], 0.32 * (1 - t));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(X(p) - rad(t) * 0.18, Y(p) - rad(t) * 0.36, rad(t) * 0.3, 0, Math.PI * 2); ctx.fill();
    }

    // head: a little bigger, with big eyes facing forward and a flicking tongue
    const [hdx, hdy] = C[0], ang = Math.atan2(dir[1], dir[0]);
    ctx.save();
    ctx.translate(hdx, hdy); ctx.rotate(ang);
    if ((now % 2400) < 300) {
      ctx.strokeStyle = '#FF2D55'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(R * 0.9, 0); ctx.lineTo(R * 1.7, 0);
      ctx.moveTo(R * 1.7, 0); ctx.lineTo(R * 2.05, -R * 0.3);
      ctx.moveTo(R * 1.7, 0); ctx.lineTo(R * 2.05, R * 0.3); ctx.stroke();
    }
    ctx.fillStyle = '#6E0C1B';
    ctx.beginPath(); ctx.ellipse(R * 0.15, 0, R * 1.22 + 1.6, R * 1.08 + 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${HEAD_RGB.join(',')})`;
    ctx.beginPath(); ctx.ellipse(R * 0.15, 0, R * 1.22, R * 1.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-R * 0.1, -R * 0.5, R * 0.5, R * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    const blink = (now % 4200) < 140;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(R * 0.55, sd * R * 0.48, R * 0.36, blink ? R * 0.06 : R * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#1A0306';
        ctx.beginPath(); ctx.arc(R * 0.68, sd * R * 0.46, R * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(R * 0.62, sd * R * 0.4, R * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // little green sparks when an apple is eaten
    sparks = sparks.filter(p => now - p.born < 500);
    for (const p of sparks) {
      const q = (now - p.born) / 500, d = (now - p.born) / 16;
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(p.x + p.vx * d * 1.6, p.y + p.vy * d * 1.6, 2 * (1 - q * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // "Click me" glides after the head (eased so it's an easy target)
    const h0 = prev[0] || snake[0], h1 = snake[0];
    const hx = (h0[0] + (h1[0] - h0[0]) * k + 0.5) * CELL, hy = (h0[1] + (h1[1] - h0[1]) * k + 0.5) * CELL;
    const tx = hx, ty = bandTop + hy - CELL * 1.2;
    if (!hoverTag) {                      // hold still under the pointer
      tagX = tagX == null ? tx : tagX + (tx - tagX) * 0.3;
      tagY = tagY == null ? ty : tagY + (ty - tagY) * 0.3;
    }
    tag.style.transform = `translate(${tagX.toFixed(1)}px, ${tagY.toFixed(1)}px) translate(-50%, -100%)`;
    if (++checkN % 2 === 0) tag.classList.toggle('is-off', tagOverControl());
  }
  let tagX = null, tagY = null;
  let checkN = 0;
  function tagOverControl() {
    const r = tag.getBoundingClientRect();
    if (!r.width) return false;
    const prevVis = tag.style.visibility;
    tag.style.visibility = 'hidden';
    const xs = [r.left - 6, r.left + r.width / 2, r.right + 6], ys = [r.top - 6, r.top + r.height / 2, r.bottom + 6];
    let over = false;
    for (const x of xs) for (const y of ys) {
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('a, button, input, select, textarea, label, [role="button"], .site-card, .cfs__card, .about-card, .gallery')) { over = true; break; }
    }
    tag.style.visibility = prevVis;
    return over;
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
      if (!lastStep || hoverTag) lastStep = now - (hoverTag ? STEP_MS * 0.999 : 0);   // hold still while hovered
      while (!hoverTag && now - lastStep >= STEP_MS) { step(now); lastStep += STEP_MS; if (now - lastStep > 1000) lastStep = now; }
      render(now);
    } else {
      lastStep = 0;
    }
    requestAnimationFrame(loop);
  }

  let rt;
  // Phones fire 'resize' whenever the address bar slides in or out while
  // scrolling; only a real change of width should move the snake
  let lastW = innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(innerWidth - lastW) < 2) return;
    lastW = innerWidth;
    clearTimeout(rt); rt = setTimeout(() => moveTo(host || bestHost()), 200);
  });
  moveTo(bestHost());
  requestAnimationFrame(loop);
})();
