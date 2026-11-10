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

  const CELL = 16, STEP_MS = 150, MIN_LEN = 5, MAX_LEN = 14;

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

  /* ── Drawing: a little pixel-art snake ──
     Each cell is an 8 x 8 sprite of 2px pixels. The head is drawn facing
     right and turned to face where it's going; its tongue flicks out now
     and then. Positions snap to whole pixels so it stays crisp. */
  const PX = CELL / 8;
  const PAL = {
    O: '#4A0A12',   // outline
    B: '#D91F3A',   // body
    H: '#FF5C6C',   // highlight
    S: '#9E1328',   // scales
    W: '#FFFFFF',   // eye white
    K: '#1A0306',   // pupil
    T: '#FF2D55',   // tongue
    g: '#2EE082', d: '#0F7A3F', l: '#B8FFD9', s: '#6B3E1E'
  };
  const HEAD = [
    '.OOOOO..',
    'OHHHHHOO',
    'OHBBWWKO',
    'OBBBWWKO',
    'OBBBBBBS',
    'OBBBWWKO',
    'OHBBWWKO',
    '.OOOOOO.'
  ];
  const BODY_A = [
    '.OOOOOO.',
    'OHHBBHHO',
    'OBSBBSBO',
    'OBBBBBBO',
    'OBBSBBBO',
    'OBSBBSBO',
    'OBBBBBBO',
    '.OOOOOO.'
  ];
  const BODY_B = [
    '.OOOOOO.',
    'OHBBHHBO',
    'OBBSBBBO',
    'OBSBBSBO',
    'OBBBBBBO',
    'OBBSBBSO',
    'OBBBBBBO',
    '.OOOOOO.'
  ];
  const TAIL = [
    '........',
    '..OOOO..',
    '.OHHBBO.',
    '.OBSBBO.',
    '.OBBSBO.',
    '.OBBBBO.',
    '..OOOO..',
    '........'
  ];
  const APPLE = [
    '....d...',
    '...sdd..',
    '.gggsgg.',
    'gglggggg',
    'glgggggg',
    'gggggggd',
    '.gggggd.',
    '..gg.gg.'
  ];
  function sprite(map, x, y, rot, flash) {
    ctx.save();
    ctx.translate(Math.round(x + CELL / 2), Math.round(y + CELL / 2));
    if (rot) ctx.rotate(rot);
    for (let r = 0; r < 8; r++) {
      const row = map[r];
      for (let c = 0; c < 8; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        let col = PAL[ch];
        if (flash && (ch === 'B' || ch === 'S')) col = PAL.H;
        ctx.fillStyle = col;
        ctx.fillRect(-CELL / 2 + c * PX, -CELL / 2 + r * PX, PX, PX);
      }
    }
    ctx.restore();
  }
  const angle = ([dx, dy]) => Math.atan2(dy, dx);

  function render(now) {
    const k = Math.min(1, (now - lastStep) / STEP_MS);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, bandH);

    if (apple) {
      const bob = Math.round(Math.sin(now / 280) * 1.5) * PX * 0.5;
      sprite(APPLE, apple[0] * CELL, apple[1] * CELL + bob, 0, false);
    }

    // positions of every segment this frame (gliding between cells, pixel-snapped)
    const pos = snake.map((b, i) => {
      const a = prev[i] || b;
      return [Math.round((a[0] + (b[0] - a[0]) * k) * CELL / PX) * PX, Math.round((a[1] + (b[1] - a[1]) * k) * CELL / PX) * PX];
    });
    const gulpAt = (now - pulseAt) / STEP_MS;
    const n = pos.length;
    const thick = i => (i === n - 1 ? 4 : i === n - 2 ? 6 : 8) * PX;   // the tail tapers
    // one continuous body: an outline pass, then the fill on top, then scales
    const blob = (pad, i) => {
      const [x, y] = pos[i], t = thick(i), o = (CELL - t) / 2;
      ctx.fillRect(x + o + pad, y + o + pad, t - pad * 2, t - pad * 2);
      if (i > 0) {                                    // bridge to the segment in front
        const [px, py] = pos[i - 1], tt = Math.min(t, thick(i - 1)), oo = (CELL - tt) / 2;
        const x0 = Math.min(x, px), y0 = Math.min(y, py), x1 = Math.max(x, px), y1 = Math.max(y, py);
        ctx.fillRect(x0 + oo + pad, y0 + oo + pad, x1 - x0 + tt - pad * 2, y1 - y0 + tt - pad * 2);
      }
    };
    ctx.fillStyle = PAL.O;
    for (let i = n - 1; i >= 1; i--) blob(0, i);
    for (let i = n - 1; i >= 1; i--) {
      const flash = gulpAt < n + 1 && Math.abs(gulpAt - i) < 0.8;
      ctx.fillStyle = flash ? PAL.H : PAL.B;
      blob(PX, i);
    }
    for (let i = 1; i < n - 1; i++) {                 // diamond scale pattern + a highlight
      const [x, y] = pos[i], c = CELL / 2;
      ctx.fillStyle = PAL.S;
      ctx.fillRect(x + c - PX, y + c - PX * (i % 2 ? 2 : 0), PX, PX);
      ctx.fillRect(x + c + PX * (i % 2 ? 1 : -2), y + c + PX, PX, PX);
      ctx.fillStyle = PAL.H;
      ctx.fillRect(x + c - PX * 2, y + PX * 1.5 + (CELL - thick(i)) / 2, PX * 2, PX);
    }

    // the head on top, facing where it's going, with a tongue that flicks out
    const [hx0, hy0] = pos[0];
    sprite(HEAD, hx0, hy0, angle(dir), false);
    if ((now % 2200) < 260) {
      ctx.save();
      ctx.translate(hx0 + CELL / 2, hy0 + CELL / 2);
      ctx.rotate(angle(dir));
      ctx.fillStyle = PAL.T;
      ctx.fillRect(CELL / 2, -PX / 2, PX * 2, PX);
      ctx.fillRect(CELL / 2 + PX * 2, -PX * 1.5, PX, PX);
      ctx.fillRect(CELL / 2 + PX * 2, PX * 0.5, PX, PX);
      ctx.restore();
    }

    // pixel sparks when an apple is eaten
    sparks = sparks.filter(p => now - p.born < 500);
    for (const p of sparks) {
      const q = (now - p.born) / 500, d = (now - p.born) / 16;
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = q < 0.5 ? PAL.l : PAL.g;
      ctx.fillRect(Math.round(p.x + p.vx * d * 1.6), Math.round(p.y + p.vy * d * 1.6), PX, PX);
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
  }
  let tagX = null, tagY = null;

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
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => moveTo(host || bestHost()), 200); });
  moveTo(bestHost());
  requestAnimationFrame(loop);
})();
