/* Inspiration pop-it game — extracted from script.js */
'use strict';
(function initInspoPills() {
  const card = document.querySelector('.about-card--inspire');
  if (!card) return;
  const scatter = card.querySelector('.inspo-scatter');
  if (!scatter) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burst(pill) {
    if (reduce) return;
    const r = pill.getBoundingClientRect();
    const sr = scatter.getBoundingClientRect();
    const cx = r.left - sr.left + r.width / 2;
    const cy = r.top - sr.top + r.height / 2;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span');
      p.className = 'inspo-particle';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      scatter.appendChild(p);
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.6;
      const dist = 42 + Math.random() * 54;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
      ], { duration: 500 + Math.random() * 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
        .onfinish = () => p.remove();
    }
  }

  function popPill(pill, respawnMs) {
    burst(pill);
    pill.classList.add('is-popping');
    setTimeout(() => {
      pill.classList.remove('is-popping');
      pill.classList.add('is-hidden');
      setTimeout(() => {
        pill.classList.remove('is-hidden');
        // If the card has since faded out (dragged away), just restore silently.
        if (card.dataset.floating === '1') return;
        pill.classList.add('is-returning');
        setTimeout(() => pill.classList.remove('is-returning'), 520);
      }, respawnMs);
    }, 440);
  }

  /* ── 15-second bubble-pop mini-game ── */
  const gameEl = document.getElementById('inspoGame');
  const pills = Array.from(scatter.querySelectorAll('.inspo-pill'));
  const scoreB = gameEl && gameEl.querySelector('.inspo-game__score b');
  const timeB = gameEl && gameEl.querySelector('.inspo-game__time b');
  const resultB = gameEl && gameEl.querySelector('.inspo-game__result-score b');
  const DURATION = 15;
  let playing = false, score = 0, timeLeft = DURATION, tick = null;

  function startGame() {
    if (!gameEl) return;
    playing = true;
    score = 0;
    timeLeft = DURATION;
    if (scoreB) scoreB.textContent = '0';
    if (timeB) timeB.textContent = String(DURATION);
    gameEl.classList.remove('is-over');
    gameEl.classList.add('is-playing');
    card.classList.remove('is-over');
    card.classList.add('is-playing');
    // reset every bubble to a clean, clickable state
    pills.forEach(p => p.classList.remove('is-hidden', 'is-popping', 'is-returning'));

    clearInterval(tick);
    tick = setInterval(() => {
      timeLeft--;
      if (timeB) timeB.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  function endGame() {
    playing = false;
    clearInterval(tick);
    if (!gameEl) return;
    gameEl.classList.remove('is-playing');
    gameEl.classList.add('is-over');
    card.classList.remove('is-playing');
    card.classList.add('is-over');
    if (resultB) resultB.textContent = String(score);
  }

  if (gameEl) {
    gameEl.addEventListener('pointerup', e => {
      const btn = e.target.closest('[data-game="start"], [data-game="restart"]');
      if (btn) { e.preventDefault(); startGame(); }
    });
  }

  // Pop on pointerdown so taps register instantly on touch (click is laggy /
  // sometimes swallowed on mobile).
  let lastPop = 0;
  scatter.addEventListener('pointerdown', e => {
    const pill = e.target.closest('.inspo-pill');
    if (!pill || pill.classList.contains('is-hidden') || pill.classList.contains('is-popping')) return;
    // guard against the same touch firing twice
    const now = e.timeStamp || Date.now();
    if (now - lastPop < 40) return;
    lastPop = now;
    e.preventDefault();

    if (playing) {
      score++;
      if (scoreB) scoreB.textContent = String(score);
      popPill(pill, 500 + Math.random() * 700);   // bubbles reappear fast during play
    } else {
      popPill(pill, 5000);
    }
  });
})();
