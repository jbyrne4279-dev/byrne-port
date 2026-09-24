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

  /* ── 2. UPDATE <title> + META ── */
  const pageTitle = project.title + ' | Joseph Byrne';
  document.title = pageTitle;

  // Build a concise meta description: explicit metaDescription > subtitle >
  // first description paragraph (stripped of tags), trimmed to ~155 chars.
  function buildMetaDesc() {
    if (project.metaDescription) return project.metaDescription;
    let base = project.subtitle || '';
    if (!base && Array.isArray(project.description) && project.description.length) {
      base = String(project.description[0]).replace(/<[^>]*>/g, '');
    }
    base = base.replace(/\s+/g, ' ').trim();
    if (base.length > 158) base = base.slice(0, 155).replace(/\s+\S*$/, '') + '…';
    return base || 'A project from Joseph Byrne’s multidisciplinary design portfolio.';
  }
  const metaDesc = buildMetaDesc();
  const pageUrl  = 'https://josephbyrne.org/project?slug=' + encodeURIComponent(project.slug);
  const ogImage  = project.ogImage || 'https://josephbyrne.org/assets/og-image.jpg';

  function setMeta(selector, value) {
    const el = document.head.querySelector(selector);
    if (el) el.setAttribute('content', value);
  }
  function setLink(rel, href) {
    let el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
  }
  setMeta('meta[name="description"]', metaDesc);
  setMeta('meta[property="og:title"]', pageTitle);
  setMeta('meta[property="og:description"]', metaDesc);
  setMeta('meta[property="og:image"]', ogImage);
  setMeta('meta[name="twitter:title"]', pageTitle);
  setMeta('meta[name="twitter:description"]', metaDesc);
  setMeta('meta[name="twitter:image"]', ogImage);
  setLink('canonical', pageUrl);
  const ogUrl = document.head.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', pageUrl);

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

  // Description paragraphs. An entry that's already a block element (e.g. a
  // data table) is passed through as-is instead of being wrapped in a <p> —
  // block content isn't valid inside <p> and the browser would just hoist
  // it back out, breaking the wrapping tag around it.
  set('projDesc', project.description.map(p => {
    const trimmed = p.trim();
    return /^<(table|div|ul|ol)[ >]/i.test(trimmed) ? trimmed : `<p class="type-reveal">${p}</p>`;
  }).join(''));
  if (window.TypeReveal) {
    document.querySelectorAll('#projDesc .type-reveal').forEach(p => window.TypeReveal.run(p));
  }

  // Skills — all aligned to the right of the overview text card
  const skillHtml = s => `<span class="proj-skill">${s}</span>`;
  const allSkills = (project.skills || []).map(skillHtml).join('');
  set('projSkillsTop',    '');
  set('projSkillsRight',  allSkills);
  set('projSkillsBottom', '');
  set('projSkillsLeft',   '');

  // Gallery
  set('projGallery', buildGallery(project));
  initGalleryTilt();

  /* ── Scroll-linked 3D tilt for the gallery grid ── */
  function initGalleryTilt() {
    const grid = document.getElementById('projGallery');
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll('.gallery-item'));
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    function update() {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 3;
      items.forEach((it, i) => {
        const r = it.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return; // skip far off-screen
        const center = r.top + r.height / 2;
        // -1 = above viewport centre, 0 = centred, 1 = below
        const rel = Math.max(-1, Math.min(1, (center - vh / 2) / (vh / 2)));
        const rotX = (rel * 10).toFixed(2);                 // tilt with scroll position
        const col = i % cols;                                // column-based sideways depth
        const rotY = ((col - (cols - 1) / 2) * 5 * (1 - Math.abs(rel))).toFixed(2);
        const ty = (rel * 8).toFixed(1);
        it.style.transform =
          `rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(${ty}px)`;
      });
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // run after images/layout settle
    requestAnimationFrame(update);
    window.addEventListener('load', update);
  }

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
