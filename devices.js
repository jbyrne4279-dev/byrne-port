/* Put each website screenshot inside a MacBook mockup, and animate the lid
   opening from closed as the card scrolls into view. */
'use strict';
(function initDevices() {
  const cards = document.querySelectorAll('#websites .site-card');
  if (!cards.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('devices-ready');  // enables the closed start-state in CSS
  const devices = [];
  cards.forEach(card => {
    const wrap = card.querySelector('.site-card__img-wrap');
    const img = card.querySelector('.site-card__img');
    if (!wrap || !img || wrap.querySelector('.device')) return;
    const dev = document.createElement('div');
    dev.className = 'device device--laptop';
    dev.setAttribute('aria-hidden', 'true');
    const screen = document.createElement('div');
    screen.className = 'device__screen';
    wrap.insertBefore(dev, img);
    dev.appendChild(screen);
    screen.appendChild(img);
    devices.push(dev);
  });
  if (reduce || !('IntersectionObserver' in window)) { devices.forEach(d => d.classList.add('is-open')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { setTimeout(() => e.target.classList.add('is-open'), 120); obs.unobserve(e.target); }
    });
  }, { threshold: 0.3 });
  devices.forEach(d => io.observe(d));
})();
