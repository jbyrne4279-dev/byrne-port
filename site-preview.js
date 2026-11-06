/* ============================================================
   SITE PREVIEW | site-preview.js
   Clicking a website card opens the live site inside an on-page
   dialog (same visual style as the coursework/CV viewer). Many
   production sites forbid being embedded in an <iframe> via
   X-Frame-Options / CSP frame-ancestors; when the live frame does
   not load in time, the dialog falls back to the card's screenshot
   with a link out to the real site. No JS = the card just opens
   the site in a new tab as before.
   ============================================================ */

'use strict';

(function initSitePreview() {
  const cards = document.querySelectorAll('a.site-card[href^="http"]');
  if (!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Build the dialog once ── */
  const root = document.createElement('div');
  root.className = 'sv';
  root.hidden = true;
  root.innerHTML = `
    <div class="sv__backdrop" data-sv-close></div>
    <div class="sv__panel" role="dialog" aria-modal="true" aria-labelledby="svTitle">
      <span class="sv__tab" aria-hidden="true"></span>
      <header class="sv__head">
        <div class="sv__heading">
          <p class="sv__eyebrow">Live preview</p>
          <h2 class="sv__title" id="svTitle"></h2>
        </div>
        <div class="sv__actions">
          <a class="sv__btn" id="svVisit" target="_blank" rel="noopener noreferrer">
            <span>Visit Site</span>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
          <button type="button" class="sv__btn sv__btn--icon" data-sv-close aria-label="Close preview">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>
      <div class="sv__body">
        <div class="sv__status" id="svStatus" role="status" aria-live="polite"></div>
        <div class="sv__frame-wrap" id="svFrameWrap"></div>
      </div>
      <footer class="sv__foot">
        <span class="sv__url" id="svUrl"></span>
        <span class="sv__hint">Esc to close</span>
      </footer>
    </div>`;
  document.body.appendChild(root);

  const panel    = root.querySelector('.sv__panel');
  const titleEl  = root.querySelector('#svTitle');
  const visitEl  = root.querySelector('#svVisit');
  const frameWrap = root.querySelector('#svFrameWrap');
  const statusEl = root.querySelector('#svStatus');
  const urlEl    = root.querySelector('#svUrl');

  let lastFocus = null;
  let timer = null;

  function setStatus(text) {
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  function showFallback(url, shot, name) {
    clearTimeout(timer);
    setStatus('');
    frameWrap.innerHTML = `
      <div class="sv__fallback">
        ${shot ? `<img src="${esc(shot)}" alt="${esc(name)} homepage" class="sv__shot">` : ''}
        <div class="sv__fallback-note">
          <p>This site can’t be embedded live — here’s a snapshot.</p>
          <a class="sv__btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span>Open ${esc(name)}</span></a>
        </div>
      </div>`;
  }

  function open(card) {
    const url  = card.getAttribute('href');
    const nameEl = card.querySelector('.site-card__name');
    const name = nameEl ? nameEl.textContent.trim() : 'Website';
    const img  = card.querySelector('.site-card__img');
    const shot = img ? img.getAttribute('src') : '';
    lastFocus = card;

    titleEl.textContent = name;
    visitEl.href = url;
    urlEl.textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    frameWrap.innerHTML = '';
    setStatus('Loading live preview…');

    root.hidden = false;
    document.documentElement.classList.add('sv-open');
    requestAnimationFrame(() => root.classList.add('is-on'));

    const iframe = document.createElement('iframe');
    iframe.className = 'sv__frame';
    iframe.title = name + ' live preview';
    iframe.referrerPolicy = 'no-referrer';
    let loaded = false;
    iframe.addEventListener('load', () => { loaded = true; setStatus(''); });
    iframe.addEventListener('error', () => showFallback(url, shot, name));
    frameWrap.appendChild(iframe);
    iframe.src = url;

    clearTimeout(timer);
    timer = setTimeout(() => { if (!loaded) showFallback(url, shot, name); }, 6000);

    setTimeout(() => {
      const btn = panel.querySelector('[data-sv-close].sv__btn--icon');
      if (btn) btn.focus();
    }, 40);
  }

  function close() {
    if (root.hidden) return;
    clearTimeout(timer);
    root.classList.remove('is-on');
    document.documentElement.classList.remove('sv-open');
    setTimeout(() => { root.hidden = true; frameWrap.innerHTML = ''; }, reduceMotion ? 0 : 240);
    if (lastFocus) lastFocus.focus();
  }

  cards.forEach(card => card.addEventListener('click', e => { e.preventDefault(); open(card); }));
  root.addEventListener('click', e => { if (e.target.closest('[data-sv-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
})();
