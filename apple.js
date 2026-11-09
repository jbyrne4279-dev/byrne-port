/* ============================================================
   JOSEPH BYRNE — APPLE REDESIGN  |  apple.js
   Minimal interactions: nav state, mobile menu, project filter,
   scroll-reveal. No heavy effects.
   ============================================================ */
'use strict';

(function () {
  /* ── Nav hairline on scroll ── */
  const nav = document.getElementById('nav');
  const onScroll = () => { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 10); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Mobile menu ── */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (mobileMenu) mobileMenu.setAttribute('aria-hidden', 'true');
  };
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      mobileMenu.setAttribute('aria-hidden', String(!open));
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ── Project filter ── */
  const filter = document.getElementById('filter');
  const grid = document.getElementById('projGrid');
  if (filter && grid) {
    const cards = [...grid.querySelectorAll('.proj')];
    filter.addEventListener('click', e => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      filter.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
      const f = btn.dataset.filter;
      cards.forEach(c => {
        const show = f === 'all' || c.dataset.category === f;
        c.classList.toggle('is-hidden', !show);
      });
    });
  }

  /* ── Scroll reveal (with safety net so content never stays hidden) ── */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const show = el => el.classList.add('in');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(show);
    } else {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => { if (en.isIntersecting) { show(en.target); obs.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -40px 0px', threshold: 0.01 });
      reveals.forEach(el => io.observe(el));
      // Safety: anything still hidden after 2.5s (e.g. fast jumps, no scroll) is revealed.
      setTimeout(() => reveals.forEach(el => { if (!el.classList.contains('in')) show(el); }), 2500);
    }
  }
})();

/* ── Coursework marquee: duplicate the track for a seamless loop ── */
(function () {
  const track = document.getElementById('cfsTrack');
  if (!track) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const originals = [...track.children];
  originals.forEach(node => {
    const clone = node.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('button, a, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
    track.appendChild(clone);
  });
})();
