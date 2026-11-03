/* SITE NAV | site-nav.js
   Opens and closes the phone menu on pages that don't load script.js
   (which has its own copy of this). Runs once either way. */
'use strict';
(function initSiteNav() {
  if (window.__jbNavMenu) return;
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  const closeBtn = document.getElementById('menuClose');
  if (!btn || !menu) return;
  window.__jbNavMenu = true;
  const open = () => { menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); btn.classList.add('is-open'); document.body.style.overflow = 'hidden'; };
  const close = () => { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); btn.classList.remove('is-open'); document.body.style.overflow = ''; };
  btn.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  if (closeBtn) closeBtn.addEventListener('click', close);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
