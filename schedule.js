/* ============================================================
   MY WEEK | schedule.js
   Personal weekly timetable behind a passcode. The timetable itself
   lives encrypted in schedule-vault.js — to change it, see the notes at
   the top of tools/schedule-vault.mjs (decrypt → edit → encrypt).
   ============================================================ */

'use strict';

/* ── Passcode lock ──
   The passcode is never stored in the code: it derives the key that
   decrypts the vault, so a wrong code simply fails to decrypt. */
(function initLock() {
  const vault = window.SCHEDULE_VAULT;
  const KEY_STORE = 'jb-schedule-key';
  const lock = document.getElementById('scLock');
  const app = document.getElementById('scApp');
  const dotsEl = document.getElementById('scDots');
  const msg = document.getElementById('scLockMsg');
  const pad = document.getElementById('scPad');
  if (!vault || !lock || !app) return;

  const { subtle } = window.crypto || {};
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const LEN = vault.len || 4;
  let entry = '';
  let busy = false;

  dotsEl.innerHTML = '<i></i>'.repeat(LEN);
  const dots = [...dotsEl.children];

  async function decryptWith(key) {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  async function keyFromPin(pin) {
    const base = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(vault.salt), iterations: vault.iter },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }

  function open(data) {
    lock.hidden = true;
    app.hidden = false;
    document.body.classList.remove('is-locked');
    initSchedule(data);
  }

  function paint() {
    dots.forEach((d, i) => d.classList.toggle('is-on', i < entry.length));
  }

  async function submit() {
    busy = true;
    msg.textContent = 'Unlocking…';
    try {
      const key = await keyFromPin(entry);
      const data = await decryptWith(key);
      // Remember this device so the code isn't needed every visit
      try { localStorage.setItem(KEY_STORE, b64(await subtle.exportKey('raw', key))); } catch (e) {}
      msg.textContent = '';
      open(data);
    } catch (e) {
      msg.textContent = 'Wrong passcode';
      dotsEl.classList.remove('is-wrong');
      void dotsEl.offsetWidth;
      dotsEl.classList.add('is-wrong');
      if (navigator.vibrate) navigator.vibrate(120);
      entry = '';
      paint();
    }
    busy = false;
  }

  function press(k) {
    if (busy) return;
    if (k === 'del') entry = entry.slice(0, -1);
    else if (/^\d$/.test(k) && entry.length < LEN) entry += k;
    if (entry.length && msg.textContent === 'Wrong passcode') msg.textContent = '';
    paint();
    if (entry.length === LEN) submit();
  }

  pad.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) press(b.dataset.k);
  });
  document.addEventListener('keydown', e => {
    if (lock.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  });

  document.getElementById('scLockBtn').addEventListener('click', () => {
    try { localStorage.removeItem(KEY_STORE); } catch (e) {}
    location.reload();
  });

  if (!subtle) {
    msg.textContent = 'This browser can’t unlock the timetable. Try Safari or Chrome.';
    return;
  }

  // Already unlocked on this device?
  (async () => {
    let saved = null;
    try { saved = localStorage.getItem(KEY_STORE); } catch (e) {}
    if (saved) {
      try {
        const key = await subtle.importKey('raw', unb64(saved), 'AES-GCM', false, ['decrypt']);
        open(await decryptWith(key));
        return;
      } catch (e) {
        // Timetable re-encrypted or passcode changed: ask again
        try { localStorage.removeItem(KEY_STORE); } catch (err) {}
      }
    }
    lock.hidden = false;
  })();
})();

