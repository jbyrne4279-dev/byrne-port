/* ============================================================
   CLICK BURST | burst.js
   A small, concentrated burst of matrix characters bursts out of the
   point where a button or link is clicked, then falls and fades.
   Space grey in the light theme, red in the dark theme. One fixed
   canvas, only animating while a burst is alive.
   ============================================================ */
'use strict';

(function initClickBurst() {
  if (window.__jbBurst) return;
  window.__jbBurst = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const CLICKABLE = 'a[href], button, [role="button"], [role="tab"], [role="switch"], label[for], .site-card, .cfs__doc, summary, input[type="submit"], input[type="button"]';
  const CHARS = 'アカサタナハマヤラワ0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜｵ<>*/#JB'.split('');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let dpr = 1, w = 0, h = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  let parts = [], raf = null, last = 0;

  function palette() {
    return document.documentElement.classList.contains('theme-dark')
      ? { head: '#FF6961', body: '255, 69, 58' }
      : { head: '#2E2E33', body: '110, 110, 115' };
  }

  function burst(x, y) {
    const pal = palette();
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const sp = 140 + Math.random() * 220;           // px per second
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        ch: CHARS[(Math.random() * CHARS.length) | 0],
        size: 9 + Math.random() * 6,
        life: 520 + Math.random() * 280,
        age: 0,
        swap: 0,
        pal
      });
    }
    // a tight core of columns that rain straight down from the click
    for (let i = 0; i < 5; i++) {
      parts.push({
        x: x + (i - 2) * 9, y: y - 4,
        vx: 0, vy: 60 + Math.random() * 90,
        ch: CHARS[(Math.random() * CHARS.length) | 0],
        size: 11, life: 640 + Math.random() * 200, age: 0, swap: 0, pal, rain: true
      });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function tick(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    parts = parts.filter(p => p.age < p.life);
    for (const p of parts) {
      p.age += dt * 1000;
      const k = p.age / p.life;                       // 0 → 1
      if (!p.rain) {
        p.vx *= Math.pow(0.04, dt);                    // strong drag: quick pop then hang
        p.vy = p.vy * Math.pow(0.04, dt) + 520 * dt;   // then fall like rain
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.swap += dt;
      if (p.swap > 0.06) { p.swap = 0; p.ch = CHARS[(Math.random() * CHARS.length) | 0]; }

      const alpha = Math.max(0, 1 - k * k);
      ctx.font = `700 ${p.size}px "Space Mono", ui-monospace, monospace`;
      // short trail behind each glyph
      for (let j = 3; j >= 1; j--) {
        ctx.fillStyle = `rgba(${p.pal.body}, ${(alpha * 0.22 * (4 - j) / 3).toFixed(3)})`;
        ctx.fillText(p.ch, p.x - p.vx * dt * j * 1.6, p.y - p.vy * dt * j * 1.6);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = k < 0.25 ? p.pal.head : `rgb(${p.pal.body})`;
      ctx.fillText(p.ch, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, w, h); }
  }

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const el = e.target.closest && e.target.closest(CLICKABLE);
    if (!el || el.disabled) return;
    burst(e.clientX, e.clientY);
  }, { passive: true });

  // Keyboard presses get a burst from the middle of the control
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (!el || !el.matches || !el.matches(CLICKABLE)) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
  });
})();
