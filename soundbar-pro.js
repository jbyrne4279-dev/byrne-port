(() => {
  'use strict';

  /* ── SCROLL REVEAL ── */
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-scale');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(el => io.observe(el));

  /* ── HERO always visible on load (no scroll needed) ── */
  document.querySelectorAll('.sb-hero__content .reveal-up').forEach(el => {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  });

  /* ── STAT BARS + COUNT-UP ── */
  function animateStat(stat) {
    const bar = stat.querySelector('.sb-stat__bar');
    const valueEl = stat.querySelector('.sb-stat__value');
    if (!bar || !valueEl) return;
    const target = parseInt(bar.dataset.target, 10) || 0;

    bar.style.width = Math.min(target, 100) + '%';

    const duration = 1100;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      valueEl.textContent = Math.round(eased * target) + '%';
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* Observe the chart container (rows use display:contents and have no box) */
  document.querySelectorAll('.sb-stats').forEach(chart => {
    const rows = Array.from(chart.querySelectorAll('.sb-stat'));
    const statIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        rows.forEach((row, i) => setTimeout(() => animateStat(row), i * 140));
        statIO.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    statIO.observe(chart);
  });

  /* ── LETTER-BY-LETTER FADE-IN ── */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.reveal-letters[data-split]').forEach(el => {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let letterIndex = 0;
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        el.appendChild(document.createElement('br'));
        return;
      }
      const extraClass = node.nodeType === Node.ELEMENT_NODE ? node.className : '';
      const text = node.textContent || '';
      Array.from(text).forEach(ch => {
        const span = document.createElement('span');
        span.className = extraClass ? 'sb-letter ' + extraClass : 'sb-letter';
        span.textContent = ch === ' ' ? ' ' : ch;
        if (!reduceMotion) {
          span.style.transitionDelay = (letterIndex * 0.028) + 's';
        }
        letterIndex += 1;
        el.appendChild(span);
      });
    });
  });

  const letterEls = document.querySelectorAll('.reveal-letters');
  const letterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        letterIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
  letterEls.forEach(el => letterIO.observe(el));

  /* ── SLIDESHOWS: autoplay, drag-to-swipe, motion blur ── */
  const reduceMotionSlides = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sb-slideshow').forEach(slideshow => {
    const track = slideshow.querySelector('.sb-slideshow__track');
    const slides = Array.from(track.querySelectorAll('.sb-slide'));
    const prevBtn = slideshow.querySelector('.sb-slideshow__arrow--prev');
    const nextBtn = slideshow.querySelector('.sb-slideshow__arrow--next');
    const dotsWrap = slideshow.querySelector('.sb-slideshow__dots');
    if (!track || !slides.length) return;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'sb-slideshow__dot';
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.addEventListener('click', () => {
        goTo(i);
        pauseAutoplay();
      });
      dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.querySelectorAll('.sb-slideshow__dot'));

    function currentIndex() {
      let closest = 0;
      let minDist = Infinity;
      slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft - track.scrollLeft);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      return closest;
    }

    function goTo(i, smooth = true) {
      const idx = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[idx].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    }

    function updateUI() {
      const idx = currentIndex();
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
    }

    /* Motion blur while the track is actively moving (scroll, drag, or autoplay) */
    let blurTimeout;
    function markMoving() {
      if (reduceMotionSlides) return;
      track.classList.add('is-moving');
      clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => track.classList.remove('is-moving'), 160);
    }

    let scrollTicking = false;
    track.addEventListener('scroll', () => {
      markMoving();
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => { updateUI(); scrollTicking = false; });
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', () => { goTo(currentIndex() - 1); pauseAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { goTo(currentIndex() + 1); pauseAutoplay(); });

    /* ── Drag-to-swipe (mouse + touch via pointer events) ── */
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let moved = false;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      moved = false;
      dragStartX = e.clientX;
      dragStartScroll = track.scrollLeft;
      track.classList.add('is-dragging');
      track.style.scrollSnapType = 'none';
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = dragStartScroll - dx;
      markMoving();
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove('is-dragging');
      track.style.scrollSnapType = '';
      if (moved) {
        goTo(currentIndex());
        pauseAutoplay();
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', () => { if (isDragging) endDrag(); });

    // Prevent images inside the track from triggering native browser drag-ghosting.
    track.querySelectorAll('img').forEach(img => { img.draggable = false; });

    /* ── Autoplay ── */
    let autoplayTimer = null;
    const AUTOPLAY_MS = 4500;
    function startAutoplay() {
      if (reduceMotionSlides || slides.length < 2) return;
      stopAutoplay();
      autoplayTimer = setInterval(() => {
        const idx = currentIndex();
        const next = idx >= slides.length - 1 ? 0 : idx + 1;
        goTo(next);
      }, AUTOPLAY_MS);
    }
    function stopAutoplay() {
      if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
    }
    let resumeTimeout;
    function pauseAutoplay() {
      stopAutoplay();
      clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(startAutoplay, 6000);
    }
    slideshow.addEventListener('mouseenter', stopAutoplay);
    slideshow.addEventListener('mouseleave', startAutoplay);

    updateUI();
    window.addEventListener('resize', updateUI);
    startAutoplay();
  });

  /* ── PARALLAX ── */
  const parallaxEls = document.querySelectorAll('.sb-parallax');
  if (parallaxEls.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        parallaxEls.forEach(el => {
          const rect = el.parentElement.getBoundingClientRect();
          const offset = rect.top * 0.15;
          el.style.transform = `translateY(${offset}px)`;
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── COLOR TOGGLE ── */
  (() => {
    const toggle = document.querySelector('.sb-color-toggle');
    const img = document.getElementById('sbHeroShotImg');
    if (!toggle || !img) return;
    const swatches = Array.from(toggle.querySelectorAll('.sb-color-swatch'));

    function selectColor(swatch) {
      const color = swatch.dataset.color;
      const src = img.dataset[color];
      if (!src) return;
      swatches.forEach(s => {
        s.classList.toggle('is-active', s === swatch);
        s.setAttribute('aria-pressed', s === swatch ? 'true' : 'false');
      });
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = src;
        img.style.opacity = '1';
      }, 180);
    }

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => selectColor(swatch));
    });

    /* Infinitely rotate through the finishes every 5s */
    if (swatches.length > 1) {
      setInterval(() => {
        const current = swatches.findIndex(s => s.classList.contains('is-active'));
        const next = swatches[(current + 1) % swatches.length];
        selectColor(next);
      }, 5000);
    }
  })();

  /* ── CONTACT FORM ── */
  (() => {
    const form = document.getElementById('sbContactForm');
    const submitBtn = document.getElementById('sbSubmitBtn');
    if (!form) return;

    function validate(field) {
      const group = field.closest('.sb-contact-field');
      const valid = field.checkValidity();
      group.classList.toggle('has-error', !valid);
      return valid;
    }

    form.querySelectorAll('input, textarea').forEach(field => {
      field.addEventListener('blur', () => validate(field));
      field.addEventListener('input', () => {
        if (field.closest('.sb-contact-field').classList.contains('has-error')) validate(field);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      let allValid = true;
      form.querySelectorAll('input, textarea').forEach(field => {
        if (!validate(field)) allValid = false;
      });
      if (!allValid) return;

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try {
        const res = await fetch('https://formspree.io/f/xbdbnvye', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(form)
        });
        if (!res.ok) throw new Error('Network error');
        submitBtn.textContent = 'Message Sent';
        form.reset();
        form.querySelectorAll('.sb-contact-field').forEach(g => g.classList.remove('has-error'));
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }, 3000);
      } catch (err) {
        submitBtn.textContent = 'Try Again';
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }, 3000);
      }
    });
  })();

  /* ── APPLE MUSIC — mouse-reactive parallax on the floating cards ── */
  (() => {
    const sec = document.getElementById('apple-music');
    if (!sec) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const floats = Array.from(sec.querySelectorAll('[data-depth]'));
    if (!floats.length) return;

    let raf = null, nx = 0, ny = 0;
    function apply() {
      raf = null;
      floats.forEach(el => {
        const d = parseFloat(el.dataset.depth) || 12;
        el.style.setProperty('--px', (nx * d).toFixed(1) + 'px');
        el.style.setProperty('--py', (ny * d).toFixed(1) + 'px');
      });
    }
    sec.addEventListener('pointermove', e => {
      const r = sec.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
      ny = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    sec.addEventListener('pointerleave', () => {
      nx = 0; ny = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  })();

})();
