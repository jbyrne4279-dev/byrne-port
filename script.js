/* ============================================================
   JOSEPH BYRNE PORTFOLIO — script.js
   ============================================================ */

'use strict';

/* ── CUSTOM CURSOR ── */
(function initCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(hover: none)').matches) return;

  let mx = 0, my = 0, cx = 0, cy = 0;
  let raf;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  function tick() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const hoverTargets = 'a, button, .project-card, .skill-tag, .academic-row, .filter-btn';
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('cursor--hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--hover'));
  });

  // Red cursor trail flash on click
  document.addEventListener('mousedown', () => {
    cursor.style.opacity = '1';
    cursor.style.border = '1px solid var(--red, #B00020)';
    cursor.style.boxShadow = '0 0 24px rgba(176,0,32,0.7), inset 0 0 16px rgba(176,0,32,0.3)';
  });
  document.addEventListener('mouseup', () => {
    cursor.style.opacity = '';
    cursor.style.border = '';
    cursor.style.boxShadow = '';
  });
})();

/* ── NAV: scroll state + active link ── */
(function initNav() {
  const nav     = document.getElementById('nav');
  const links   = nav.querySelectorAll('.nav__links a');
  const sections = document.querySelectorAll('section[id]');

  // Scroll background
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Active link via IntersectionObserver
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(s => io.observe(s));
})();

