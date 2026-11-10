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
    // A looping screen recording plays over the screenshot when there is one
    if (img.dataset.video && !reduce) {
      const v = document.createElement('video');
      v.className = 'device__video';
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.preload = 'none';
      if (img.dataset.poster) v.poster = img.dataset.poster;
      v.dataset.src = img.dataset.video;
      v.dataset.webm = img.dataset.video.replace(/\.mp4$/, '.webm');
      screen.appendChild(v);
      dev._video = v;
    }
    devices.push(dev);
  });
  function playVideo(d) {
    const v = d._video;
    if (!v) return;
    if (!v.dataset.loaded) {
      v.dataset.loaded = '1';
      // MP4 (H.264) plays everywhere it's supported; WebM covers the rest
      [[v.dataset.src, 'video/mp4'], [v.dataset.webm, 'video/webm']].forEach(([src, type]) => {
        const so = document.createElement('source'); so.src = src; so.type = type; v.appendChild(so);
      });
      v.load();
    }
    v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }
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
        timers.set(d, setTimeout(() => { d.classList.add('is-open'); playVideo(d); }, 80 + batch++ * 150));
      } else {
        d.classList.remove('is-open');
        if (d._video) d._video.pause();
      }
    });
  }, { threshold: 0.25 });
  devices.forEach(d => io.observe(d));
})();
