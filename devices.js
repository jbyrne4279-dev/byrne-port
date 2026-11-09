/* Put each website screenshot inside a MacBook mockup. */
'use strict';
(function initDevices() {
  const cards = document.querySelectorAll('#websites .site-card');
  if (!cards.length) return;
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
  });
})();
