/* Frame each project cover in a device mockup: MacBook for landscape
   (1920x1080), iPhone for portrait (1080x1920). Orientation auto-detected
   from the cover image's natural dimensions. */
'use strict';
(function initDevices() {
  const cards = document.querySelectorAll('.carousel__stage .project-card, .portfolio__carousel .project-card');
  if (!cards.length) return;
  cards.forEach(card => {
    const wrap = card.querySelector('.project-card__img');
    const cover = card.querySelector('.project-card__cover');
    if (!wrap || !cover) return;
    const build = () => {
      if (card.querySelector('.device')) return;
      const w = cover.naturalWidth, h = cover.naturalHeight;
      if (!w || !h) return;
      const portrait = h > w * 1.15;
      card.classList.add('dev', portrait ? 'dev--phone' : 'dev--laptop');
      const dev = document.createElement('div');
      dev.className = 'device device--' + (portrait ? 'phone' : 'laptop');
      dev.setAttribute('aria-hidden', 'true');
      const screen = document.createElement('div');
      screen.className = 'device__screen';
      wrap.insertBefore(dev, cover);
      dev.appendChild(screen);
      screen.appendChild(cover);
    };
    if (cover.complete && cover.naturalWidth) build();
    else { cover.loading = 'eager'; cover.addEventListener('load', build, { once: true }); }
  });
})();
