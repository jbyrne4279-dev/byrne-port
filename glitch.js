/* Pixel-glitch dissolve on any .btn when clicked. Purely visual; never
   blocks the button's real action (navigation, viewer, etc.). */
'use strict';
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    btn.classList.remove('is-glitching');
    void btn.offsetWidth;            // restart the animation if clicked again quickly
    btn.classList.add('is-glitching');
    setTimeout(() => btn.classList.remove('is-glitching'), 560);
  }, true);
})();
