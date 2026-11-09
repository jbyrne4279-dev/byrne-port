/* Splash entrance for every h1: scale + blur pop-in as it enters view. */
'use strict';
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const h1s = document.querySelectorAll('h1');
  if (!h1s.length) return;
  h1s.forEach(h => h.classList.add('splash-ready'));
  if (!('IntersectionObserver' in window)) { h1s.forEach(h => h.classList.add('splash-go')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('splash-go'); obs.unobserve(e.target); } });
  }, { threshold: 0.25 });
  h1s.forEach(h => io.observe(h));
})();
