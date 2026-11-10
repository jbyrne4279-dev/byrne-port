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

  /* ── Nav links as icons in a glass switch, like the day / night toggle ──
     The label stays for screen readers and shows as a tooltip; a knob
     slides under whichever section is active. */
  const ICONS = {
    home: '<path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
    portfolio: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17"/>',
    websites: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2.5 19h19"/>',
    academic: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4M21.5 9.5v5"/>',
    tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    contact: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 8l8 5.5L20 8"/>'
  };
  const list = nav && nav.querySelector('.nav__links');
  if (list && !list.classList.contains('nav__links--icons')) {
    // Home, Work, Sites and Academic stay in the centre; Tools and Contact
    // get their own island on the left, in the same glass style.
    const side = document.createElement('ul');
    side.className = 'nav__links nav__links--side';
    side.setAttribute('aria-label', 'Tools and contact');
    [...list.querySelectorAll('a')].forEach(a => {
      const key = (a.getAttribute('href') || '').split('#')[1];
      if (key === 'tools' || key === 'contact') side.appendChild(a.parentElement);
    });
    nav.appendChild(side);

    [list, side].forEach(ul => {
      ul.classList.add('nav__links--icons');
      const knob = document.createElement('li');
      knob.className = 'nav__knob';
      knob.setAttribute('aria-hidden', 'true');
      ul.prepend(knob);
      const anchors = [...ul.querySelectorAll('a')];
      anchors.forEach(a => {
        const key = (a.getAttribute('href') || '').split('#')[1];
        if (!ICONS[key]) return;
        const label = a.textContent.trim();
        a.setAttribute('aria-label', label);
        a.dataset.tip = label;
        a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;
      });
      const place = () => {
        const on = anchors.find(a => a.classList.contains('is-active'));
        if (!on) { knob.style.opacity = '0'; return; }
        knob.style.opacity = '1';
        knob.style.transform = `translate(${on.parentElement.offsetLeft}px, ${on.parentElement.offsetTop}px)`;
      };
      new MutationObserver(place).observe(ul, { subtree: true, attributes: true, attributeFilter: ['class'] });
      window.addEventListener('resize', place);
      requestAnimationFrame(place);
    });
  }

  // Sync everything to the saved choice (the head script did the stylesheets)
  apply(isDark());
})();
