(() => {
  'use strict';

  /* ── SCROLL REVEAL ── */
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-scale');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(el => io.observe(el));

  /* ── HERO always visible on load (no scroll needed) ── */
  document.querySelectorAll('.sb-hero__content .reveal-up').forEach(el => {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  });

  /* ── STAT BARS + COUNT-UP ── */
  const stats = document.querySelectorAll('.sb-stat');
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const stat = entry.target;
      const bar = stat.querySelector('.sb-stat__bar');
      const valueEl = stat.querySelector('.sb-stat__value');
      const target = parseInt(bar.dataset.target, 10) || 0;

      bar.style.height = Math.min(target * 1.4, 100) + '%';

      const duration = 1100;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        valueEl.textContent = Math.round(eased * target) + '%';
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      statIO.unobserve(stat);
    });
  }, { threshold: 0.4 });
  stats.forEach(s => statIO.observe(s));

  /* ── LETTER-BY-LETTER FADE-IN ── */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.reveal-letters[data-split]').forEach(el => {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let letterIndex = 0;
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        el.appendChild(document.createElement('br'));
        return;
      }
      const extraClass = node.nodeType === Node.ELEMENT_NODE ? node.className : '';
      const text = node.textContent || '';
      Array.from(text).forEach(ch => {
        const span = document.createElement('span');
        span.className = extraClass ? 'sb-letter ' + extraClass : 'sb-letter';
        span.textContent = ch === ' ' ? ' ' : ch;
        if (!reduceMotion) {
          span.style.transitionDelay = (letterIndex * 0.028) + 's';
        }
        letterIndex += 1;
        el.appendChild(span);
      });
    });
  });

  const letterEls = document.querySelectorAll('.reveal-letters');
  const letterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        letterIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
  letterEls.forEach(el => letterIO.observe(el));

  /* ── PARALLAX ── */
  const parallaxEls = document.querySelectorAll('.sb-parallax');
  if (parallaxEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        parallaxEls.forEach(el => {
          const rect = el.parentElement.getBoundingClientRect();
          const offset = rect.top * 0.15;
          el.style.transform = `translateY(${offset}px)`;
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
