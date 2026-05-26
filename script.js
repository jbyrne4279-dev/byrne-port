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

/* ── PORTFOLIO FILTER ── */
(function initFilter() {
  const btns  = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.project-card');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      btns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });
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

    // Visual feedback — swap to sent state
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Message Sent! ✓';
    submitBtn.style.background = '#2d7a4a';

    // Reset after 3 seconds
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
      submitBtn.style.background = '';
      form.reset();
      form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
    }, 3000);

    /* ── To wire up a real backend, replace the setTimeout block above with: ──
    try {
      const res = await fetch('YOUR_FORM_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!res.ok) throw new Error('Network error');
      submitBtn.innerHTML = 'Message Sent! ✓';
    } catch(err) {
      submitBtn.innerHTML = 'Try Again';
      submitBtn.style.background = '#c0392b';
    } finally {
      submitBtn.disabled = false;
    }
    ── */
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
      this.maxOpacity = 0.045 + Math.random() * 0.09;
      this.vy         = -(0.15 + Math.random() * 0.45);
      this.vx         = (Math.random() - 0.5) * 0.25;
      this.phase      = Math.random() * Math.PI * 2;
      this.growing    = true;
      this.color      = Math.random() > 0.35
        ? `176,0,32`    // blood red
        : `100,0,18`;   // darker wine
    };
    this.reset(!!initialY);

    this.update = function() {
      this.y     += this.vy;
      this.x     += this.vx + Math.sin(this.phase) * 0.18;
      this.phase += 0.004;

      if (this.growing) {
        this.opacity = Math.min(this.opacity + 0.0015, this.maxOpacity);
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

  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  })();
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
