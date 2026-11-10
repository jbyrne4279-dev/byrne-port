/* ============================================================
   HERO MATRIX | hero-matrix.js
   A faint field of matrix characters sits at both sides of the hero,
   printed into the white background in light grey. Soft waves of light
   roll through it so characters glow a little darker, then fade back.
   Light theme only; pauses when the hero is off screen or the tab is
   hidden, and stays still for reduced motion.
   ============================================================ */
'use strict';

(function initHeroMatrix() {
  const hero = document.getElementById('home');
  if (!hero) return;

  const CHARS = 'アカサタナハマヤラワ0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜｵ<>*/#JB'.split('');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__matrix';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);
  const ctx = canvas.getContext('2d');

  let dpr = 1, w = 0, h = 0, cell = 18, cols = 0, rows = 0, glyphs = [];

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cell = w < 700 ? 17 : 22;
    cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
    glyphs = [];
    const band = w < 700 ? 0.3 : 0.42;             // how far in from each side
    for (let c = 0; c < cols; c++) {
      const x = c * cell + cell / 2;
      const fromEdge = Math.min(x, w - x) / (w * band);   // 0 at the edge, 1 at the band's inner limit
      if (fromEdge >= 1) continue;
      const edge = Math.pow(1 - fromEdge, 1.1);          // strongest at the very edge
      for (let r = 0; r < rows; r++) {
        if (Math.random() < 0.12) continue;              // a few gaps so it reads as code, not a grid
        glyphs.push({
          x, y: r * cell + cell / 2,
          edge,
          side: x < w / 2 ? 0 : 1,
          ch: CHARS[(Math.random() * CHARS.length) | 0],
          seed: Math.random() * 6.283
        });
      }
    }
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `600 ${cell * 0.74}px "Space Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const s = t / 1000;
    for (const g of glyphs) {
      // two slow waves: one rolling down the page, one moving out from the centre line
      const down = Math.sin(g.y / 120 - s * 1.3 + g.side * 1.7);
      const out = Math.sin((Math.abs(g.x - w / 2)) / 90 - s * 0.9);
      let wave = Math.max(0, down * 0.6 + out * 0.4);
      wave = wave * wave * wave;                         // narrow, bright crests
      const flicker = 0.85 + 0.15 * Math.sin(s * 2 + g.seed);
      const a = g.edge * (0.13 + wave * 0.62) * flicker;
      if (a < 0.012) continue;
      ctx.fillStyle = `rgba(110, 110, 118, ${a.toFixed(3)})`;
      ctx.fillText(g.ch, g.x, g.y);
    }
    // now and then a few characters change
    for (let i = 0; i < 6; i++) {
      const g = glyphs[(Math.random() * glyphs.length) | 0];
      if (g) g.ch = CHARS[(Math.random() * CHARS.length) | 0];
    }
  }

  const isLight = () => !document.documentElement.classList.contains('theme-dark');
  let raf = null, visible = true, last = 0;
  function loop(t) {
    raf = null;
    if (!visible || document.hidden || !isLight()) return;
    if (t - last > 40) { last = t; draw(t); }             // ~25fps is plenty for a slow wave
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (!isLight()) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    if (reduce) { draw(0); return; }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  build();
  start();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) start(); }, 150); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  document.addEventListener('jb-theme', start);
})();
