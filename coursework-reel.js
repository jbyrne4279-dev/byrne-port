/* ============================================================
   COURSEWORK REEL | coursework-reel.js
   Desktop: the coursework folders sit in a sideways cinema reel with
   the same feel as the Projects slider. One folder in the centre, the
   rest peeking either side. Hover the edges to glide, drag or flick
   with momentum, arrow keys or a sideways trackpad swipe to step, and
   click a side folder to bring it to the centre.
   Phones (under 600px): folders stack in a column; the one in the
   middle of the screen is marked active so it "opens".
   ============================================================ */

'use strict';

(function initCourseworkReel() {
  const reel  = document.getElementById('cfs');
  const stage = reel && reel.querySelector('.cfs__stage');
  if (!stage) return;

  const cards = Array.from(stage.querySelectorAll('.cfs__card'))
    .sort((a, b) => +a.dataset.cfsIndex - +b.dataset.cfsIndex);
  const N = cards.length;
  if (!N) return;

  const mobileMq = window.matchMedia('(max-width: 599px)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clampN   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let pos = 0, vel = 0, snapTarget = null, lastT = 0, rafId = null;
  let dragging = false, flinging = false, prevPos = 0, motionBlur = 0;

  const MAX_SPEED = 5;     // cards/sec at the far edge (hover glide)
  const SNAP_EASE = 0.10;
  const FRICTION  = 0.93, FLICK_MULT = 1.25, FLICK_MIN = 1.4, MAX_FLING = 16, VEL_MIN = 0.2;
  const BLUR_MIN_SPEED = 1.0, BLUR_PER_SPEED = 1.5, MAX_BLUR = 10;
  const STEP = 46;         // % of card width between neighbours

  function setActive(i) {
    cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
  }

  /* ── Desktop reel ── */
  function layout(center) {
    const moveDim = Math.min(0.35, motionBlur * 0.03);
    const moveScale = 1 - Math.min(0.04, motionBlur * 0.004);
    cards.forEach((card, i) => {
      const offset = i - center;
      const abs = Math.abs(offset);
      const scale = Math.max(0.6, 1 - abs * 0.16) * moveScale;
      const bright = Math.max(0.45, 1 - abs * 0.22 - moveDim);
      const hidden = abs > 2.6;
      card.style.transform = `translate(-50%, -50%) translateX(${(offset * STEP).toFixed(3)}%) scale(${scale.toFixed(4)})`;
      card.style.zIndex = String(100 - Math.round(abs * 10));
      card.style.opacity = hidden ? '0' : '1';
      card.style.filter = motionBlur > 0.05
        ? `brightness(${bright.toFixed(3)}) blur(${motionBlur.toFixed(2)}px)`
        : `brightness(${bright.toFixed(3)})`;
      card.style.pointerEvents = hidden ? 'none' : 'auto';
    });
    setActive(Math.round(clampN(center, 0, N - 1)));
  }

  function draw() { if (!mobileMq.matches) layout(clampN(pos, 0, N - 1)); }

  function frame(t) {
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    let running = false;
    if (dragging) running = true;
    else if (flinging) {
      pos += vel * dt;
      vel *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(vel) <= VEL_MIN || pos <= 0 || pos >= N - 1) { vel = 0; flinging = false; snapTarget = Math.round(clampN(pos, 0, N - 1)); }
      running = true;
    } else if (vel !== 0) {
      pos += vel * dt;
      snapTarget = null;
      running = true;
    } else if (snapTarget !== null) {
      pos += (snapTarget - pos) * SNAP_EASE;
      if (Math.abs(snapTarget - pos) < 0.001) { pos = snapTarget; snapTarget = null; }
      else running = true;
    }
    pos = clampN(pos, 0, N - 1);
    if (running) {
      const speed = Math.abs(pos - prevPos) / dt;
      const target = Math.min(MAX_BLUR, Math.max(0, speed - BLUR_MIN_SPEED) * BLUR_PER_SPEED);
      motionBlur += (target - motionBlur) * 0.4;
      if (motionBlur < 0.05) motionBlur = 0;
    } else motionBlur = 0;
    prevPos = pos;
    draw();
    rafId = running ? requestAnimationFrame(frame) : null;
  }
  function ensureLoop() { if (rafId == null) { lastT = 0; rafId = requestAnimationFrame(frame); } }
  function settle() { vel = 0; snapTarget = Math.round(pos); ensureLoop(); }
  function step(dir) {
    vel = 0;
    const from = snapTarget !== null ? snapTarget : Math.round(pos);
    snapTarget = clampN(from + dir, 0, N - 1);
    ensureLoop();
  }
  function focusCard(i) { vel = 0; snapTarget = clampN(i, 0, N - 1); ensureLoop(); }

  /* Pointer: drag to scrub with flick momentum; hover the edges to glide */
  let startX = 0, startPos = 0, lastX = 0, lastMoveT = 0, dragVel = 0, pxPerCard = 300;
  let suppressClick = false, pointerId = null;

  reel.addEventListener('pointerdown', e => {
    if (mobileMq.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
    startX = lastX = e.clientX;
    startPos = pos;
    lastMoveT = performance.now();
    dragVel = 0; dragging = true; flinging = false; suppressClick = false;
    pointerId = e.pointerId; vel = 0; snapTarget = null;
    pxPerCard = Math.max(80, cards[0].offsetWidth * STEP / 100);
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  });

  reel.addEventListener('pointermove', e => {
    if (mobileMq.matches) return;
    if (dragging) {
      const now = performance.now();
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6 && !suppressClick) {
        suppressClick = true;
        try { reel.setPointerCapture(e.pointerId); } catch (_) {}
      }
      pos = clampN(startPos - dx / pxPerCard, 0, N - 1);
      const ddt = (now - lastMoveT) / 1000;
      if (ddt > 0) dragVel = dragVel * 0.7 + (-((e.clientX - lastX) / pxPerCard) / ddt) * 0.3;
      lastX = e.clientX; lastMoveT = now;
      draw();
      return;
    }
    // Hover glide only over the side folders, never over the centre one,
    // so reading it or pressing its button never moves the reel.
    if (!canHover || reduce || flinging || (e.pointerType && e.pointerType !== 'mouse')) return;
    const r = reel.getBoundingClientRect();
    const dead = Math.min(0.9, cards[0].offsetWidth / r.width);
    const norm = clampN(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    const a = Math.abs(norm);
    if (a <= dead) { vel = 0; if (snapTarget === null) snapTarget = Math.round(pos); }
    else { const m = (a - dead) / (1 - dead); vel = Math.sign(norm) * m * m * MAX_SPEED; }
    ensureLoop();
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (pointerId != null) { try { reel.releasePointerCapture(pointerId); } catch (_) {} pointerId = null; }
    if (Math.abs(dragVel) > FLICK_MIN) { vel = clampN(dragVel * FLICK_MULT, -MAX_FLING, MAX_FLING); flinging = true; ensureLoop(); }
    else settle();
    setTimeout(() => { suppressClick = false; }, 0);
  };
  reel.addEventListener('pointerup', endDrag);
  reel.addEventListener('pointercancel', endDrag);
  if (canHover && !reduce) reel.addEventListener('pointerleave', () => { if (!dragging && !flinging) settle(); });

  // Clicks: a drag never counts as a click, and clicking a side folder
  // (or its button) just brings that folder to the centre.
  reel.addEventListener('click', e => {
    if (mobileMq.matches) return;
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
    const card = e.target.closest('.cfs__card');
    if (!card) return;
    const i = cards.indexOf(card);
    if (i !== Math.round(pos)) { e.preventDefault(); e.stopPropagation(); focusCard(i); }
  }, true);

  // Arrow keys while the reel is on screen (not while a file is open)
  let inView = false;
  new IntersectionObserver(en => { inView = en[0].isIntersecting; }, { threshold: 0.3 }).observe(reel);
  window.addEventListener('keydown', e => {
    if (!inView || mobileMq.matches || document.documentElement.classList.contains('cv-open')) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  // Sideways trackpad swipe steps the reel; vertical scrolling passes through
  let wheelAcc = 0;
  reel.addEventListener('wheel', e => {
    if (mobileMq.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    let d = e.deltaX;
    if (e.deltaMode === 1) d *= 16;
    if (!d) return;
    e.preventDefault();
    vel = 0;
    wheelAcc += d;
    while (Math.abs(wheelAcc) >= 120) { step(wheelAcc > 0 ? 1 : -1); wheelAcc -= Math.sign(wheelAcc) * 120; }
  }, { passive: false });

  /* ── Phones: plain column, the folder mid-screen is the open one ── */
  const mobileIo = new IntersectionObserver(entries => {
    if (!mobileMq.matches) return;
    entries.forEach(en => { if (en.isIntersecting) setActive(cards.indexOf(en.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  cards.forEach(c => mobileIo.observe(c));

  function applyMode() {
    if (mobileMq.matches) {
      cards.forEach(c => { c.style.transform = ''; c.style.zIndex = ''; c.style.opacity = ''; c.style.filter = ''; c.style.pointerEvents = ''; });
    } else draw();
  }
  mobileMq.addEventListener ? mobileMq.addEventListener('change', applyMode) : mobileMq.addListener(applyMode);
  window.addEventListener('resize', () => requestAnimationFrame(draw));
  applyMode();
})();
