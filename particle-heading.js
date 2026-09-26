/* ============================================================
   PARTICLE HEADING | particle-heading.js
   Cursor-driven particle typography, vanilla canvas — a
   dependency-free port of the effect for static-site headings.
   ============================================================ */

'use strict';

(function () {
  document.documentElement.classList.remove('no-js');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initHeading(el) {
    const text = el.dataset.particleText || el.textContent.trim();
    const canvas = el.querySelector('.particle-heading__canvas');
    if (!canvas) return;

    if (prefersReducedMotion) {
      el.classList.add('is-static');
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let particles = [];
    let w = 0, h = 0;
    let pointer = { x: -9999, y: -9999, active: false };
    let running = false;
    let rafId = null;

    // Sample the text glyph mask into a particle grid.
    function build() {
      const rect = el.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      // Offscreen sample canvas at device pixel resolution
      const sample = document.createElement('canvas');
      sample.width = w;
      sample.height = h;
      const sctx = sample.getContext('2d');

      // Fit the text to the box: shrink font until it fits the width
      const family = getComputedStyle(el).fontFamily || 'sans-serif';
      const weight = getComputedStyle(el).fontWeight || '600';
      let size = h * 0.86;
      sctx.textBaseline = 'alphabetic';
      let fitted = size;
      for (; fitted > 8; fitted -= 2) {
        sctx.font = weight + ' ' + fitted + 'px ' + family;
        if (sctx.measureText(text).width <= w * 0.995) break;
      }
      sctx.font = weight + ' ' + fitted + 'px ' + family;
      sctx.fillStyle = '#fff';
      const metrics = sctx.measureText(text);
      const textW = metrics.width;
      const ascent = metrics.actualBoundingBoxAscent || fitted * 0.72;
      const descent = metrics.actualBoundingBoxDescent || fitted * 0.18;
      const textH = ascent + descent;
      const x = (w - textW) / 2;
      const y = (h - textH) / 2 + ascent;
      sctx.fillText(text, x, y);

      const img = sctx.getImageData(0, 0, w, h).data;
      const step = Math.max(2, Math.round(w / 260)); // particle density scales with width
      const pts = [];
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const alpha = img[(py * w + px) * 4 + 3];
          if (alpha > 120) pts.push({ x: px, y: py });
        }
      }

      particles = pts.map(p => ({
        ox: p.x, oy: p.y,          // home position
        x: p.x, y: p.y,            // current position
        vx: 0, vy: 0,
        r: Math.random() * 0.7 + 0.7
      }));
    }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#B00020';

    function tick() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const repelR = 70, repelR2 = repelR * repelR;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // Spring pull toward home
        let fx = (p.ox - p.x) * 0.06;
        let fy = (p.oy - p.y) * 0.06;
        // Pointer repulsion
        if (pointer.active) {
          const dx = p.x - pointer.x, dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < repelR2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / repelR) * 5.5;
            fx += (dx / d) * force;
            fy += (dy / d) * force;
          }
        }
        p.vx = (p.vx + fx) * 0.82;
        p.vy = (p.vy + fy) * 0.82;
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = i % 11 === 0 ? accent : '#F5F5F5';
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    el.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    });
    el.addEventListener('pointerleave', () => { pointer.active = false; });

    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(build, 150);
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { entry.isIntersecting ? start() : stop(); });
    }, { threshold: 0.05 });
    io.observe(el);

    build();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.particle-heading').forEach(initHeading);
  });
})();
