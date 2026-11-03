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
  // tucked inside it and slide up out of it when the folder is hovered;
  // clicking one opens that file in the viewer.
  cards.forEach(card => {
    const btn = card.querySelector('.cfs__view[data-files]');
    let files = [];
    try { files = btn ? JSON.parse(btn.dataset.files) : []; } catch (e) {}
    if (!files.length) return;
    const docs = document.createElement('div');
    docs.className = 'cfs__docs';
    docs.style.setProperty('--n', files.length);
    // Sheets alternate left and right of the cover; a third or fourth
    // tucks in beside the first on its side, a little lower
    const spot = k => {
      const side = k % 2 ? 73 : 27;
      const row = Math.floor(k / 2);
      return { x: side + (k % 2 ? 1 : -1) * row * 9, y: row * 12 };
    };
    docs.innerHTML = files.map((f, k) => {
      const { x, y } = files.length === 1 ? { x: 73, y: 0 } : spot(k);
      const thumb = f.src.replace(/^assets\/coursework\//, 'assets/coursework/thumbs/').replace(/\.pdf$/i, '.webp');
      return `<button type="button" class="cfs__doc" data-i="${k}" aria-label="Open ${f.name.replace(/"/g, '&quot;')}" style="--x:${x}%; --y:${y}%; --r:${((x - 50) * 0.12).toFixed(1)}deg; --d:${k}"><em>${f.name}</em><img src="${thumb}" alt="" loading="lazy" draggable="false"></button>`;
    }).join('');
    card.querySelector('.cfs__card-img').after(docs);
  });
})();
