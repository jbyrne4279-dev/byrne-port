/* Put each website screenshot inside a MacBook mockup. The lid opens as
   the card scrolls into view and closes again once it scrolls out. */
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
  // Lids open as a laptop scrolls into view and close again once it has
  // scrolled out (either way), so they reopen on the way back.
  const timers = new Map();
  const io = new IntersectionObserver(entries => {
    let batch = 0;   // stagger laptops arriving together
    entries.forEach(e => {
      const d = e.target;
      clearTimeout(timers.get(d));
      if (e.isIntersecting) {
        timers.set(d, setTimeout(() => d.classList.add('is-open'), 80 + batch++ * 150));
      } else {
        d.classList.remove('is-open');
      }
    });
  }, { threshold: 0.25 });
  devices.forEach(d => io.observe(d));
})();
