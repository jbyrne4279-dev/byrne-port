/* ============================================================
   COURSEWORK DOCUMENT PREVIEWS | coursework-docs.js
   Adds a first-page thumbnail for every file in each coursework
   folder; CSS slides them up out of the folder on hover.
   ============================================================ */

'use strict';

(function initCourseworkDocs() {
  const cards = document.querySelectorAll('#cfs .cfs__card');
  if (!cards.length) return;

  // A first-page preview of every document in the folder. They sit
  // tucked inside it and fan out when the folder is hovered.
  cards.forEach(card => {
    const btn = card.querySelector('.cfs__view[data-files]');
    let files = [];
    try { files = btn ? JSON.parse(btn.dataset.files) : []; } catch (e) {}
    if (!files.length) return;
    const docs = document.createElement('div');
    docs.className = 'cfs__docs';
    docs.setAttribute('aria-hidden', 'true');
    docs.style.setProperty('--n', files.length);
    docs.innerHTML = files.map((f, k) => {
      const thumb = f.src.replace(/^assets\/coursework\//, 'assets/coursework/thumbs/').replace(/\.pdf$/i, '.webp');
      return `<span class="cfs__doc" style="--k:${k - (files.length - 1) / 2}; --d:${k}"><img src="${thumb}" alt="" loading="lazy" draggable="false"><em>${f.name}</em></span>`;
    }).join('');
    card.querySelector('.cfs__card-img').after(docs);
  });
})();
