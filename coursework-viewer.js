/* ============================================================
   COURSEWORK VIEWER | coursework-viewer.js
   "View files" on a coursework folder opens its PDFs in a carbon
   folder-style viewer on the page, so visitors never leave the site.
   Pages are drawn with PDF.js (self-hosted in assets/vendor/pdfjs),
   which works the same on desktop and on iPhone, where an embedded
   PDF would otherwise only show its first page. PDF.js is only
   loaded the first time someone opens a file.
   ============================================================ */

'use strict';

(function initCourseworkViewer() {
  const buttons = document.querySelectorAll('.cfs__view[data-files]');
  if (!buttons.length) return;

  const PDFJS_SRC    = 'assets/vendor/pdfjs/pdf.min.js';
  const PDFJS_WORKER = 'assets/vendor/pdfjs/pdf.worker.min.js';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Build the dialog once ── */
  const root = document.createElement('div');
  root.className = 'cv';
  root.hidden = true;
  root.innerHTML = `
    <div class="cv__backdrop" data-cv-close></div>
    <div class="cv__panel" role="dialog" aria-modal="true" aria-labelledby="cvTitle">
      <span class="cv__tab" aria-hidden="true"></span>
      <header class="cv__head">
        <div class="cv__heading">
          <p class="cv__eyebrow">University coursework</p>
          <h2 class="cv__title" id="cvTitle"></h2>
        </div>
        <div class="cv__actions">
          <a class="cv__btn" id="cvDownload" download>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1v8M3 6l4 4 4-4M1 12.5h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Download</span>
          </a>
          <button type="button" class="cv__btn cv__btn--icon" data-cv-close aria-label="Close viewer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>
      <div class="cv__files" role="tablist" aria-label="Files"></div>
      <div class="cv__body" id="cvBody" tabindex="0" aria-label="Document pages">
        <div class="cv__status" id="cvStatus" role="status" aria-live="polite"></div>
        <div class="cv__pages" id="cvPages"></div>
      </div>
      <footer class="cv__foot">
        <span id="cvPageNo" aria-live="off"></span>
        <span class="cv__hint">Esc to close</span>
      </footer>
    </div>`;
  document.body.appendChild(root);

  const panel    = root.querySelector('.cv__panel');
  const titleEl  = root.querySelector('#cvTitle');
  const filesEl  = root.querySelector('.cv__files');
  const bodyEl   = root.querySelector('#cvBody');
  const pagesEl  = root.querySelector('#cvPages');
  const statusEl = root.querySelector('#cvStatus');
  const pageNoEl = root.querySelector('#cvPageNo');
  const dlLink   = root.querySelector('#cvDownload');

  let files = [];
  let current = -1;
  let doc = null;          // the open PDF.js document
  let loadTask = null;     // PDF.js loading task (cancel on switch/close)
  let renderIo = null;     // renders pages as they near the viewport
  let pageIo = null;       // tracks which page is on screen
  let lastFocus = null;
  let token = 0;           // bumps on every file switch so stale renders bail

  /* ── PDF.js, loaded on first use ── */
  let pdfjsReady = null;
  function loadPdfjs() {
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS_SRC;
      s.onload = () => {
        if (!window.pdfjsLib) { reject(new Error('PDF.js missing')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsReady = null; reject(new Error('PDF.js failed to load')); };
      document.head.appendChild(s);
    });
    return pdfjsReady;
  }

  /* ── Open / close ── */
  function open(btn) {
    try { files = JSON.parse(btn.dataset.files); } catch (e) { return; }
    if (!files.length) return;
    const card = btn.closest('.cfs__card');
    const title = card && card.querySelector('.cfs__title');
    titleEl.textContent = title ? title.textContent : 'Coursework';
    lastFocus = btn;

    filesEl.innerHTML = files.map((f, i) =>
      `<button type="button" class="cv__file" role="tab" id="cvTab${i}" aria-controls="cvBody" data-i="${i}">${esc(f.name)}</button>`
    ).join('');
    filesEl.hidden = files.length < 2;

    root.hidden = false;
    document.documentElement.classList.add('cv-open');
    requestAnimationFrame(() => root.classList.add('is-on'));
    show(0);
    setTimeout(() => (files.length > 1 ? filesEl.querySelector('.cv__file') : panel.querySelector('[data-cv-close].cv__btn')).focus(), 30);
  }

  function close() {
    if (root.hidden) return;
    teardown();
    root.classList.remove('is-on');
    document.documentElement.classList.remove('cv-open');
    setTimeout(() => { root.hidden = true; pagesEl.innerHTML = ''; }, reduceMotion ? 0 : 260);
    if (lastFocus) lastFocus.focus();
  }

  function teardown() {
    token++;
    if (renderIo) { renderIo.disconnect(); renderIo = null; }
    if (pageIo) { pageIo.disconnect(); pageIo = null; }
    if (loadTask) { loadTask.destroy(); loadTask = null; }
    doc = null;
  }

  /* ── Show one file ── */
  async function show(i) {
    if (i === current && doc) return;
    teardown();
    current = i;
    const myToken = token;
    const file = files[i];

    filesEl.querySelectorAll('.cv__file').forEach((b, j) => {
      b.setAttribute('aria-selected', j === i);
      b.tabIndex = j === i ? 0 : -1;
    });
    dlLink.href = file.src;
    dlLink.setAttribute('download', '');
    dlLink.setAttribute('aria-label', `Download ${file.name} (PDF)`);
    pagesEl.innerHTML = '';
    pageNoEl.textContent = '';
    bodyEl.scrollTop = 0;
    setStatus('Opening ' + file.name + '…', true);

    let lib;
    try { lib = await loadPdfjs(); }
    catch (e) { if (myToken === token) fallback(file); return; }
    if (myToken !== token) return;

    loadTask = lib.getDocument({ url: file.src });
    loadTask.onProgress = p => {
      if (myToken !== token || !p.total) return;
      setStatus(`Opening ${file.name}… ${Math.min(99, Math.round(p.loaded / p.total * 100))}%`, true);
    };
    try { doc = await loadTask.promise; }
    catch (e) {
      if (myToken !== token) return;
      setStatus(`${file.name} isn’t available right now.`, false);
      return;
    }
    if (myToken !== token) return;

    const first = await doc.getPage(1);
    if (myToken !== token) return;
    const vp = first.getViewport({ scale: 1 });
    const ratio = vp.width / vp.height;

    // One placeholder per page, sized from page 1 so the scrollbar is right
    for (let n = 1; n <= doc.numPages; n++) {
      const wrap = document.createElement('div');
      wrap.className = 'cv__page';
      wrap.dataset.page = n;
      wrap.style.aspectRatio = ratio;
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', `${file.name}, page ${n} of ${doc.numPages}`);
      pagesEl.appendChild(wrap);
    }
    setStatus('', false);
    pageNoEl.textContent = `Page 1 of ${doc.numPages}`;

    renderIo = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting || en.target.dataset.done) return;
        en.target.dataset.done = '1';
        renderPage(+en.target.dataset.page, en.target, myToken);
      });
    }, { root: bodyEl, rootMargin: '900px 0px' });
    pageIo = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) pageNoEl.textContent = `Page ${en.target.dataset.page} of ${doc ? doc.numPages : ''}`;
      });
    }, { root: bodyEl, rootMargin: '-25% 0px -74% 0px' });
    pagesEl.querySelectorAll('.cv__page').forEach(el => { renderIo.observe(el); pageIo.observe(el); });
  }

  async function renderPage(n, wrap, myToken) {
    if (!doc) return;
    let page;
    try { page = await doc.getPage(n); } catch (e) { return; }
    if (myToken !== token) return;
    const base = page.getViewport({ scale: 1 });
    wrap.style.aspectRatio = base.width / base.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (wrap.clientWidth * dpr) / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    try {
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } catch (e) { return; }
    if (myToken !== token) return;
    wrap.appendChild(canvas);
    wrap.classList.add('is-ready');
    page.cleanup();
  }

  // If PDF.js can't load, show the browser's own viewer instead
  function fallback(file) {
    setStatus('', false);
    pagesEl.innerHTML = `<iframe class="cv__frame" src="${esc(file.src)}#view=FitH" title="${esc(file.name)}"></iframe>`;
  }

  function setStatus(text, busy) {
    statusEl.textContent = text;
    statusEl.classList.toggle('is-busy', !!busy);
    statusEl.hidden = !text;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Events ── */
  buttons.forEach(btn => btn.addEventListener('click', () => open(btn)));
  root.addEventListener('click', e => { if (e.target.closest('[data-cv-close]')) close(); });
  filesEl.addEventListener('click', e => {
    const b = e.target.closest('.cv__file');
    if (b) show(+b.dataset.i);
  });
  // Arrow keys move between file tabs
  filesEl.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...filesEl.querySelectorAll('.cv__file')];
    const i = (current + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[i].focus();
    show(i);
  });
  document.addEventListener('keydown', e => {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the viewer while it's open
    const items = [...panel.querySelectorAll('a[href], button, [tabindex="0"]')].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();
