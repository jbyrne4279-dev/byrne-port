/* Coverflow carousel — ported from script.js for the coursework section */
'use strict';
(function initCarousel() {
  const carousel = document.getElementById('projectCarousel');
  const stage    = document.getElementById('carouselStage');
  if (!carousel || !stage) return;

  const btns     = Array.from(document.querySelectorAll('.filter-btn'));
  const allCards = Array.from(stage.querySelectorAll('.project-card'));

  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Centre on the clothing-brand project when it's in the given list,
  // otherwise fall back to the middle of that list.
  function startIndexIn(list) {
    const i = list.findIndex(c => {
      const link = c.querySelector('.project-card__cover-link');
      return link && /clothing-brand/.test(link.getAttribute('href') || '');
    });
    return i >= 0 ? i : Math.floor(list.length / 2);
  }

  let visible    = allCards.slice();               // cards in the current filter
  let pos        = startIndexIn(allCards);         // current centre (float, unbounded)
  let vel        = 0;                              // scroll speed (cards/sec)
  let snapTarget = null;                           // eased target for click / keyboard
  let lastT      = 0;                              // last frame timestamp
  let rafId      = null;
  let dragging   = false;                          // finger/mouse currently dragging
  let flinging   = false;                          // swipe momentum decaying
  let prevPos    = pos;                            // last frame's position (for speed)
  let motionBlur = 0;                              // current blur (px), from speed

  const MAX_SPEED = 7;     // cards/sec the reel scrolls at the far edge (hover)
  const DEAD      = 0.08;  // central rest zone (fraction of half width)
  const SNAP_EASE = 0.10;  // ease factor when settling onto a card (slow, cinematic glide)

  // Swipe / flick momentum: the speed of the swipe modifies the scroll speed
  const FRICTION   = 0.93;  // momentum decay per 60fps frame
  const FLICK_MULT = 1.25;  // swipe-speed → scroll-speed modifier
  const FLICK_MIN  = 1.4;   // min swipe speed (cards/sec) to fling
  const MAX_FLING  = 24;    // cap on fling speed (cards/sec)
  const VEL_MIN    = 0.2;   // momentum stops below this (cards/sec)

  // Motion blur driven by how fast the reel is actually moving on screen
  const BLUR_MIN_SPEED = 1.0;  // cards/sec below which there's no blur
  const BLUR_PER_SPEED = 1.5;  // px of blur per card/sec above the floor
  const MAX_BLUR       = 11;   // cap (px)
  const DIM_PER_SPEED  = 0.05; // extra darken per card/sec while transitioning

  // Responsive coverflow parameters
  function params() {
    const w = window.innerWidth;
    if (w < 560) return { step: 38, rot: 0, z: 40, maxVis: 2 };
    if (w < 900) return { step: 43, rot: 0, z: 55, maxVis: 3 };
    return { step: 40, rot: 0, z: 60, maxVis: 5 };
  }

  // The reel wraps into an infinite loop only when there are enough cards
  // to keep the wrap seam (offset ≈ N/2) hidden off-screen.
  function isLoop(p) {
    return visible.length > 2 * (p || params()).maxVis + 1;
  }

  const mod = (n, m) => ((n % m) + m) % m;

  // Render the reel for a fractional centre position
  function layout(center) {
    const p = params();
    const N = visible.length;
    const loop = isLoop(p);
    const centreIndex = mod(Math.round(center), N);

    visible.forEach((card, i) => {
      let offset = i - center;
      if (loop) offset -= N * Math.round(offset / N);  // shortest wrapped path
      const abs    = Math.abs(offset);
      const sign   = offset === 0 ? 0 : (offset > 0 ? 1 : -1);
      const clamp  = Math.min(abs, 3);

      const scale  = Math.max(0.55, 1 - abs * 0.14);
      const rot    = -sign * clamp * p.rot;
      const tx     = offset * p.step;           // % of card width
      const tz     = -abs * p.z;                // push side cards back
      // Cinematic dip: darken and pull back on top of the normal
      // side-card falloff while the reel is actually moving, so the
      // whole transition reads like a graded video cut rather than a
      // mechanical slide.
      const moveDim = Math.min(0.35, motionBlur * 0.03);
      const bright  = Math.max(0.55, 1 - abs * 0.08 - moveDim);
      const hidden  = abs > p.maxVis + 0.5;
      const moveScale = 1 - Math.min(0.04, motionBlur * 0.004);

      card.style.transform =
        `translate(-50%, -50%) translateX(${tx}%) translateZ(${tz}px) ` +
        `rotateY(${rot}deg) scale(${(scale * moveScale).toFixed(4)})`;
      card.style.zIndex  = String(100 - Math.round(abs));
      card.style.opacity = hidden ? '0' : '1';
      card.style.filter  = motionBlur > 0.05
        ? `brightness(${bright.toFixed(3)}) blur(${motionBlur.toFixed(2)}px) saturate(${(1 - moveDim * 0.6).toFixed(3)})`
        : `brightness(${bright.toFixed(3)})`;
      card.style.pointerEvents = hidden ? 'none' : 'auto';
      card.classList.toggle('is-active', i === centreIndex);
    });
  }

  function draw() {
    let c = pos;
    if (!isLoop()) c = clampN(c, 0, visible.length - 1);
    layout(c);
  }

  // Single rAF loop handling four modes, in priority:
  //  · dragging  — pos is set live in pointermove; keep the loop alive
  //  · flinging  — swipe momentum: glide on and decay by friction, then snap
  //  · vel != 0  — cursor-held scroll (hold the mouse to one side)
  //  · snapTarget— ease onto the nearest / chosen card and rest
  function frame(t) {
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    let running = false;

    if (dragging) {
      running = true;                        // pos updated by pointermove
    } else if (flinging) {
      pos += vel * dt;
      vel *= Math.pow(FRICTION, dt * 60);    // frame-rate-independent decay
      if (Math.abs(vel) <= VEL_MIN) { vel = 0; flinging = false; snapTarget = Math.round(pos); }
      running = true;
    } else if (vel !== 0) {
      pos += vel * dt;                        // continuous cursor-driven scroll
      snapTarget = null;
      running = true;
    } else if (snapTarget !== null) {
      pos += (snapTarget - pos) * SNAP_EASE;
      if (Math.abs(snapTarget - pos) < 0.001) { pos = snapTarget; snapTarget = null; }
      else running = true;
    }

    if (!isLoop()) pos = clampN(pos, 0, visible.length - 1);

    // Motion blur from the reel's real on-screen speed (cards/sec)
    if (running) {
      const speed = Math.abs(pos - prevPos) / dt;
      const target = Math.min(MAX_BLUR, Math.max(0, speed - BLUR_MIN_SPEED) * BLUR_PER_SPEED);
      motionBlur += (target - motionBlur) * 0.4;
      if (motionBlur < 0.05) motionBlur = 0;
    } else {
      motionBlur = 0;
    }
    prevPos = pos;

    draw();
    rafId = running ? requestAnimationFrame(frame) : null;
  }

  function ensureLoop() {
    if (rafId == null) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  function settleToNearest() {
    vel = 0;
    snapTarget = Math.round(pos);
    ensureLoop();
  }

  // Step by ±1 (keyboard / wheel / swipe); loops forever when looping is on.
  // Accumulates off the pending target so rapid steps add up (e.g. spinning
  // the wheel) instead of collapsing onto the same card.
  function step(dir) {
    vel = 0;
    const from = (snapTarget !== null) ? snapTarget : Math.round(pos);
    snapTarget = from + dir;
    if (!isLoop()) snapTarget = clampN(snapTarget, 0, visible.length - 1);
    ensureLoop();
  }

  // Centre a specific card via the shortest (possibly wrapped) path.
  // `instant` snaps straight there (used for clicks) instead of easing.
  function focus(idx, instant) {
    vel = 0;
    const N = visible.length;
    const target = isLoop() ? idx + N * Math.round((pos - idx) / N)
                             : clampN(idx, 0, N - 1);
    if (instant) {
      pos = target;
      snapTarget = null;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      draw();
    } else {
      snapTarget = target;
      ensureLoop();
    }
  }

  // Delegated click: click a side card to jump straight to it; click the
  // centred card to open it. Delegating (instead of per-card listeners) is
  // robust against pointer-capture retargeting and the 3D transforms, which
  // offset each card's hit-box from where it visually appears — so we resolve
  // the target by hit-test first, then fall back to the nearest card by x.
  carousel.addEventListener('click', e => {
    if (suppressClick) { e.preventDefault(); return; }
    const N = visible.length;
    if (!N) return;

    let card = document.elementFromPoint(e.clientX, e.clientY);
    card = card && card.closest ? card.closest('.project-card') : null;
    if (!card || visible.indexOf(card) === -1) {
      // No direct hit — pick the visible card whose centre is nearest the click
      let best = null, bestD = Infinity;
      visible.forEach(c => {
        if (getComputedStyle(c).opacity === '0') return;
        const r = c.getBoundingClientRect();
        const d = Math.abs((r.left + r.width / 2) - e.clientX);
        if (d < bestD) { bestD = d; best = c; }
      });
      card = best;
    }
    const idx = card ? visible.indexOf(card) : -1;
    if (idx === -1) return;

    const centreIndex = mod(Math.round(pos), N);
    if (idx !== centreIndex) {
      e.preventDefault();          // side card → just centre it, instantly
      focus(idx, true);
    } else {
      const link = card.querySelector('.project-card__cover-link');
      if (link) {                  // centred card → open its project
        e.preventDefault();
        window.location.href = link.getAttribute('href');
      }
    }
  });

  // Filter buttons rebuild the visible set
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const filter = btn.dataset.filter;
      allCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
        card.style.display = match ? '' : 'none';
      });
      visible    = allCards.filter(c => c.style.display !== 'none');
      pos        = startIndexIn(visible);
      vel        = 0;
      snapTarget = null;
      draw();
    });
  });

  // ── Pointer interaction: drag-to-scrub with flick momentum (all pointers)
  //    plus, on fine pointers, cursor-position velocity scrubbing ──
  let startX = 0, startPos = 0, lastX = 0, lastMoveT = 0, dragVel = 0;
  let suppressClick = false;

  // Cached instead of read on every pointermove: offsetWidth forces a
  // synchronous layout, and reading it after every drag frame's style
  // writes (in draw()) was forcing that layout on *every single*
  // finger movement — the actual cause of the swipe lag. Recomputed
  // once per drag (cheap) and on resize, not per pixel of movement.
  let cachedPxPerCard = 100;
  function pxPerCard() {
    const w = allCards[0] ? allCards[0].offsetWidth
                          : carousel.getBoundingClientRect().width * 0.3;
    return Math.max(60, w * (params().step / 100));
  }
  window.addEventListener('resize', () => { cachedPxPerCard = pxPerCard(); }, { passive: true });

  let activePointerId = null;

  carousel.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = lastX = e.clientX;
    startPos = pos;
    lastMoveT = performance.now();
    dragVel = 0;
    dragging = true;
    flinging = false;
    suppressClick = false;
    activePointerId = e.pointerId;
    vel = 0;
    snapTarget = null;
    cachedPxPerCard = pxPerCard(); // one layout read for the whole drag
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    // NOTE: pointer capture is deferred until an actual drag starts (below).
    // Capturing on pointerdown makes the follow-up `click` fire on the
    // carousel instead of the card, which breaks clicking cards on desktop.
  });

  carousel.addEventListener('pointermove', e => {
    // Active drag: track the pointer 1:1 and measure its speed for the flick
    if (dragging) {
      const now = performance.now();
      const ppc = cachedPxPerCard;
      const dx  = e.clientX - startX;
      if (Math.abs(dx) > 6 && !suppressClick) {
        suppressClick = true;              // it's a drag, not a click
        try { carousel.setPointerCapture(e.pointerId); } catch (_) {}
      }
      pos = startPos - dx / ppc;
      if (!isLoop()) pos = clampN(pos, 0, visible.length - 1);
      const ddt = (now - lastMoveT) / 1000;
      if (ddt > 0) {
        const instant = -((e.clientX - lastX) / ppc) / ddt;  // cards/sec
        dragVel = dragVel * 0.7 + instant * 0.3;             // smooth the estimate
      }
      lastX = e.clientX;
      lastMoveT = now;
      draw();
      return;
    }
    // Cursor-position velocity scrub (fine pointers, when idle)
    if (canHover && !reduce && !flinging) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const r = carousel.getBoundingClientRect();
      const norm = clampN(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      const a = Math.abs(norm);
      if (a <= DEAD) {
        vel = 0;
        if (snapTarget === null) snapTarget = Math.round(pos);  // rest on a card
      } else {
        const m = (a - DEAD) / (1 - DEAD);          // 0..1 outside the dead zone
        vel = Math.sign(norm) * m * m * MAX_SPEED;  // quadratic: fine near centre
      }
      ensureLoop();
    }
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (activePointerId != null) {
      try { carousel.releasePointerCapture(activePointerId); } catch (_) {}
      activePointerId = null;
    }
    // The swipe's speed becomes the scroll speed: a faster flick sends the
    // reel further and quicker; a gentle release just settles on a card.
    if (Math.abs(dragVel) > FLICK_MIN) {
      vel = clampN(dragVel * FLICK_MULT, -MAX_FLING, MAX_FLING);
      flinging = true;
      ensureLoop();
    } else {
      settleToNearest();
    }
    setTimeout(() => { suppressClick = false; }, 0);
  };
  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);

  // Leaving with a fine pointer settles onto a card (unless mid-fling/drag)
  if (canHover && !reduce) {
    carousel.addEventListener('pointerleave', () => {
      if (dragging || flinging) return;
      settleToNearest();
    });
  }

  // Track whether the carousel is on screen, so global arrow/wheel input
  // only drives it while it's actually in view.
  let inView = false;
  new IntersectionObserver(
    entries => { inView = entries[0].isIntersecting; },
    { threshold: 0.25 }
  ).observe(carousel);

  // Keyboard navigation — works whenever the carousel is on screen (no need
  // to click it first). Left/Right don't scroll the page, so intercepting
  // them is safe.
  window.addEventListener('keydown', e => {
    if (!inView) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  // Scroll-wheel navigation — a horizontal trackpad swipe over the carousel
  // steps through the reel. Vertical wheel input (a normal mouse wheel, or
  // scrolling the page on a trackpad) is left alone so the page keeps
  // scrolling normally instead of getting stuck scrubbing the reel.
  // Accumulate delta so one notch is roughly one card regardless of device.
  let wheelAcc = 0;
  const WHEEL_STEP = 120;
  carousel.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;  // vertical → let the page scroll
    let d = e.deltaX;
    if (e.deltaMode === 1) d *= 16;   // line units → approx pixels
    if (d === 0) return;
    e.preventDefault();               // scrub the reel instead of the page
    vel = 0;                          // wheel overrides hover-scroll
    wheelAcc += d;
    while (Math.abs(wheelAcc) >= WHEEL_STEP) {
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP;
    }
  }, { passive: false });

  let resizeRAF;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(draw);
  });

  draw();
  cachedPxPerCard = pxPerCard();
})();
