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
  // Not on phones and tablets: the snake and its game are a desktop easter egg
  if (window.matchMedia('(max-width: 768px), (hover: none), (pointer: coarse)').matches) return;

  const HOSTS = ['about', 'portfolio', 'websites', 'tools', 'contact']   // never the hero
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
  let hoverTag = false, lastC = [];
  // Click any part of the snake to play: the canvas ignores the pointer so the
  // page stays usable, so this checks whether a click lands on the snake
  function onSnakeAt(clientX, clientY) {
    if (!host || !lastC.length) return false;
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    if (x < -CELL || y < -CELL || x > r.width + CELL || y > r.height + CELL) return false;
    return lastC.some(([sx, sy], i) => Math.hypot(x - sx, y - sy) < CELL * (i === 0 ? 0.75 : 0.62));
  }
  let overSnake = false;
  document.addEventListener('pointermove', e => {
    const on = onSnakeAt(e.clientX, e.clientY);
    if (on !== overSnake) { overSnake = on; document.documentElement.classList.toggle('snake-hover', on); }
  }, { passive: true });
  document.addEventListener('click', e => {
    if (!onSnakeAt(e.clientX, e.clientY) || e.target.closest('.roam-snake__tag')) return;
    e.preventDefault(); e.stopPropagation();
    if (window.__jbOpenSnake) window.__jbOpenSnake();
  }, true);
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
  let nextTrip = performance.now() + 45000 + Math.random() * 60000;
  let eaten = null, appleBorn = -1e9;   // the apple being swallowed, and when the next one appeared

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
    bandTop = Math.round(Math.random() * Math.max(0, el.offsetHeight - bandH));
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
  /* ── Keep clear of the page: a map of cells covered by content ──
     Images, videos, buttons, links, cards and the actual lines of text are
     marked as blocked; the snake steers around them and apples only appear
     in clear space. Re-checked every second or so, as things move. */
  const ASSETS = 'img, video, svg, canvas:not(.roam-snake):not(.hero__matrix):not(.hero__mist), button, a, input, select, textarea, ' +
    '.site-card, .project-card, .cfs__card, .about-card, .gallery__item, .inspo-pill, .contact__icon, .device, .btn';
  const TEXT = 'h1, h2, h3, h4, p, li, .section__label, .contact__link-value, .site-card__name, .site-card__url, .hero__tagline';
  let blocked = new Uint8Array(0);
  const idx = (x, y) => y * cols + x;
  function scanAssets() {
    blocked = new Uint8Array(cols * rows);
    if (!host) return;
    const cr = canvas.getBoundingClientRect();
    const mark = r => {
      if (r.width < 1 || r.height < 1 || r.bottom < cr.top || r.top > cr.bottom || r.right < cr.left || r.left > cr.right) return;
      const pad = 6;
      const x0 = Math.max(0, Math.floor((r.left - cr.left - pad) / CELL)), x1 = Math.min(cols - 1, Math.floor((r.right - cr.left + pad) / CELL));
      const y0 = Math.max(0, Math.floor((r.top - cr.top - pad) / CELL)), y1 = Math.min(rows - 1, Math.floor((r.bottom - cr.top + pad) / CELL));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[idx(x, y)] = 1;
    };
    host.querySelectorAll(ASSETS).forEach(el => { if (el !== tag && el !== canvas) mark(el.getBoundingClientRect()); });
    const range = document.createRange();
    host.querySelectorAll(TEXT).forEach(el => {
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) mark(r);
    });
  }
  const inBounds = (x, y) => x >= 0 && y >= 1 && x < cols && y < rows;
  const isFree = (x, y) => inBounds(x, y) && !blocked[idx(x, y)];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Breadth-first search over clear cells: the first move on the shortest
  // route to (gx, gy), or null if it can't be reached
  function routeTo(gx, gy) {
    const [hx, hy] = snake[0];
    const body = new Set(snake.slice(0, -1).map(([x, y]) => idx(x, y)));
    const from = new Int32Array(cols * rows).fill(-1);
    const start = idx(hx, hy), goal = idx(gx, gy);
    const q = [start]; from[start] = start;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      if (c === goal) break;
      const cx = c % cols, cy = (c / cols) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, n2 = idx(nx, ny);
        if (!isFree(nx, ny) || from[n2] !== -1 || body.has(n2)) continue;
        from[n2] = c; q.push(n2);
      }
    }
    if (from[goal] === -1) return null;
    let c = goal;
    while (from[c] !== start) c = from[c];
    return [c % cols - hx, ((c / cols) | 0) - hy];
  }
  function reachable() {
    const [hx, hy] = snake[0];
    const seen = new Uint8Array(cols * rows), out = [];
    const q = [idx(hx, hy)]; seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % cols, cy = (c / cols) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!isFree(nx, ny) || seen[idx(nx, ny)]) continue;
        seen[idx(nx, ny)] = 1; q.push(idx(nx, ny)); out.push([nx, ny]);
      }
    }
    return out;
  }

  function reset() {
    scanAssets();
    // start on a clear row, as close to three quarters down as possible
    const want = MIN_LEN + 2;
    let sx = Math.min(MIN_LEN + 1, cols - 1), sy = Math.floor(rows * 0.75);
    search: for (let o = 0; o < rows; o++) {
      for (const y of [Math.floor(rows * 0.75) + o, Math.floor(rows * 0.75) - o]) {
        if (y < 1 || y >= rows) continue;
        let run = 0;
        for (let x = 0; x < cols; x++) {
          run = isFree(x, y) ? run + 1 : 0;
          if (run >= want) { sx = x - 1; sy = y; break search; }
        }
      }
    }
    snake = Array.from({ length: MIN_LEN }, (_, i) => [Math.max(0, sx - i), sy]);
    prev = snake.map(s => s.slice());
    dir = [1, 0]; grow = 0;
    placeApple();
  }
  const onSnake = (x, y) => snake.some(s => s[0] === x && s[1] === y);
  function placeApple() {
    // somewhere clear that the snake can actually get to, not right under its nose
    const [hx, hy] = snake[0] || [0, 0];
    const spots = reachable().filter(([x, y]) => !onSnake(x, y) && y >= 2 && Math.abs(x - hx) + Math.abs(y - hy) >= 5);
    if (spots.length) { apple = spots[(Math.random() * spots.length) | 0]; return; }
    for (let i = 0; i < 80; i++) {
      const x = 1 + Math.floor(Math.random() * Math.max(1, cols - 2));
      const y = 2 + Math.floor(Math.random() * Math.max(1, rows - 3));
      if (isFree(x, y) && !onSnake(x, y)) { apple = [x, y]; return; }
    }
    apple = null;                                   // nowhere clear: just wander
  }
  function chooseDir() {
    const [hx, hy] = snake[0];
    if (apple) { const d = routeTo(apple[0], apple[1]); if (d) return d; }
    // no route: keep moving through clear space, preferring to go straight
    const body = snake.slice(0, -1);
    const ok = ([dx, dy], needFree) => {
      const nx = hx + dx, ny = hy + dy;
      return inBounds(nx, ny) && (!needFree || !blocked[idx(nx, ny)]) && !body.some(s => s[0] === nx && s[1] === ny);
    };
    const opts = DIRS.filter(d => !(d[0] === -dir[0] && d[1] === -dir[1]));
    const free = opts.filter(d => ok(d, true));
    if (free.length) {
      const straight = free.find(d => d[0] === dir[0] && d[1] === dir[1]);
      return straight && Math.random() < 0.7 ? straight : free[(Math.random() * free.length) | 0];
    }
    const any = opts.filter(d => ok(d, false));
    return any.length ? any[0] : null;
  }
  function step(now) {
    const d = chooseDir();
    if (!d) { reset(); return; }
    dir = d;
    prev = snake.map(s => s.slice());
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    snake.unshift(head);
    if (apple && head[0] === apple[0] && head[1] === apple[1]) {
      grow += 2; pulseAt = now; eaten = { x: apple[0], y: apple[1], born: now }; burst(head); placeApple(); appleBorn = now;
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
    const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    const drawApple = (ax, ay, sc) => {
      ctx.save(); ctx.translate(ax, ay); ctx.scale(sc, sc); ctx.translate(-ax, -ay);
      ctx.shadowColor = 'rgba(39, 208, 127, 0.55)'; ctx.shadowBlur = 8 * dpr;
      ctx.fillStyle = '#2ee082';
      ctx.beginPath(); ctx.arc(ax, ay + 1, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(ax - CELL * 0.1, ay - CELL * 0.08, CELL * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f7a3f';
      ctx.beginPath(); ctx.ellipse(ax + CELL * 0.12, ay - CELL * 0.32, CELL * 0.13, CELL * 0.06, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const popIn = Math.max(0, Math.min(1, (now - appleBorn - 420) / 320));
    if (apple && popIn > 0) {
      const ax = (apple[0] + 0.5) * CELL, ay = (apple[1] + 0.5) * CELL + Math.sin(now / 300) * 1.5;
      drawApple(ax, ay, backOut(popIn));
    }

    // segment centres this frame (gliding between cells)
    const n = snake.length;
    const C = lastC = snake.map((b, i) => {
      const a = prev[i] || b;
      return [(a[0] + (b[0] - a[0]) * k + 0.5) * CELL, (a[1] + (b[1] - a[1]) * k + 0.5) * CELL];
    });
    // blocky body: one rounded block per segment with a small gap, glossy on
    // top, red to deep red down the body; the last few blocks shrink into a
    // tail that wags from side to side
    const R = CELL * 0.4;
    const TAIL = 5;
    const gulpAt = (now - pulseAt) / STEP_MS;
    const rr = (x, y, ww, hh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
    };
    for (let i = n - 1; i >= 1; i--) {
      const t = i / Math.max(1, n - 1);
      const fromEnd = n - 1 - i;
      const shrink = fromEnd < TAIL ? 0.45 + 0.55 * (fromEnd / TAIL) : 1;
      const bulge = gulpAt < n + 1 ? 0.25 * Math.exp(-((gulpAt - i) ** 2) / 2) : 0;
      const size = CELL * 0.86 * shrink * (1 + bulge);
      let [cx0, cy0] = C[i];
      if (fromEnd < TAIL) {                       // wag: sideways to the body's direction
        const a = C[i - 1], dx = a[0] - cx0, dy = a[1] - cy0, len = Math.hypot(dx, dy) || 1;
        const amt = Math.sin(now / 140 - i * 0.9) * CELL * 0.16 * (1 - fromEnd / TAIL + 0.2);
        cx0 += (-dy / len) * amt; cy0 += (dx / len) * amt;
      }
      const c = mix(HEAD_RGB, TAIL_RGB, t);
      const x = cx0 - size / 2, y = cy0 - size / 2, rad2 = size * 0.28;
      ctx.fillStyle = '#6E0C1B';
      rr(x - 1.5, y - 1.5, size + 3, size + 3, rad2 + 1.5); ctx.fill();
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      rr(x, y, size, size, rad2); ctx.fill();
      const hl = mix(c, [255, 255, 255], 0.35);
      ctx.fillStyle = `rgb(${hl[0]},${hl[1]},${hl[2]})`;
      rr(x + size * 0.16, y + size * 0.12, size * 0.5, size * 0.2, size * 0.1); ctx.fill();
    }

    // eating: the mouth opens as the head closes in on the apple, the apple is
    // pulled in and shrinks away, then the jaws snap shut with a little chomp
    const EAT_MS = 260;
    const eatT = eaten ? (now - eaten.born) / EAT_MS : 2;
    if (eaten && eatT > 2.2) eaten = null;
    let open = 0;
    if (apple && popIn >= 1) {
      const d = Math.hypot((apple[0] + 0.5) * CELL - C[0][0], (apple[1] + 0.5) * CELL - C[0][1]) / CELL;
      open = Math.max(0, Math.min(1, (2.6 - d) / 1.8));
    }
    if (eatT < 1) open = Math.max(open, 1 - eatT);
    const chomp = eatT >= 1 && eatT < 1.8 ? Math.sin((eatT - 1) / 0.8 * Math.PI) : 0;

    // head: a little bigger, with big eyes facing forward and a flicking tongue
    const [hdx, hdy] = C[0], ang = Math.atan2(dir[1], dir[0]);
    ctx.save();
    ctx.translate(hdx, hdy); ctx.rotate(ang);
    ctx.scale(1 + chomp * 0.14, 1 - chomp * 0.1);
    if ((now % 2400) < 300 && open < 0.05) {
      ctx.strokeStyle = '#FF2D55'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(R * 0.9, 0); ctx.lineTo(R * 1.7, 0);
      ctx.moveTo(R * 1.7, 0); ctx.lineTo(R * 2.05, -R * 0.3);
      ctx.moveTo(R * 1.7, 0); ctx.lineTo(R * 2.05, R * 0.3); ctx.stroke();
    }
    const HS = CELL * 1.0;                         // the head block is a touch bigger
    ctx.fillStyle = '#6E0C1B';
    rr(-HS / 2 - 1.5, -HS / 2 - 1.5, HS + 3, HS + 3, HS * 0.3 + 1.5); ctx.fill();
    ctx.fillStyle = `rgb(${HEAD_RGB.join(',')})`;
    rr(-HS / 2, -HS / 2, HS, HS, HS * 0.3); ctx.fill();
    ctx.fillStyle = 'rgb(255,160,168)';
    rr(-HS * 0.34, -HS * 0.38, HS * 0.45, HS * 0.16, HS * 0.08); ctx.fill();
    // the mouth: a dark wedge at the front with two little fangs
    if (open > 0.02) {
      const mh = HS * 0.36 * open, mx = HS * 0.12;
      ctx.fillStyle = '#3A0610';
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(HS / 2 + 2, -mh); ctx.lineTo(HS / 2 + 2, mh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FF2D55';
      ctx.beginPath(); ctx.ellipse(HS * 0.34, 0, HS * 0.12, mh * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const sd of [-1, 1]) {
        const fy = sd * mh * 0.78;
        ctx.beginPath(); ctx.moveTo(HS * 0.38, fy); ctx.lineTo(HS * 0.46, fy); ctx.lineTo(HS * 0.42, fy - sd * HS * 0.12 * open); ctx.closePath(); ctx.fill();
      }
    }
    const blink = (now % 4200) < 140;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(R * 0.05, sd * R * 0.5, R * 0.36, blink ? R * 0.06 : R * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#1A0306';
        ctx.beginPath(); ctx.arc(R * 0.18, sd * R * 0.48, R * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(R * 0.12, sd * R * 0.42, R * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    if (eaten && eatT < 1) {
      const ax = (eaten.x + 0.5) * CELL, ay = (eaten.y + 0.5) * CELL;
      const mxp = hdx + Math.cos(ang) * CELL * 0.3, myp = hdy + Math.sin(ang) * CELL * 0.3;
      const e = eatT * eatT;
      drawApple(ax + (mxp - ax) * e, ay + (myp - ay) * e, 1 - eatT * 0.9);
    }

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
  setInterval(() => {
    if (document.hidden || !host) return;
    scanAssets();
    if (!apple || blocked[idx(apple[0], apple[1])]) { placeApple(); appleBorn = performance.now(); }
  }, 1200);
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
      // it has a mind of its own: every so often it wanders off to
      // another part of the site, whether or not anyone is watching
      if (now > nextTrip) {
        nextTrip = now + 45000 + Math.random() * 60000;
        const others = HOSTS.filter(h => h !== host);
        moveTo(others[(Math.random() * others.length) | 0]);
        lastStep = now;
      }
      const hold = hoverTag || overSnake;
      if (!lastStep || hold) lastStep = now - (hold ? STEP_MS * 0.999 : 0);   // hold still while hovered
      while (!hold && now - lastStep >= STEP_MS) { step(now); lastStep += STEP_MS; if (now - lastStep > 1000) lastStep = now; }
      if (bandOnScreen()) render(now);           // carries on off screen, just isn't drawn
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
    clearTimeout(rt); rt = setTimeout(() => moveTo(host || HOSTS[0]), 200);
  });
  moveTo(HOSTS[(Math.random() * HOSTS.length) | 0]);
  requestAnimationFrame(loop);
})();