/* ── MOBILE MENU ── */
(function initMobileMenu() {
  const btn       = document.getElementById('menuBtn');
  const menu      = document.getElementById('mobileMenu');
  const closeBtn  = document.getElementById('menuClose');
  const mobileLinks = menu.querySelectorAll('.mobile-link');

  function open() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    btn.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    btn.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => menu.classList.contains('is-open') ? close() : open());
  closeBtn.addEventListener('click', close);
  mobileLinks.forEach(a => a.addEventListener('click', close));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ── PROJECTS CINEMA CAROUSEL (coverflow + filter) ── */
(function initCarousel() {
  const carousel = document.getElementById('projectCarousel');
  const stage    = document.getElementById('carouselStage');
  if (!carousel || !stage) return;

  const btns     = Array.from(document.querySelectorAll('.filter-btn'));
  const allCards = Array.from(stage.querySelectorAll('.project-card'));

  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let visible    = allCards.slice();               // cards in the current filter
  let pos        = Math.floor(visible.length / 2); // current centre (float, unbounded)
  let vel        = 0;                              // scroll speed (cards/sec) from cursor
  let snapTarget = null;                           // eased target for click / keyboard
  let lastT      = 0;                              // last frame timestamp
  let rafId      = null;

  const MAX_SPEED = 5.5;   // cards/sec the reel scrolls at the far edge
  const DEAD      = 0.10;  // central rest zone (fraction of half width)
  const SNAP_EASE = 0.22;  // ease factor when settling onto a card

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
      const bright = Math.max(0.7, 1 - abs * 0.08);
      const hidden = abs > p.maxVis + 0.5;

      card.style.transform =
        `translate(-50%, -50%) translateX(${tx}%) translateZ(${tz}px) ` +
        `rotateY(${rot}deg) scale(${scale})`;
      card.style.zIndex  = String(100 - Math.round(abs));
      card.style.opacity = hidden ? '0' : '1';
      card.style.filter  = `brightness(${bright})`;
      card.style.pointerEvents = hidden ? 'none' : 'auto';
      card.classList.toggle('is-active', i === centreIndex);
    });
  }

  function draw() {
    let c = pos;
    if (!isLoop()) c = clampN(c, 0, visible.length - 1);
    layout(c);
  }

  // Single rAF loop. The cursor sets a scroll velocity (hold the mouse to
  // one side and the reel keeps gliding + looping in that direction); when
  // there's no velocity it eases onto the nearest card and rests.
  function frame(t) {
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    let running = false;

    if (vel !== 0) {
      pos += vel * dt;                 // continuous cursor-driven scroll
      snapTarget = null;
      running = true;
    } else if (snapTarget !== null) {
      pos += (snapTarget - pos) * SNAP_EASE;
      if (Math.abs(snapTarget - pos) < 0.001) { pos = snapTarget; snapTarget = null; }
      else running = true;
    }

    if (!isLoop()) pos = clampN(pos, 0, visible.length - 1);
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

  // Centre a specific card via the shortest (possibly wrapped) path
  function focus(idx) {
    vel = 0;
    const N = visible.length;
    if (isLoop()) snapTarget = idx + N * Math.round((pos - idx) / N);
    else snapTarget = clampN(idx, 0, N - 1);
    ensureLoop();
  }

  // Click a side card to focus it; click the centred card to open it
  allCards.forEach(card => {
    const link = card.querySelector('.project-card__cover-link');
    card.addEventListener('click', e => {
      if (suppressClick) { e.preventDefault(); return; }
      const idx = visible.indexOf(card);
      if (idx === -1) return;
      const centreIndex = mod(Math.round(pos), visible.length);
      if (idx !== centreIndex) {
        e.preventDefault();       // don't navigate — just centre it
        focus(idx);
      } else if (link) {
        // whatever is in the middle → follow its project link
        e.preventDefault();
        window.location.href = link.getAttribute('href');
      }
    });
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
      pos        = Math.floor(visible.length / 2);
      vel        = 0;
      snapTarget = null;
      draw();
    });
  });

  // Cursor-reactive scrub (desktop pointers only) — the cursor's distance
  // from centre sets the scroll speed/direction, so holding the mouse to
  // one side keeps the reel gliding and looping that way. The middle is a
  // rest zone; leaving settles onto the nearest card.
  if (canHover && !reduce) {
    carousel.addEventListener('pointermove', e => {
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
    });
    carousel.addEventListener('pointerleave', settleToNearest);
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

  // Scroll-wheel navigation — spinning the wheel (or a trackpad swipe) over
  // the carousel steps through the reel. Accumulate delta so one notch is
  // roughly one card regardless of device.
  let wheelAcc = 0;
  const WHEEL_STEP = 120;
  carousel.addEventListener('wheel', e => {
    let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
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

  // Drag / swipe navigation (touch / coarse pointers)
  let startX = 0, dragging = false, suppressClick = false;
  if (!canHover) {
    carousel.addEventListener('pointerdown', e => {
      startX = e.clientX; dragging = true; suppressClick = false;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 8) suppressClick = true;
    });
    window.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
      setTimeout(() => { suppressClick = false; }, 0);
    });
  }

  let resizeRAF;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(draw);
  });

  draw();
})();

/* ── SCROLL REVEAL ── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ── CONTACT FORM ── */
(function initForm() {
  const form      = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  if (!form) return;

  function validate(field) {
    const group = field.closest('.form-group');
    const valid = field.checkValidity();
    group.classList.toggle('has-error', !valid);
    return valid;
  }

  form.querySelectorAll('input, textarea').forEach(field => {
    field.addEventListener('blur', () => validate(field));
    field.addEventListener('input', () => {
      if (field.closest('.form-group').classList.contains('has-error')) validate(field);
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    let allValid = true;
    form.querySelectorAll('input, textarea').forEach(field => {
      if (!validate(field)) allValid = false;
    });
    if (!allValid) return;

    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Sending…';

    try {
      const res = await fetch('https://formspree.io/f/xbdbnvye', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      if (!res.ok) throw new Error('Network error');
      submitBtn.innerHTML = 'Message Sent! ✓';
      submitBtn.style.background = '#2d7a4a';
      form.reset();
      form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.background = '';
      }, 3000);
    } catch (err) {
      submitBtn.innerHTML = 'Try Again';
      submitBtn.style.background = '#c0392b';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.background = '';
      }, 3000);
    }
  });
})();

