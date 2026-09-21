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
  const stats = document.querySelectorAll('.sb-stat');
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const stat = entry.target;
      const bar = stat.querySelector('.sb-stat__bar');
      const valueEl = stat.querySelector('.sb-stat__value');
      const target = parseInt(bar.dataset.target, 10) || 0;

      bar.style.height = Math.min(target * 1.4, 100) + '%';

      const duration = 1100;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        valueEl.textContent = Math.round(eased * target) + '%';
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      statIO.unobserve(stat);
    });
  }, { threshold: 0.4 });
  stats.forEach(s => statIO.observe(s));

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

  /* ── POSITIONING SLIDESHOW ── */
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
        track.scrollTo({ left: slides[i].offsetLeft, behavior: 'smooth' });
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

    function updateUI() {
      const idx = currentIndex();
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
    }

    let scrollTicking = false;
    track.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => { updateUI(); scrollTicking = false; });
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', () => {
      const idx = Math.max(0, currentIndex() - 1);
      track.scrollTo({ left: slides[idx].offsetLeft, behavior: 'smooth' });
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const idx = Math.min(slides.length - 1, currentIndex() + 1);
      track.scrollTo({ left: slides[idx].offsetLeft, behavior: 'smooth' });
    });

    updateUI();
    window.addEventListener('resize', updateUI);
  });

  /* ── CONCEPT REVIEWS ── */
  (() => {
    const form = document.getElementById('reviewForm');
    if (!form) return;

    const STORAGE_KEY = 'soundbarPro.reviews';
    const starsWrap = document.getElementById('reviewStars');
    const stars = Array.from(starsWrap.querySelectorAll('.sb-star'));
    const nameInput = document.getElementById('reviewName');
    const textInput = document.getElementById('reviewText');
    const submitBtn = document.getElementById('reviewSubmit');
    const listEl = document.getElementById('reviewList');
    const scoreEl = document.getElementById('reviewScore');
    const countEl = document.getElementById('reviewCount');
    const summaryStarsEl = document.getElementById('reviewSummaryStars');

    let rating = 0;

    function loadReviews() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch (e) {
        return [];
      }
    }
    function saveReviews(reviews) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
      } catch (e) { /* storage unavailable */ }
    }
    const STAR_PATH = 'M10 1.5l2.63 5.53 6.1.62-4.55 4.13 1.28 5.97L10 14.77l-5.46 3-1.28-5.97-4.55-4.13 6.1-.62L10 1.5z';
    function starString(n) {
      return Array.from({ length: 5 }, (_, i) =>
        `<svg viewBox="0 0 20 20" class="${i < n ? 'is-filled' : ''}"><path d="${STAR_PATH}"/></svg>`
      ).join('');
    }
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function renderSummary(reviews) {
      if (!reviews.length) {
        scoreEl.textContent = '0.0';
        summaryStarsEl.innerHTML = starString(0);
        summaryStarsEl.removeAttribute('data-filled');
        countEl.textContent = 'No reviews yet';
        return;
      }
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      scoreEl.textContent = avg.toFixed(1);
      summaryStarsEl.innerHTML = starString(Math.round(avg));
      summaryStarsEl.setAttribute('data-filled', 'true');
      countEl.textContent = reviews.length + (reviews.length === 1 ? ' review' : ' reviews');
    }

    function renderList(reviews) {
      if (!reviews.length) {
        listEl.innerHTML = '<p class="sb-review-list__empty">Be the first to review this concept.</p>';
        return;
      }
      listEl.innerHTML = reviews.slice().reverse().map(r => `
        <div class="sb-review">
          <div class="sb-review__stars">${starString(r.rating)}</div>
          <div class="sb-review__meta">
            <span class="sb-review__name">${escapeHtml(r.name || 'Anonymous')}</span>
            <span class="sb-review__date">${escapeHtml(r.date)}</span>
          </div>
          <p class="sb-review__text">${escapeHtml(r.text)}</p>
        </div>
      `).join('');
    }

    function render() {
      const reviews = loadReviews();
      renderSummary(reviews);
      renderList(reviews);
    }

    function setRating(value) {
      rating = value;
      stars.forEach(star => {
        star.classList.toggle('is-filled', parseInt(star.dataset.value, 10) <= value);
      });
    }

    stars.forEach(star => {
      star.addEventListener('click', () => setRating(parseInt(star.dataset.value, 10)));
      star.addEventListener('mouseenter', () => {
        const v = parseInt(star.dataset.value, 10);
        stars.forEach(s => s.classList.toggle('is-filled', parseInt(s.dataset.value, 10) <= v));
      });
    });
    starsWrap.addEventListener('mouseleave', () => setRating(rating));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = textInput.value.trim();
      if (!rating || !text) {
        if (!rating) starsWrap.classList.add('sb-shake');
        setTimeout(() => starsWrap.classList.remove('sb-shake'), 400);
        return;
      }
      const reviews = loadReviews();
      reviews.push({
        rating,
        name: nameInput.value.trim().slice(0, 40),
        text: text.slice(0, 400),
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      });
      saveReviews(reviews);
      form.reset();
      setRating(0);
      render();
    });

    render();
  })();

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
})();
