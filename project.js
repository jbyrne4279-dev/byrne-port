/* ============================================================
   PROJECT PAGE LOGIC |project.js
   Reads ?slug= from URL, populates page, handles lightbox.
   ============================================================ */

'use strict';

(function () {

  /* ── 1. RESOLVE PROJECT FROM URL ── */
  // Support both ?slug=xxx and #xxx for static hosting compatibility
  const params  = new URLSearchParams(window.location.search);
  const slug    = params.get('slug') || window.location.hash.replace('#', '') || '';
  const project = (typeof PROJECTS !== 'undefined') && PROJECTS.find(p => p.slug === slug);

  if (!project) {
    renderNotFound();
    return;
  }

  /* ── 2. UPDATE <title> ── */
  document.title = project.title + ' |Joseph Byrne';

  /* ── 3. POPULATE PAGE ELEMENTS ── */
  function set(id, html, attr) {
    const el = document.getElementById(id);
    if (!el) return;
    if (attr) el.setAttribute(attr, html);
    else el.innerHTML = html;
  }

  set('projIndex',   project.index);
  set('projCat',     project.category);
  set('projTitle',   project.title);
  set('projSubtitle', project.subtitle);

  const projTitleEl = document.getElementById('projTitle');
  if (projTitleEl && window.TerminalFlicker) window.TerminalFlicker.arm(projTitleEl);

  const projSubtitleEl = document.getElementById('projSubtitle');
  if (projSubtitleEl && window.TypeReveal) window.TypeReveal.run(projSubtitleEl);

  set('detailYear',    project.year);
  set('detailCat',     project.category);
  set('detailContext', project.context);

  // Live site link(s) — supports a single `url` or a `links` array of { label, url }
  const linksEl = document.getElementById('projLinks');
  if (linksEl) {
    let links = [];
    if (Array.isArray(project.links)) {
      links = project.links;
    } else if (project.url) {
      links = [{ label: 'Visit Website', url: project.url }];
    }
    const arrowSvg = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    linksEl.innerHTML = links.map(l => {
      const cls   = 'proj-hero__link' + (l.color ? ' proj-hero__link--' + l.color : '');
      const arrow = (l.arrow === false) ? '' : arrowSvg;
      return '<a class="' + cls + '" href="' + l.url + '" target="_blank" rel="noopener noreferrer">'
        + (l.label || 'Visit Website') + arrow + '</a>';
    }).join('');
    linksEl.style.display = links.length ? 'flex' : 'none';
  }

  // Optional caption under the link buttons (e.g. "Designed for mobile view")
  const noteEl = document.getElementById('projLinksNote');
  if (noteEl) {
    if (project.linksNote) {
      noteEl.textContent = project.linksNote;
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }
  }

  // Description paragraphs
  set('projDesc', project.description.map(p => `<p class="type-reveal">${p}</p>`).join(''));
  if (window.TypeReveal) {
    document.querySelectorAll('#projDesc .type-reveal').forEach(p => window.TypeReveal.run(p));
  }

  // Skills
  set('projSkills',
    project.skills.map(s => `<span class="proj-skill">${s}</span>`).join('')
  );

  // Gallery
  set('projGallery', buildGallery(project));

  // Prev / Next navigation
  const idx  = PROJECTS.findIndex(p => p.slug === slug);
  const prev = PROJECTS[idx - 1] || PROJECTS[PROJECTS.length - 1];
  const next = PROJECTS[idx + 1] || PROJECTS[0];

  const prevEl = document.getElementById('prevProject');
  const nextEl = document.getElementById('nextProject');
  if (prevEl) { prevEl.href = 'project?slug=' + prev.slug; }
  if (nextEl) { nextEl.href = 'project?slug=' + next.slug; }
  set('prevName', prev.title);
  set('nextName', next.title);

  /* ── 4. BUILD GALLERY ── */
  function buildGallery(proj) {
    const paths = proj.imagePaths || [];
    const count = proj.imageCount || 4;
    const total = Math.max(paths.length, count);

    return Array.from({ length: total }, (_, i) => {
      const src = paths[i];
      const num = String(i + 1).padStart(2, '0');

      if (src) {
        return `
          <div class="gallery-item" data-index="${i}" role="button" tabindex="0" aria-label="Open image ${num}">
            <img src="${src}" alt="${proj.title} |image ${num}" loading="lazy">
          </div>`;
      }

      // Placeholder gradient tile
      return `
        <div class="gallery-item gallery-item--placeholder"
             data-index="${i}"
             style="background:${proj.gradient}"
             role="button" tabindex="0"
             aria-label="Image placeholder ${num}">
          <span class="gallery-item__num">${num}</span>
          <span class="gallery-item__prompt">Add image to assets/projects/${proj.slug}/</span>
        </div>`;
    }).join('');
  }

  /* ── 5. LIGHTBOX ── */
  const lightbox = document.getElementById('lightbox');
  const lbStage  = document.getElementById('lbStage');
  const lbCount  = document.getElementById('lbCounter');
  const lbClose  = document.getElementById('lbClose');
  const lbPrev   = document.getElementById('lbPrev');
  const lbNext   = document.getElementById('lbNext');

  let currentIndex = 0;
  let galleryItems = [];

  function openLightbox(index) {
    galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
    currentIndex = index;
    showSlide(currentIndex);
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    // Return focus to the gallery item that opened it
    const trigger = document.querySelector(`.gallery-item[data-index="${currentIndex}"]`);
    if (trigger) trigger.focus();
  }

  function showSlide(index) {
    lbStage.classList.add('is-transitioning');

    setTimeout(() => {
      lbStage.innerHTML = buildSlide(index);
      lbCount.textContent = `${index + 1} / ${galleryItems.length}`;
      lbPrev.disabled = false;
      lbNext.disabled = false;
      lbStage.classList.remove('is-transitioning');
    }, 200);
  }

  function buildSlide(index) {
    const item = galleryItems[index];
    if (!item) return '';

    const img = item.querySelector('img');
    if (img) {
      return `<img src="${img.src}" alt="${img.alt}">`;
    }

    // Placeholder
    const bg  = item.style.background;
    const num = item.querySelector('.gallery-item__num');
    return `
      <div class="lightbox__placeholder" style="background:${bg}">
        <span>${num ? num.textContent : ''}</span>
      </div>`;
  }

  function navigate(dir) {
    const total = galleryItems.length;
    currentIndex = (currentIndex + dir + total) % total;
    showSlide(currentIndex);
  }

  // Gallery click / keyboard
  document.getElementById('projGallery').addEventListener('click', e => {
    const item = e.target.closest('.gallery-item');
    if (item) openLightbox(parseInt(item.dataset.index, 10));
  });

  document.getElementById('projGallery').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.gallery-item');
      if (item) { e.preventDefault(); openLightbox(parseInt(item.dataset.index, 10)); }
    }
  });

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click',  () => navigate(-1));
  lbNext.addEventListener('click',  () => navigate(1));

  // Close on backdrop click
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Touch swipe
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── 6. NOT FOUND ── */
  function renderNotFound() {
    document.title = '404 |Joseph Byrne';
    const page = document.getElementById('projectPage');
    if (!page) return;
    page.innerHTML = `
      <div class="proj-not-found" style="padding-top: var(--nav-h)">
        <h1>404</h1>
        <p>Project not found</p>
        <a href="/#portfolio" class="btn btn--outline" style="margin-top:16px">← Back to Work</a>
      </div>`;

    const notFoundH1 = page.querySelector('h1');
    if (notFoundH1 && window.TerminalFlicker) window.TerminalFlicker.arm(notFoundH1);
  }

})();