/* ── SCANLINE INJECTION ── */
(function addScanlines() {
  document.querySelectorAll('.project-card__img').forEach(img => {
    const sl = document.createElement('div');
    sl.className = 'scanline';
    img.prepend(sl);
  });
})();

/* ── COUNT-UP ANIMATION ── */
(function initCountUp() {
  const DURATION = 1400;

  function runCount(el) {
    const raw = el.textContent.trim();
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const suffix = raw.replace(/[\d.]/g, '');
    const start = performance.now();

    el.textContent = '0' + suffix;

    function step(now) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = Math.round(eased * num) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        runCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.stat__num, .academic-row__pct').forEach(el => {
    observer.observe(el);
  });
})();


/* ── HERO MIST ── */
(function initHeroMist() {
  const canvas = document.getElementById('heroMist');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const COUNT = 30;
  const particles = [];

  function MistParticle(initialY) {
    this.reset = function(initial) {
      this.x          = Math.random() * canvas.width;
      this.y          = initial ? Math.random() * canvas.height : canvas.height + 60;
      this.radius     = 90 + Math.random() * 200;
      this.opacity    = 0;
      this.maxOpacity = 0.09 + Math.random() * 0.13;
      this.vy         = -(0.15 + Math.random() * 0.45);
      this.vx         = (Math.random() - 0.5) * 0.25;
      this.phase      = Math.random() * Math.PI * 2;
      this.growing    = true;
      this.color      = Math.random() > 0.35
        ? `216,20,40`   // blood red
        : `140,10,24`;  // darker wine
    };
    this.reset(!!initialY);

    this.update = function() {
      this.y     += this.vy;
      this.x     += this.vx + Math.sin(this.phase) * 0.18;
      this.phase += 0.004;

      if (this.growing) {
        this.opacity = Math.min(this.opacity + 0.003, this.maxOpacity);
        if (this.opacity >= this.maxOpacity) this.growing = false;
      } else {
        this.opacity -= 0.0008;
      }

      if (this.opacity <= 0 || this.y < -this.radius * 2) this.reset(false);
    };

    this.draw = function() {
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      g.addColorStop(0,   `rgba(${this.color},${this.opacity})`);
      g.addColorStop(0.45,`rgba(${this.color},${this.opacity * 0.55})`);
      g.addColorStop(1,   `rgba(${this.color},0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(new MistParticle(true));

  ctx.globalCompositeOperation = 'lighter';

  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  })();
})();

/* ── HEADING TERMINAL FLICKER ── */
/* Decodes heading text in from random terminal glyphs, like a console
   resolving a string, then re-flickers it on an ambient interval and
   on hover. Applies to the hero h1 and each section's main heading.
   Exposed on window so project.js can (re)trigger it once the real
   project title replaces the "Loading…" placeholder. */
window.TerminalFlicker = (function () {
  const CHARS = '!<>-_\\/[]{}=+*^?#01';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scramble(el, finalText, { duration = 650, attr } = {}) {
    if (reduceMotion || !finalText) {
      el.textContent = finalText;
      if (attr) el.setAttribute(attr, finalText);
      return;
    }

    const len   = finalText.length;
    const start = performance.now();
    el.classList.add('is-decoding');

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const revealCount = Math.floor(t * len);
      let out = '';
      for (let i = 0; i < len; i++) {
        out += (finalText[i] === ' ' || i < revealCount)
          ? finalText[i]
          : CHARS[(Math.random() * CHARS.length) | 0];
      }
      el.textContent = out;
      if (attr) el.setAttribute(attr, out);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = finalText;
        if (attr) el.setAttribute(attr, finalText);
        el.classList.remove('is-decoding');
      }
    }
    requestAnimationFrame(tick);
  }

  function arm(h1, { repeat = true } = {}) {
    if (!h1 || h1._flickerArmed) return;
    h1._flickerArmed = true;

    // Elements with data-text (e.g. hero__name-line spans) keep their
    // attribute in sync with the scrambled/resolved text.
    const lines   = h1.querySelectorAll('[data-text]');
    const targets = lines.length ? Array.from(lines) : [h1];

    targets.forEach(t => {
      t._flickerText = t.hasAttribute('data-text') ? t.getAttribute('data-text') : t.textContent;
    });

    function run() {
      targets.forEach(t => scramble(t, t._flickerText, {
        attr: t.hasAttribute('data-text') ? 'data-text' : null
      }));
    }

    run();
    if (repeat && !reduceMotion) {
      setInterval(run, 20000);
    }

    // Hover: scramble continuously while the pointer is over the h1,
    // then decode back to the real text once it leaves.
    if (!reduceMotion) {
      let hovering = false;

      function hoverFrame() {
        if (!hovering) return;
        targets.forEach(t => {
          const text = t._flickerText;
          let out = '';
          for (let i = 0; i < text.length; i++) {
            out += text[i] === ' ' ? ' ' : CHARS[(Math.random() * CHARS.length) | 0];
          }
          t.textContent = out;
          if (t.hasAttribute('data-text')) t.setAttribute('data-text', out);
        });
        requestAnimationFrame(hoverFrame);
      }

      h1.addEventListener('mouseenter', () => {
        if (hovering) return;
        hovering = true;
        targets.forEach(t => t.classList.add('is-decoding'));
        requestAnimationFrame(hoverFrame);
      });

      h1.addEventListener('mouseleave', () => {
        hovering = false;
        run();
      });
    }
  }

  const HEADING_SELECTOR = 'h1:not([data-flicker-manual]), h2.section__title, h2.about__heading';
  document.querySelectorAll(HEADING_SELECTOR).forEach(h1 => arm(h1));

  return { arm };
})();

/* ── TYPE-IN TEXT REVEAL ── */
/* Fades body copy in word by word, typewriter-style, once it scrolls
   into view. Words wrap in place around any existing inline markup
   (the red highlight spans in the about/websites copy) so only the
   opacity/position animate — colors and structure are untouched.
   Exposed on window so project.js can run it on description
   paragraphs it injects after this script has already scanned the DOM. */
window.TypeReveal = (function () {
  const STAGGER     = 25;  // ms between each word's reveal
  const MAX_STAGGER = 450; // cap so long paragraphs don't crawl
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-typed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  function wrapWords(node, counter) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (part === '') return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'word-fade';
          span.style.transitionDelay = Math.min(counter.i++ * STAGGER, MAX_STAGGER) + 'ms';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(child => wrapWords(child, counter));
    }
  }

  function run(el) {
    if (!el || el._typeArmed || !el.textContent.trim()) return;
    el._typeArmed = true;
    if (reduceMotion) return;

    wrapWords(el, { i: 0 });

    // Project card descriptions are hidden (opacity: 0) until the card
    // is hovered, so scroll-visibility isn't the right trigger for them —
    // type in on the first hover instead, once, like everything else.
    const card = el.closest('.project-card');
    if (card) {
      card.addEventListener('mouseenter', () => el.classList.add('is-typed'), { once: true });
      return;
    }

    // Delayed past the h1 terminal-scramble window (TerminalFlicker's
    // default duration is 650ms) before the first intersection check.
    // The scramble forces a monospace font on the title while it runs,
    // which briefly changes its line-wrap and shifts everything below
    // it — including, on project pages, this description. Observing too
    // early can catch that transient layout and mark an element that's
    // really below the fold as already-visible, permanently unobserving
    // it before it ever gets to animate.
    setTimeout(() => io.observe(el), 800);
  }

  document.querySelectorAll('.type-reveal').forEach(run);

  return { run };
})();

/* ── SMOOTH ANCHOR SCROLL (cross-browser fallback) ── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
