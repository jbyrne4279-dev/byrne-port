/* ============================================================
   THEME SWITCH | theme.js
   Light (white and space grey) is the default. Dark is the black
   and red version. A small script in each page's <head> applies a
   saved dark choice before the page paints; this file adds the
   switch to the nav bar and swaps the stylesheets when it's used.
   ============================================================ */
'use strict';

(function initTheme() {
  if (window.__jbTheme) return;
  window.__jbTheme = true;

  const html = document.documentElement;
  const links = [...document.querySelectorAll('link[data-dark]')];
  links.forEach(l => { if (!l.dataset.light) l.dataset.light = l.getAttribute('href'); });

  const isDark = () => html.classList.contains('theme-dark');

  function apply(dark) {
    html.classList.toggle('theme-dark', dark);
    // Sales Analysis has its own light class; follow the site theme
    if (document.getElementById('saTheme')) html.classList.toggle('sa-light', !dark);

    const pending = [];
    links.forEach(l => {
      const want = dark ? l.dataset.dark : l.dataset.light;
      if (l.getAttribute('href') === want) return;
      pending.push(new Promise(res => {
        l.addEventListener('load', res, { once: true });
        l.addEventListener('error', res, { once: true });
      }));
      l.setAttribute('href', want);
    });
    document.querySelectorAll('img[data-dark-src]').forEach(img => {
      if (!img.dataset.lightSrc) img.dataset.lightSrc = img.getAttribute('src');
      img.setAttribute('src', dark ? img.dataset.darkSrc : img.dataset.lightSrc);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#FFFFFF');

    // Tell canvases (the particle heading) once the new colours are in
    Promise.all(pending).then(() => document.dispatchEvent(new CustomEvent('jb-theme', { detail: { dark } })));
    paint();
  }

  /* ── The switch ── */
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-switch';
  btn.innerHTML = `
    <span class="theme-switch__knob" aria-hidden="true">
      <svg class="theme-switch__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>
      <svg class="theme-switch__moon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>
    </span>`;

  function paint() {
    const dark = isDark();
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', String(dark));
    btn.setAttribute('aria-label', 'Dark mode');
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  btn.addEventListener('click', () => {
    const dark = !isDark();
    try { localStorage.setItem('jbTheme', dark ? 'dark' : 'light'); } catch (e) {}
    html.classList.add('theme-anim');
    apply(dark);
    setTimeout(() => html.classList.remove('theme-anim'), 500);
  });

  const nav = document.getElementById('nav');
  if (nav) nav.appendChild(btn);

  /* ── Liquid-glass light spot follows the pointer ── */
  const GLASS = '.btn--primary, .btn--outline, .site-card__btn, .contact__cv, .inspo-game__btn, .cv__btn, .sv__btn, .screensaver__back, .proj-hero__link, .proj-nav__btn, .nw-refresh, .sa-btn, .vl-btn, .cfs__view';
  let lastGlass = null;
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest && e.target.closest(GLASS);
    if (lastGlass && lastGlass !== el) { lastGlass.style.removeProperty('--gx'); lastGlass.style.removeProperty('--gy'); }
    lastGlass = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });

  // Sync everything to the saved choice (the head script did the stylesheets)
  apply(isDark());
})();