/* ── Timetable ── */
function initSchedule(data) {
  // Each kind has a label and an Apple system colour; `routine` (lunch)
  // stays out of the day dots and weekly totals.
  const KINDS = data.kinds;
  // Days with no training or uni
  const REST_DAYS = data.rest;
  // Monday (0) to Sunday (6); `flex: true` marks a suggested slot (gym)
  const WEEK = data.week;

  const DAY_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const VIEW_KEY = 'jb-schedule-view';

  const $ = id => document.getElementById(id);
  const els = {
    date: $('scDate'), now: $('scNow'), strip: $('scStrip'), agenda: $('scAgenda'),
    week: $('scWeek'), totals: $('scTotals'), dayPane: $('scDayPane'), weekPane: $('scWeekPane'),
    viewDay: $('scViewDay'), viewWeek: $('scViewWeek'), status: $('scStatus')
  };
  if (!els.agenda) return;

  /* ── Time helpers ── */
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const dayIndex = d => (d.getDay() + 6) % 7;           // Monday = 0
  const nowMin = d => d.getHours() * 60 + d.getMinutes();

  // "10am", "5:30pm"
  function clock(min) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    const h12 = h % 12 || 12;
    return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
  }
  // "7–9pm", "11am–12pm"
  function range(a, b) {
    const s = clock(a), e = clock(b);
    const sameHalf = (Math.floor(a / 60) < 12) === (Math.floor(b / 60) % 24 < 12);
    return sameHalf ? `${s.replace(/am|pm/, '')}–${e}` : `${s}–${e}`;
  }
  function duration(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? 's' : ''}`;
  }
  function countdown(mins) {
    if (mins < 1) return 'now';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h ${m ? m + 'm' : ''}`.trim() : `${m} min`;
  }

  const events = d => WEEK[d].map(e => ({ ...e, s: toMin(e.start), e: toMin(e.end), k: KINDS[e.kind] }))
                             .sort((a, b) => a.s - b.s || b.e - a.e);
  const isRest = d => REST_DAYS.includes(d);

  // Real minutes from `t` until a wall-clock time today (stays right on the
  // nights the clocks change, when minutes-since-midnight would be an hour out)
  function minsUntil(t, min) {
    const at = new Date(t);
    at.setHours(Math.floor(min / 60), min % 60, 0, 0);
    return Math.ceil((at - t) / 60000);
  }

  // Calendar dates for this Monday–Sunday
  function weekDates(today) {
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - dayIndex(today));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Only touch the DOM when the markup actually changes, so screen readers and
  // keyboard focus aren't disturbed by the background refresh
  function setHTML(el, html) {
    if (el.dataset.html === html) return false;
    el.dataset.html = html;
    el.innerHTML = html;
    return true;
  }

  /* ── State ── */
  let today = new Date();
  let selected = dayIndex(today);
  let view = 'day';
  let lastAnnounce = '';
  try { if (localStorage.getItem(VIEW_KEY) === 'week') view = 'week'; } catch (e) {}

  /* ── Now / next card ── */
  function renderNow() {
    const t = new Date();
    const di = dayIndex(t), n = nowMin(t);
    const todays = events(di);
    // If two things overlap (lunch during uni), show the one that started last
    const current = todays.filter(e => n >= e.s && n < e.e).sort((a, b) => b.s - a.s)[0];
    let html, kind, announce;

    if (current) {
      const left = minsUntil(t, current.e);
      const total = minsUntil(t, current.e) - minsUntil(t, current.s);
      const pct = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)));
      kind = current.k.color;
      announce = `Happening now: ${current.k.label}, until ${clock(current.e)}`;
      html = `
        <p class="sc-now__label"><span class="sc-live" aria-hidden="true"></span>Happening now</p>
        <p class="sc-now__title">${esc(current.k.label)}</p>
        <p class="sc-now__meta">${range(current.s, current.e)} · ${countdown(left)} left</p>
        <div class="sc-now__bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`;
    } else {
      // Next thing today, otherwise the first thing on the next busy day
      let next = todays.find(e => e.s > n), when = 'today', offset = 0;
      for (let i = 1; !next && i <= 7; i++) {
        const list = events((di + i) % 7);
        if (list.length) { next = list[0]; offset = i; when = i === 1 ? 'tomorrow' : DAY_LONG[(di + i) % 7]; }
      }
      if (!next) {
        html = '<p class="sc-now__title">Nothing planned</p>';
        announce = 'Nothing planned';
      } else {
        kind = next.k.color;
        const free = isRest(di) && todays.every(e => e.k.routine) ? 'Rest day. ' : todays.length && todays.every(e => e.e <= n) ? 'All done for today. ' : '';
        const whenText = offset === 0 ? clock(next.s) : `${when[0].toUpperCase() + when.slice(1)} · ${clock(next.s)}`;
        announce = `Up next: ${next.k.label}, ${offset === 0 ? 'today' : when} at ${clock(next.s)}`;
        html = `
          <p class="sc-now__label">${free}Up next</p>
          <p class="sc-now__title">${esc(next.k.label)}</p>
          <p class="sc-now__meta">${offset === 0 ? `${whenText} · in ${countdown(minsUntil(t, next.s))}` : whenText}</p>`;
      }
    }

    if (kind) els.now.style.setProperty('--kind', kind);
    setHTML(els.now, html);
    // Announce only when the activity itself changes, not every countdown tick
    if (announce !== lastAnnounce) {
      if (lastAnnounce) els.status.textContent = announce;
      lastAnnounce = announce;
    }
  }

  /* ── Day strip (built once a day, then updated in place to keep focus) ── */
  function buildStrip() {
    const dates = weekDates(today), ti = dayIndex(today);
    els.strip.innerHTML = dates.map((d, i) => {
      const dots = [...new Set(events(i).filter(e => !e.k.routine).map(e => e.k.color))]
        .map(c => `<i style="background:${c}"></i>`).join('');
      return `<button type="button" role="tab" class="sc-day${i === ti ? ' is-today' : ''}"
          aria-controls="scAgenda" data-day="${i}"
          aria-label="${DAY_LONG[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}${i === ti ? ', today' : ''}">
          <span class="sc-day__name" aria-hidden="true">${DAY_SHORT[i][0]}</span>
          <span class="sc-day__num" aria-hidden="true">${d.getDate()}</span>
          <span class="sc-day__dots" aria-hidden="true">${dots}</span>
        </button>`;
    }).join('');
    updateStrip();
  }
  function updateStrip() {
    els.strip.querySelectorAll('[data-day]').forEach(b => {
      const on = Number(b.dataset.day) === selected;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;               // roving tabindex: arrows move between days
    });
  }

  /* ── Day agenda ── */
  function renderAgenda(dir) {
    const list = events(selected);
    const ti = dayIndex(today), n = nowMin(new Date());
    const isToday = selected === ti;
    const d = weekDates(today)[selected];

    const head = `<h2 class="sc-agenda__day">${isToday ? 'Today' : DAY_LONG[selected]}
        <span>${isToday ? DAY_LONG[selected] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span></h2>`;

    const rest = isRest(selected)
      ? `<div class="sc-empty">
          <p class="sc-empty__title">Rest day</p>
          <p class="sc-empty__sub">No training, no uni. Recover and recharge.</p>
        </div>`
      : '';
    let html;
    if (!list.length) {
      html = head + (rest || '<div class="sc-empty"><p class="sc-empty__title">Nothing planned</p></div>');
    } else {
      html = head + rest + '<ol class="sc-list">' + list.map(e => {
        const state = isToday ? (n >= e.e ? ' is-past' : n >= e.s ? ' is-now' : '') : '';
        return `<li class="sc-item${state}${e.k.routine ? ' is-routine' : ''}" style="--kind:${e.k.color}">
            <div class="sc-item__time"><b>${clock(e.s)}</b><span>${clock(e.e)}</span></div>
            <div class="sc-item__card">
              <p class="sc-item__title">${esc(e.k.label)}${state === ' is-now' ? '<span class="sc-pill">Now</span>' : ''}${state === ' is-past' ? '<span class="sc-done">Done</span>' : ''}</p>
              <p class="sc-item__meta">${range(e.s, e.e)} · ${duration(e.e - e.s)}${e.flex ? ' · flexible' : ''}</p>
            </div>
          </li>`;
      }).join('') + '</ol>';
    }
    const changed = setHTML(els.agenda, html);
    if (dir && changed) {
      els.agenda.classList.remove('slide-l', 'slide-r');
      void els.agenda.offsetWidth;
      els.agenda.classList.add(dir === 1 ? 'slide-l' : 'slide-r');
    }
  }

  /* ── Week view ── */
  function renderWeek() {
    const dates = weekDates(today), ti = dayIndex(today), n = nowMin(new Date());
    const html = dates.map((d, i) => {
      const list = events(i);
      const rows = list.map(e => {
        // Only today's finished items are "done"; earlier days repeat next week
        const past = i === ti && n >= e.e;
        return `<li class="sc-row${past ? ' is-past' : ''}${e.k.routine ? ' is-routine' : ''}${e.flex ? ' is-flex' : ''}" style="--kind:${e.k.color}">
            <span class="sc-row__time">${range(e.s, e.e)}</span>
            <span class="sc-row__title">${esc(e.k.label)}${e.flex ? '<span class="sc-row__flex">flexible</span>' : ''}</span>
          </li>`;
      }).join('');
      const restRow = isRest(i) ? '<li class="sc-row sc-row--rest"><span class="sc-row__title">Rest day</span></li>' : '';
      return `<section class="sc-wday${i === ti ? ' is-today' : ''}" aria-label="${DAY_LONG[i]}">
          <button type="button" class="sc-wday__head" data-day="${i}" aria-label="Open ${DAY_LONG[i]}">
            <span>${DAY_LONG[i]}</span><span class="sc-wday__date">${i === ti ? 'Today · ' : ''}${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}</span>
          </button>
          <ul class="sc-rows">${restRow}${rows || (restRow ? '' : '<li class="sc-row sc-row--rest"><span class="sc-row__title">Free</span></li>')}</ul>
        </section>`;
    }).join('');
    // Keep keyboard focus on the same day header if the list is redrawn
    const focused = els.week.contains(document.activeElement) && document.activeElement.dataset.day;
    if (setHTML(els.week, html) && focused) {
      const again = els.week.querySelector(`[data-day="${focused}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  /* ── Weekly totals ── */
  function renderTotals() {
    const mins = {};
    WEEK.forEach((day, i) => events(i).filter(e => !e.k.routine).forEach(e => { mins[e.kind] = (mins[e.kind] || 0) + (e.e - e.s); }));
    const fmt = m => (m % 60 ? (m / 60).toFixed(1) : m / 60) + 'h';
    setHTML(els.totals, Object.keys(KINDS).filter(k => mins[k]).map(k =>
      `<li style="--kind:${KINDS[k].color}"><span class="sc-total__label">${KINDS[k].label}</span><b>${fmt(mins[k])}</b></li>`
    ).join(''));
  }

  /* ── View switching ── */
  function setView(v) {
    view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    const day = v === 'day';
    els.dayPane.hidden = !day;
    els.weekPane.hidden = day;
    els.viewDay.setAttribute('aria-pressed', day);
    els.viewWeek.setAttribute('aria-pressed', !day);
    document.body.dataset.view = v;
    if (day) renderAgenda(); else renderWeek();
  }

  function selectDay(i, dir) {
    if (i < 0 || i > 6 || i === selected) return;
    selected = i;
    updateStrip();
    renderAgenda(dir);
  }

  els.strip.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    const i = Number(b.dataset.day);
    selectDay(i, i > selected ? 1 : -1);
  });
  // Arrow keys (and Home/End) move between days in the strip
  els.strip.addEventListener('keydown', e => {
    const moves = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: 6 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const i = Math.min(6, Math.max(0, moves[e.key]));
    selectDay(i, i > selected ? 1 : -1);
    els.strip.querySelector(`[data-day="${i}"]`).focus();
  });
  els.week.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    selected = Number(b.dataset.day);
    updateStrip();
    setView('day');
    window.scrollTo({ top: 0 });
  });
  els.viewDay.addEventListener('click', () => setView('day'));
  els.viewWeek.addEventListener('click', () => setView('week'));

  // Swipe left/right on the agenda to change day
  let sx = 0, sy = 0;
  els.dayPane.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  els.dayPane.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const dir = dx < 0 ? 1 : -1;
    selectDay(selected + dir, dir);
  }, { passive: true });

  /* ── Render & keep fresh ── */
  function renderAll() {
    const d = today;
    els.date.textContent = `${DAY_LONG[dayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    renderNow();
    buildStrip();
    renderTotals();
    setView(view);
  }

  renderAll();

  // Refresh on each minute boundary; if the day has rolled over, jump to it
  function tick() {
    const t = new Date();
    if (t.toDateString() !== today.toDateString()) {
      today = t;
      selected = dayIndex(t);
      renderAll();
      return;
    }
    renderNow();
    if (view === 'day') { if (selected === dayIndex(today)) renderAgenda(); }
    else renderWeek();
  }
  setTimeout(() => { tick(); setInterval(tick, 60000); }, 60000 - (Date.now() % 60000) + 50);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
