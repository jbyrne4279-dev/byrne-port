/* ============================================================
   TEXT MORPH | text-morph.js
   Vanilla port of a cursor-free "text morph" heading effect —
   cycles a heading between two or three phrases with a soft
   blur / scale dissolve instead of a hard cut or plain fade.
   ============================================================ */

'use strict';

(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CYCLE_MS = 3000;

  function initMorph(el) {
    const raw = el.dataset.morphWords || '';
    const words = raw.split('|').map(w => w.trim()).filter(Boolean);
    if (words.length < 2) return;

    // Stable, single-announcement label for assistive tech. Words may
    // carry inline markup (e.g. a colored accent span), so strip tags
    // down to plain text for the announced label.
    const plain = document.createElement('div');
    plain.innerHTML = words[0];
    const srLabel = document.createElement('span');
    srLabel.className = 'sr-only';
    srLabel.textContent = plain.textContent;

    const stage = document.createElement('span');
    stage.className = 'text-morph__stage';
    stage.setAttribute('aria-hidden', 'true');

    const spans = words.map((w, i) => {
      const s = document.createElement('span');
      s.className = 'text-morph__word' + (i === 0 ? ' is-active' : '');
      s.innerHTML = w;
      stage.appendChild(s);
      return s;
    });

    el.textContent = '';
    el.appendChild(srLabel);
    el.appendChild(stage);

    if (prefersReducedMotion) return; // static first word only, no cycling

    let index = 0;
    let running = false;
    let timer = null;

    function step() {
      const current = spans[index];
      index = (index + 1) % spans.length;
      const next = spans[index];
      current.classList.remove('is-active');
      current.classList.add('is-leaving');
      next.classList.add('is-active');
      setTimeout(() => current.classList.remove('is-leaving'), 520);
    }

    function start() {
      if (running) return;
      running = true;
      timer = setInterval(step, CYCLE_MS);
    }
    function stop() {
      running = false;
      clearInterval(timer);
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { entry.isIntersecting ? start() : stop(); });
    }, { threshold: 0.2 });
    io.observe(el);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (el.getBoundingClientRect().top < window.innerHeight) start();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.text-morph').forEach(initMorph);
  });
})();
