/* ============================================================
   CO-WORKING WEEK | cowork.js
   Shared calendar for Joe, Ilya and Owen. Everyone gets in with the
   shared passcode, picks who they are once per device,
   and can add, edit and delete sessions and tasks for each other.
   Storage: Supabase functions that check the passcode on every call
   (see cowork/SETUP.md). Joe's timetable is decrypted from
   schedule-vault.js with the same passcode and shown read-only.
   ============================================================ */

'use strict';

(function initCowork() {
  const meta = name => (document.querySelector(`meta[name="${name}"]`) || {}).content || '';
  const SB_URL = meta('supabase-url');
  const SB_KEY = meta('supabase-anon-key');
  const PIN_STORE = 'jb-cowork-pin';
  const ME_STORE = 'jb-cowork-me';
  const POLL_MS = 30000;

  const $ = id => document.getElementById(id);
  const els = {
    setup: $('cwSetup'), lock: $('cwLock'), dots: $('cwDots'), pad: $('cwPad'), lockMsg: $('cwLockMsg'),
    who: $('cwWho'), whoList: $('cwWhoList'),
    app: $('cwApp'), range: $('cwRange'), prev: $('cwPrev'), next: $('cwNext'), today: $('cwToday'),
    members: $('cwMembers'), strip: $('cwStrip'), day: $('cwDay'), signOut: $('cwSignOut'),
    sheet: $('cwSheet'), sheetForm: $('cwSheetForm'), sheetTitle: $('cwSheetTitle'), sheetDelete: $('cwSheetDelete'),
    sheetCancel: $('cwSheetCancel'), sheetMsg: $('cwSheetMsg'), toast: $('cwToast'),
    tSheet: $('cwTaskSheet'), tForm: $('cwTaskSheetForm'), tTitle: $('cwTaskSheetTitle'), tDelete: $('cwTaskDelete'),
    tCancel: $('cwTaskCancel'), tMsg: $('cwTaskMsg'),
    sheetCopy: $('cwSheetCopy'), tCopy: $('cwTaskCopy'),
    viewDay: $('cwViewDay'), viewWeek: $('cwViewWeek'), dayPane: $('cwDayPane'), weekPane: $('cwWeekPane'),
    grid: $('cwGrid'), weekLbl: $('cwWeekLbl'), now: $('cwNow')
  };

  const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (!SB_URL || !SB_KEY || !window.supabase) { els.setup.hidden = false; return; }
  const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  /* ── Helpers ── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dayIndex = d => (d.getDay() + 6) % 7;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  function clock(t) {
    const min = typeof t === 'number' ? t : toMin(t);
    const h = Math.floor(min / 60) % 24, m = min % 60;
    return `${h % 12 || 12}${m ? ':' + pad2(m) : ''}${h < 12 ? 'am' : 'pm'}`;
  }
  const mondayOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - dayIndex(m)); return m; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };

  let toastTimer = null;
  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), 2400);
  }

  /* ── State ── */
  const state = {
    pin: null, me: null, members: [], events: [], tasks: [], personal: null,
    weekStart: mondayOf(new Date()), selected: dayIndex(new Date())
  };
  const member = name => state.members.find(m => m.name === name);
  const colorOf = name => (member(name) || {}).color || '#8e8e93';
  const selectedDate = () => iso(addDays(state.weekStart, state.selected));
  // Each person sees only their own calendar: sessions for them or everyone, tasks assigned to them
  // Tags make important tasks stand out; meetings are gold
  const TAGS = { Meeting: '#ffd60a', Important: '#ff453a', Deadline: '#ff9f0a' };
  const taskColor = t => TAGS[t.tag] || (t.assignee ? colorOf(t.assignee) : '#ffffff');   // no assignee = Everyone
  const tagPill = tag => TAGS[tag] ? ` <span class="cw-tagpill" style="--tag:${TAGS[tag]}">${esc(tag)}</span>` : '';

  // Each person picks whose calendars they see (their own by default)
  // Day view can show several people; week view shows one person's week at a time
  let visible = new Set(), weekPerson = null;
  const shown = () => view === 'week' ? new Set([weekPerson || state.me]) : visible;
  const myEvents = () => { const v = shown(); return state.events.filter(e => !e.who || v.has(e.who)); };
  const myTasks = () => { const v = shown(); return state.tasks.filter(t => !t.assignee || v.has(t.assignee)); };

  // Every server call carries the passcode; a wrong one sends you back to the keypad
  async function call(fn, args) {
    const { data, error } = await sb.rpc(fn, { p_pin: state.pin, ...args });
    if (error && /passcode/i.test(error.message || '')) { store.del(PIN_STORE); location.reload(); }
    return { data, error };
  }

  /* ── Joe's timetable, decrypted with the same passcode ── */
  async function decryptPersonal(pin) {
    const v = window.SCHEDULE_VAULT, subtle = window.crypto && window.crypto.subtle;
    if (!v || !subtle) return null;
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    try {
      const base = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
      const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(v.salt), iterations: v.iter },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.data));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return null; }
  }

  /* ── Passcode keypad ── */
  const LEN = 4;
  let entry = '', busy = false;
  els.dots.innerHTML = '<i></i>'.repeat(LEN);
  const dotEls = [...els.dots.children];
  const paint = () => dotEls.forEach((d, i) => d.classList.toggle('is-on', i < entry.length));

  async function tryPin(pin, silent) {
    busy = true;
    if (!silent) els.lockMsg.textContent = 'Unlocking…';
    state.pin = pin;
    const from = iso(state.weekStart), to = iso(addDays(state.weekStart, 6));
    const { data, error } = await sb.rpc('cowork_week', { p_pin: pin, p_from: from, p_to: to });
    busy = false;
    if (error) {
      state.pin = null;
      store.del(PIN_STORE);
      if (silent) { els.lock.hidden = false; return; }
      els.lockMsg.textContent = /passcode/i.test(error.message || '') ? 'Wrong passcode' : 'Couldn’t connect. Check your signal.';
      els.dots.classList.remove('is-wrong'); void els.dots.offsetWidth; els.dots.classList.add('is-wrong');
      entry = ''; paint();
      return;
    }
    store.set(PIN_STORE, pin);
    els.lockMsg.textContent = '';
    els.lock.hidden = true;
    apply(data);
    state.personal = await decryptPersonal(pin);
    chooseWho();
  }

  function press(k) {
    if (busy) return;
    if (k === 'del') entry = entry.slice(0, -1);
    else if (/^\d$/.test(k) && entry.length < LEN) entry += k;
    if (entry.length && els.lockMsg.textContent === 'Wrong passcode') els.lockMsg.textContent = '';
    paint();
    if (entry.length === LEN) tryPin(entry);
  }
  els.pad.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (els.lock.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  });

  /* ── Who are you? (once per device) ── */
  let appOpen = false;
  function chooseWho(force) {
    const saved = store.get(ME_STORE);
    if (!force && saved && member(saved)) { state.me = saved; openApp(); return; }
    els.whoList.innerHTML = state.members.map(m =>
      `<button type="button" class="cw-whobtn${m.name === state.me ? ' is-me' : ''}" data-me="${esc(m.name)}" style="--who:${esc(m.color)}"><i aria-hidden="true">${esc(m.name[0])}</i>${esc(m.name)}${m.name === state.me ? '<span>current</span>' : ''}</button>`
    ).join('');
    els.who.hidden = false;
    els.whoList.querySelector('button').focus();
  }
  els.whoList.addEventListener('click', e => {
    const b = e.target.closest('[data-me]');
    if (!b) return;
    state.me = b.dataset.me;
    store.set(ME_STORE, state.me);
    els.who.hidden = true;
    if (appOpen) {
      // Switched user: same data, just redraw with the new "you"
      els.app.hidden = false;
      stopPaste();
      loadVisible();
      renderMembers();
      render();
      toast(`You’re now ${state.me}`);
    } else openApp();
  });
  $('cwSwitch').addEventListener('click', () => {
    els.app.hidden = true;
    chooseWho(true);
  });

  function openApp() {
    appOpen = true;
    loadVisible();
    els.app.hidden = false;
    renderMembers();
    render();
    setView(view);
    setInterval(() => { if (!document.hidden && els.sheet.hidden && els.tSheet.hidden) loadWeek(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadWeek(); });
  }

  els.signOut.addEventListener('click', () => { store.del(PIN_STORE); store.del(ME_STORE); location.reload(); });

  /* ── Data ── */
  function apply(data) {
    state.members = data.members || [];
    state.events = [];   // old sessions now live in tasks (copied over); everything is a task
    state.tasks = data.tasks || [];
  }
  async function loadWeek() {
    const from = iso(state.weekStart), to = iso(addDays(state.weekStart, 6));
    const { data, error } = await call('cowork_week', { p_from: from, p_to: to });
    if (error) { toast('Couldn’t refresh. Check your signal.'); return; }
    apply(data);
    render();
  }

  /* ── Rendering ── */
  /* Now / next card (only while looking at this week) */
  function countdown(mins) {
    if (mins < 1) return 'now';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h ${m ? m + 'm' : ''}`.trim() : `${m} min`;
  }
  function renderNow() {
    const t = new Date(), n = t.getHours() * 60 + t.getMinutes();
    const thisWeek = iso(state.weekStart) === iso(mondayOf(t));
    els.now.hidden = !thisWeek;
    if (!thisWeek) return;
    const di = dayIndex(t), todays = dayItems(di);
    // Timed tasks have no length unless they have a finish; treat them as 30 min for "now"
    const end = it => it.e > it.s ? it.e : it.s + 30;
    const current = todays.filter(it => !it.done && n >= it.s && n < end(it)).sort((a, b) => b.s - a.s)[0];
    let html, kind;
    if (current) {
      const total = end(current) - current.s, left = end(current) - n;
      const pct = Math.min(100, Math.max(0, Math.round((total - left) / total * 100)));
      kind = current.color;
      html = `<p class="sc-now__label"><span class="sc-live" aria-hidden="true"></span>Happening now</p>
        <p class="sc-now__title">${esc(current.title)}</p>
        <p class="sc-now__meta">${itemRange(current)} · ${countdown(left)} left</p>
        <div class="sc-now__bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`;
    } else {
      let next = todays.find(it => it.s > n && !it.done), offset = 0;
      for (let i = 1; !next && di + i < 7; i++) {
        const list = dayItems(di + i).filter(it => !it.done);
        if (list.length) { next = list[0]; offset = i; }
      }
      if (!next) html = '<p class="sc-now__title">Nothing else this week</p>';
      else {
        kind = next.color;
        const free = todays.length && todays.every(it => end(it) <= n || it.done) ? 'All done for today. ' : '';
        const when = offset === 0 ? `${clock(next.s)} · in ${countdown(next.s - n)}` : `${offset === 1 ? 'Tomorrow' : DAY_LONG[di + offset]} · ${clock(next.s)}`;
        html = `<p class="sc-now__label">${free}Up next</p>
          <p class="sc-now__title">${esc(next.title)}</p>
          <p class="sc-now__meta">${when}</p>`;
      }
    }
    if (kind) els.now.style.setProperty('--kind', kind);
    els.now.innerHTML = html;
  }
  setInterval(() => { if (appOpen && !document.hidden) renderNow(); }, 30000);

  function renderMembers() {
    const week = view === 'week', v = shown();
    $('cwSeeHint').textContent = week ? 'Whose week to show' : 'Tap names to show or hide their calendars';
    els.members.innerHTML = state.members.map(m => {
      const on = v.has(m.name);
      return `<li><button type="button" class="cw-see${on ? ' is-on' : ''}" data-see="${esc(m.name)}" aria-pressed="${on}" style="--who:${esc(m.color)}"
          aria-label="${week ? `Show ${esc(m.name)}’s week` : `${on ? 'Hide' : 'Show'} ${esc(m.name)}’s calendar`}"><i aria-hidden="true">${on ? '✓' : esc(m.name[0])}</i>${esc(m.name)}${m.name === state.me ? ' <span>(you)</span>' : ''}</button></li>`;
    }).join('');
  }

  function render() {
    const ws = state.weekStart, we = addDays(ws, 6);
    const now = new Date();
    els.range.textContent = `${DAY_LONG[dayIndex(now)]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
    els.weekLbl.textContent = `${ws.getDate()} ${MONTHS[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MONTHS[we.getMonth()].slice(0, 3)}`;
    const todayIso = iso(new Date());
    els.today.hidden = iso(ws) === iso(mondayOf(new Date()));
    els.weekLbl.hidden = !els.today.hidden;

    els.strip.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), di = iso(d);
      // One dot per colour of what's on that day (routine things like lunch left out)
      const untimed = myTasks().filter(t => t.day === di && !t.at_time).map(taskColor);
      const colors = [...new Set(dayItems(i).filter(it => !it.routine).map(it => it.color).concat(untimed))].slice(0, 4);
      const dots = colors.map(c => `<i style="background:${esc(c)}"></i>`).join('');
      return `<button type="button" role="tab" class="sc-day${i === state.selected ? ' is-on' : ''}${di === todayIso ? ' is-today' : ''}"
          data-day="${i}" aria-selected="${i === state.selected}" tabindex="${i === state.selected ? 0 : -1}"
          aria-label="${DAY_LONG[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}${di === todayIso ? ', today' : ''}">
          <span class="sc-day__name" aria-hidden="true">${DAY_SHORT[i]}</span>
          <span class="sc-day__num" aria-hidden="true">${d.getDate()}</span>
          <span class="sc-day__dots" aria-hidden="true">${dots}</span>
        </button>`;
    }).join('');
    renderNow();
    renderDay();
    renderGrid();
  }

  /* ── Week grid (Outlook-style): days across, time down ── */
  const VIEW_STORE = 'jb-cowork-view', SEE_STORE = 'jb-cowork-see';
  let view = store.get(VIEW_STORE) === 'week' ? 'week' : 'day';
  function loadVisible() {
    let v = null;
    try { v = JSON.parse(store.get(SEE_STORE + ':' + state.me)); } catch (e) {}
    visible = new Set(Array.isArray(v) ? v : [state.me]);
    weekPerson = store.get(SEE_STORE + ':week:' + state.me) || state.me;
  }

  // Everything on one day for the current person, in time order
  function dayItems(i) {
    const di = iso(addDays(state.weekStart, i)), p = state.personal, out = [];
    myEvents().filter(e => e.day === di).forEach(e => out.push({
      kind: 'event', id: e.id, s: toMin(e.start_time), e: toMin(e.end_time), title: e.title,
      meta: e.who ? (e.who === state.me ? 'You' : e.who) : 'Everyone', color: e.who ? colorOf(e.who) : '#ffffff'
    }));
    myTasks().filter(t => t.day === di && t.at_time).forEach(t => {
      const s0 = toMin(t.at_time), e0 = t.end_time ? toMin(t.end_time) : s0;
      out.push({ kind: 'task', id: t.id, day: t.day, s: s0, e: e0, notes: t.notes, title: t.title, meta: !t.assignee ? 'Everyone' : t.assignee === state.me ? 'Task' : `${t.assignee}’s task`, color: taskColor(t), tag: t.tag, done: t.done, rep: repeats(t) });
    });
    if (shown().has('Joe') && p && p.week && p.week[i]) p.week[i].forEach(e => {
      const k = (p.kinds || {})[e.kind] || { label: e.kind, color: '#8e8e93' };
      out.push({ kind: 'mine', s: toMin(e.start), e: toMin(e.end), title: k.label, meta: state.me === 'Joe' ? '' : 'Joe’s timetable', color: k.color, routine: k.routine, flex: e.flex });
    });
    // Start time order; when two start together the longer one comes first
    out.sort((a, b) => a.s - b.s || b.e - a.e);
    // Mark items that happen during a longer one still running (e.g. lunch during uni)
    let host = null;
    out.forEach(it => {
      if (host && it.s < host.e && it.s >= host.s) {
        const end = Math.max(it.e, it.s);
        it.during = (it.s === host.s && end === host.e ? 'same time as ' : end <= host.e ? 'during ' : 'overlaps ') + host.title;
      }
      if (!host || Math.max(it.e, it.s) > host.e) host = it.e > it.s ? it : host;
    });
    return out;
  }
  // Time and length formats
  function range(a, b) {
    const st = clock(a), en = clock(b);
    const sameHalf = (Math.floor(a / 60) < 12) === (Math.floor(b / 60) % 24 < 12);
    return sameHalf ? `${st.replace(/am|pm/, '')}–${en}` : `${st}–${en}`;
  }
  function duration(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? 's' : ''}`;
  }
  const itemRange = it => it.e > it.s ? range(it.s, it.e) : clock(it.s);
  const itemAttr = it => it.kind === 'event' ? `data-event="${esc(it.id)}"` : it.kind === 'task' ? `data-edit-task="${esc(it.id)}" data-tday="${esc(it.day)}"` : '';

  // Week view: stacked day cards
  // One timeline card, used by both the day and week views
  function itemCard(it, isToday, nowM) {
    const st = it.kind === 'task' ? (it.done ? ' is-past' : '') : isToday ? (nowM >= it.e ? ' is-past' : nowM >= it.s ? ' is-now' : '') : '';
    const tag = it.kind === 'mine' ? 'div' : 'button';
    const when = it.anytime ? 'Anytime' : itemRange(it) + (it.e > it.s ? ' · ' + duration(it.e - it.s) : '');
    return `<li class="sc-item${st}${it.routine ? ' is-routine' : ''}${it.tag === 'Meeting' ? ' cw-meeting' : ''}" style="--kind:${esc(it.color)}">
        <div class="sc-item__time">${it.anytime ? '<b>Any</b><span>time</span>' : `<b>${clock(it.s)}</b>${it.e > it.s ? `<span>${clock(it.e)}</span>` : ''}`}</div>
        <${tag} ${tag === 'button' ? `type="button" ${itemAttr(it)} aria-label="${it.kind === 'task' ? `${esc(it.title)}${it.done ? ', done' : ''}. Tap to tick, hold to edit` : 'Edit ' + esc(it.title)}"` : ''} class="sc-item__card${tag === 'button' ? ' cw-card' : ''}">
          <p class="sc-item__title">${esc(it.title)}${tagPill(it.tag)}${it.rep ? ' <span class="cw-rep">↻</span>' : ''}${st === ' is-now' ? '<span class="sc-pill">Now</span>' : ''}${st === ' is-past' ? '<span class="sc-done">Done</span>' : ''}</p>
          <p class="sc-item__meta">${when}${it.meta ? ' · ' + esc(it.meta) : ''}${it.flex ? ' · flexible' : ''}</p>
          ${it.during ? `<p class="cw-during__note">↳ ${esc(it.during)}</p>` : ''}
          ${it.notes ? `<p class="cw-item__notes">${esc(it.notes)}</p>` : ''}
        </${tag}>
      </li>`;
  }

  // Week view: each day laid out like the day view
  function renderGrid() {
    const ws = state.weekStart, todayIso = iso(new Date());
    const n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
    els.grid.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), di = iso(d), isToday = di === todayIso;
      const anytime = myTasks().filter(t => t.day === di && !t.at_time).map(t => ({
        kind: 'task', anytime: true, id: t.id, day: t.day, s: 0, e: 0, title: t.title, notes: t.notes, tag: t.tag, done: t.done, rep: repeats(t),
        meta: !t.assignee ? 'Everyone' : t.assignee === state.me ? 'Task' : `${t.assignee}’s task`, color: taskColor(t)
      }));
      const items = dayItems(i).concat(anytime);
      return `<section class="cw-wk${isToday ? ' is-today' : ''}" aria-label="${DAY_LONG[i]}">
          <button type="button" class="sc-agenda__day cw-wk__head" data-open-day="${i}" aria-label="Open ${DAY_LONG[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}${isToday ? ', today' : ''}">
            ${isToday ? 'Today' : DAY_LONG[i]} <span>${isToday ? DAY_LONG[i] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span>
          </button>
          ${items.length ? '<ol class="sc-list">' + items.map(it => itemCard(it, isToday, nowM)).join('') + '</ol>' : '<p class="cw-wk__free">Free</p>'}
        </section>`;
    }).join('');
  }

  function setView(v) {
    view = v;
    store.set(VIEW_STORE, v);
    const week = v === 'week';
    els.dayPane.hidden = week;
    els.weekPane.hidden = !week;
    els.viewDay.setAttribute('aria-pressed', !week);
    els.viewWeek.setAttribute('aria-pressed', week);
    if (appOpen) { renderMembers(); render(); }
  }
  els.viewDay.addEventListener('click', () => setView('day'));
  els.viewWeek.addEventListener('click', () => setView('week'));
  els.members.addEventListener('click', e => {
    const b = e.target.closest('[data-see]');
    if (!b) return;
    const n = b.dataset.see;
    if (view === 'week') {
      weekPerson = n;
      store.set(SEE_STORE + ':week:' + state.me, n);
    } else {
      visible.has(n) ? visible.delete(n) : visible.add(n);
      store.set(SEE_STORE + ':' + state.me, JSON.stringify([...visible]));
    }
    renderMembers();
    render();
  });

  /* ── Copy & paste in the week grid ── */
  let clip = null;   // { type: 'event' | 'task', item }
  const pasteBar = $('cwPaste');
  function startPaste(type, item) {
    clip = { type, item };
    pasteBar.querySelector('b').textContent = item.title;
    pasteBar.hidden = false;
    document.body.classList.add('cw-pasting');
    setView('week');
    toast('Copied. Tap a day to paste it there');
  }
  function stopPaste() {
    clip = null;
    pasteBar.hidden = true;
    document.body.classList.remove('cw-pasting');
  }
  $('cwPasteDone').addEventListener('click', stopPaste);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && clip && els.sheet.hidden && els.tSheet.hidden) stopPaste(); });

  // startMin: where to paste; null keeps the original time
  async function pasteTo(dayIso, startMin) {
    const it = clip.item;
    const hhmm = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
    let error;
    if (clip.type === 'event') {
      const s0 = toMin(it.start_time), len = toMin(it.end_time) - s0;
      const st = startMin == null ? s0 : startMin;
      const en = Math.min(st + len, 23 * 60 + 59);
      ({ error } = await call('cowork_save_event', { p_id: null, p_day: dayIso, p_start: hhmm(st), p_end: hhmm(en), p_title: it.title, p_who: it.who || '', p_by: state.me }));
    } else {
      const st = startMin == null ? (it.at_time ? toMin(it.at_time) : null) : startMin;
      ({ error } = await call('cowork_add_task', { p_day: dayIso, p_title: it.title, p_assignee: it.assignee, p_by: state.me, p_time: st == null ? null : hhmm(st), p_end: st != null && it.at_time && it.end_time ? hhmm(Math.min(st + toMin(it.end_time) - toMin(it.at_time), 23 * 60 + 59)) : null, p_notes: it.notes || null, p_tag: it.tag || null, p_repeat: true, p_days: [dayIndex(new Date(dayIso + 'T00:00:00')) + 1], p_every: 1 }));
    }
    if (error) { toast('Couldn’t paste. Check your signal.'); return; }
    const d = new Date(dayIso + 'T00:00:00');
    toast(`Pasted to ${DAY_LONG[dayIndex(d)]}${startMin == null ? '' : ' ' + clock(startMin)}`);
    loadWeek();
  }

  // Repeating tasks share an id across days, so find the one on this row's day
  const taskAt = el => state.tasks.find(x => x.id === el.dataset.editTask && (!el.dataset.tday || x.day === el.dataset.tday));
  async function saveDone(t, done) {
    const { error } = t.repeat_weekly
      ? await call('cowork_set_task_day', { p_id: t.id, p_day: t.day, p_done: done })
      : await call('cowork_set_task', { p_id: t.id, p_done: done });
    if (error) { toast('Couldn’t save. Check your signal.'); loadWeek(); }
  }
  function weekClick(e) {
    const hd = e.target.closest('[data-open-day]');
    if (clip) { if (hd) pasteTo(iso(addDays(state.weekStart, Number(hd.dataset.openDay))), null); return; }
    const ev = e.target.closest('[data-event]');
    if (ev) { openSheet(state.events.find(x => x.id === ev.dataset.event)); return; }
    const tk = e.target.closest('[data-edit-task]');
    if (tk) {
      // Tap ticks the task; press and hold edits it (see below)
      tapTick(tk);
      return;
    }
    if (hd) { state.selected = Number(hd.dataset.openDay); render(); setView('day'); window.scrollTo({ top: 0 }); }
  }
  els.grid.addEventListener('click', weekClick);
  els.grid.addEventListener('keydown', e => {
    // Keyboard: Enter edits a task, Space ticks it
    const tk = e.target.closest('[data-edit-task]');
    if (tk && e.key === 'Enter') { e.preventDefault(); const t = taskAt(tk); if (t) openTaskSheet(t); }
  });

  // Press and hold a task (week or day view) to edit it; a quick tap ticks it
  let holdTimer = null, held = false, holdStart = null;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; document.querySelectorAll('.is-holding').forEach(r => r.classList.remove('is-holding')); };
  function attachHold(root) {
    root.addEventListener('pointerdown', e => {
      const tk = e.target.closest('[data-edit-task]');
      if (!tk || clip) return;
      held = false; holdStart = { x: e.clientX, y: e.clientY };
      tk.classList.add('is-holding');
      holdTimer = setTimeout(() => {
        held = true; cancelHold();
        if (navigator.vibrate) navigator.vibrate(10);
        const t = taskAt(tk); if (t) openTaskSheet(t);
      }, 450);
    });
    root.addEventListener('pointermove', e => {
      if (holdTimer && holdStart && Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 10) cancelHold();   // scrolling, not holding
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => root.addEventListener(t, cancelHold));
    root.addEventListener('contextmenu', e => { if (e.target.closest('[data-edit-task]')) e.preventDefault(); });
  }
  attachHold(els.grid);
  attachHold(els.day);
  function tapTick(tk) {
    if (held) { held = false; return; }
    const t = taskAt(tk);
    if (t) { t.done = !t.done; render(); saveDone(t, t.done); toast(t.done ? 'Done ✓' : 'Not done'); }
  }
  els.day.addEventListener('click', e => {
    const tk = e.target.closest('[data-edit-task]');
    if (tk) tapTick(tk);
  });
  els.day.addEventListener('keydown', e => {
    const tk = e.target.closest('[data-edit-task]');
    if (!tk || e.key !== 'Enter') return;
    e.preventDefault(); const t = taskAt(tk); if (t) openTaskSheet(t);   // keyboard: Enter edits, Space ticks
  });

  function renderDay() {
    const d = addDays(state.weekStart, state.selected), di = iso(d);
    const isToday = di === iso(new Date());
    const tasks = myTasks().filter(t => t.day === di);
    const n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
    const items = dayItems(state.selected);

    const timeline = items.length
      ? '<ol class="sc-list">' + items.map(it => itemCard(it, isToday, nowM)).join('') + '</ol>'
      : '<div class="sc-empty"><p class="sc-empty__title">Nothing planned</p></div>';

    const list = tasks.slice().sort((a, b) => (a.at_time ? toMin(a.at_time) : 1e4) - (b.at_time ? toMin(b.at_time) : 1e4))
      .map(t => `
        <li class="cw-task${t.done ? ' is-done' : ''}">
          <input type="checkbox" data-task="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Done: ${esc(t.title)}">
          <button type="button" class="cw-task__body" data-edit-task="${esc(t.id)}" data-tday="${esc(t.day)}" aria-label="${esc(t.title)}${t.done ? ', done' : ''}. Tap to tick, hold to edit">
            <span class="cw-task__title">${t.at_time ? `<b class="cw-task__time">${t.end_time ? range(toMin(t.at_time), toMin(t.end_time)) : clock(t.at_time)}</b>` : ''}${esc(t.title)}${tagPill(t.tag)}${repeats(t) ? ` <span class="cw-rep" title="${esc(repeatText(t.repeat_days, t.repeat_every))}" aria-label="repeats ${esc(repeatText(t.repeat_days, t.repeat_every))}">↻</span>` : ''}</span>
            ${t.notes ? `<span class="cw-task__notes">${esc(t.notes)}</span>` : ''}
            ${!t.assignee ? '<span class="cw-task__from">Everyone</span>' : t.assignee !== state.me ? `<span class="cw-task__from" style="color:${esc(colorOf(t.assignee))}">${esc(t.assignee)}’s task</span>` : t.created_by && t.created_by !== state.me ? `<span class="cw-task__from">from ${esc(t.created_by)}</span>` : ''}
          </button>
        </li>`).join('');
    const taskCard = `<section class="sc-wday cw-tasks">
        <div class="sc-wday__head"><span>Tasks</span><span class="sc-wday__date">${tasks.filter(t => t.done).length}/${tasks.length} done</span></div>
        ${list ? `<ul>${list}</ul>` : '<p class="cw-empty">No tasks for this day.</p>'}
      </section>`;

    els.day.innerHTML = `
      <h2 class="sc-agenda__day">${isToday ? 'Today' : DAY_LONG[state.selected]} <span>${isToday ? DAY_LONG[state.selected] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span></h2>
      ${timeline}
      <div class="cw-addrow"><button type="button" class="cw-add" id="cwAddTask">+ Add task</button></div>
      ${taskCard}`;
    bindDay();
  }

  function bindDay() {
    els.day.querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => openSheet(state.events.find(e => e.id === b.dataset.event))));
    els.day.querySelectorAll('[data-task]').forEach(cb => cb.addEventListener('change', async () => {
      const t = state.tasks.find(x => x.id === cb.dataset.task);
      if (t) t.done = cb.checked;
      renderDay();                        // updates the done/total count
      const again = els.day.querySelector(`[data-task="${cb.dataset.task}"]`);
      if (again) again.focus({ preventScroll: true });
      if (t) saveDone(t, cb.checked);
    }));
    $('cwAddTask').addEventListener('click', () => openTaskSheet(null));
  }

  /* ── Add / edit task sheet ── */
  const isoDow = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? 1 : dayIndex(d) + 1; };
  function repeatText(days, every) {
    const n = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const ds = (days || []).map(Number).sort((a, b) => a - b);
    const which = ds.length === 7 ? 'every day' : ds.join() === '1,2,3,4,5' ? 'weekdays' : ds.map(d => n[d - 1]).join(', ');
    return (+every > 1 ? `every ${every} weeks · ` : 'weekly · ') + which;
  }
  // A "just once" task on several days is stored as a series limited to one week
  const oneWeek = t => !!(t && t.repeat_weekly && t.repeat_until && (new Date(t.repeat_until + 'T00:00:00') - new Date((t.start_day || t.day) + 'T00:00:00')) <= 6 * 864e5);
  const repeats = t => !!(t && t.repeat_weekly && !oneWeek(t));
  // On a new task, moving the start day moves the ticked day with it
  els.tForm.day.addEventListener('change', () => {
    if (editingTask) return;
    const ticked = els.tForm.querySelectorAll('[name=rday]:checked');
    if (ticked.length <= 1) els.tForm.querySelectorAll('[name=rday]').forEach(c => { c.checked = +c.value === isoDow(els.tForm.day.value); });
  });
  let editingTask = null;
  function openTaskSheet(t) {
    editingTask = t;
    const f = els.tForm;
    els.tTitle.textContent = t ? 'Edit task' : 'New task';
    els.tDelete.hidden = !t;
    els.tCopy.hidden = !t;
    els.tMsg.textContent = '';
    f.title.value = t ? t.title : '';
    f.who.innerHTML = state.members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}${m.name === state.me ? ' (me)' : ''}</option>`).join('') + '<option value="">Everyone</option>';
    f.who.value = t ? (t.assignee || '') : state.me;
    f.day.value = t ? t.day : selectedDate();
    f.time.value = t && t.at_time ? String(t.at_time).slice(0, 5) : '';
    f.end.value = t && t.end_time ? String(t.end_time).slice(0, 5) : '';
    f.notes.value = t && t.notes ? t.notes : '';
    f.tag.value = t && TAGS[t.tag] ? t.tag : 'none';
    // Every task repeats until someone edits or deletes it
    if (t) f.day.value = t.start_day || t.day;
    const days = t && t.repeat_days ? t.repeat_days.map(Number) : [isoDow(f.day.value)];
    f.querySelectorAll('[name=rday]').forEach(c => { c.checked = days.includes(+c.value); });
    f.every.value = String(t && t.repeat_every || 1);
    els.tSheet.hidden = false;
    document.documentElement.classList.add('cw-noscroll');
    requestAnimationFrame(() => els.tSheet.classList.add('is-open'));
    if (!t) setTimeout(() => f.title.focus(), 50);   // don't pop the keyboard when just opening to edit
  }
  function closeTaskSheet() {
    els.tSheet.classList.remove('is-open');
    document.documentElement.classList.remove('cw-noscroll');
    setTimeout(() => { els.tSheet.hidden = true; }, 220);
  }
  els.tCancel.addEventListener('click', closeTaskSheet);
  els.tCopy.addEventListener('click', () => { const t = editingTask; closeTaskSheet(); if (t) startPaste('task', t); });
  els.tSheet.addEventListener('click', e => { if (e.target === els.tSheet) closeTaskSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.tSheet.hidden) closeTaskSheet(); });

  els.tForm.addEventListener('submit', async e => {
    e.preventDefault();
    const f = els.tForm;
    const title = f.title.value.trim();
    if (!title) { els.tMsg.textContent = 'What’s the task?'; return; }
    els.tMsg.textContent = 'Saving…';
    const args = { p_day: f.day.value, p_title: title, p_assignee: f.who.value, p_time: f.time.value || null, p_end: f.time.value && f.end.value ? f.end.value : null, p_notes: f.notes.value.trim() || null, p_tag: TAGS[f.tag.value] ? f.tag.value : null };
    const days = [...f.querySelectorAll('[name=rday]:checked')].map(c => +c.value);
    if (!days.length) { els.tMsg.textContent = 'Pick at least one day.'; return; }
    if (args.p_end && args.p_end <= args.p_time) { els.tMsg.textContent = 'Finish needs to be after the start.'; return; }
    if (f.end.value && !f.time.value) { els.tMsg.textContent = 'Add a start time too.'; return; }
    Object.assign(args, { p_repeat: true, p_days: days, p_every: +f.every.value, p_until: null });
    const { error } = editingTask
      ? await call('cowork_update_task', { p_id: editingTask.id, ...args })
      : await call('cowork_add_task', { ...args, p_by: state.me });
    if (error) {
      els.tMsg.textContent = /function|schema cache/i.test(error.message || '')
        ? 'The database needs updating first (see cowork/update-3-task-days-weeks.sql).'
        : 'Couldn’t save. Check your signal.';
      return;
    }
    const wasEdit = !!editingTask, who = args.p_assignee;
    closeTaskSheet();
    toast((wasEdit ? 'Task updated' : who === state.me ? 'Task added' : !who ? 'Added for everyone' : `Added to ${who}’s calendar`) + ' · ' + repeatText(args.p_days, args.p_every));
    const d = new Date(args.p_day + 'T00:00:00');
    state.weekStart = mondayOf(d);
    state.selected = dayIndex(d);
    loadWeek();
  });
  els.tDelete.addEventListener('click', async () => {
    if (!editingTask || !confirm(editingTask.repeat_weekly ? `Delete “${editingTask.title}” from every day it’s on?` : `Delete “${editingTask.title}”?`)) return;
    const { error } = await call('cowork_delete_task', { p_id: editingTask.id });
    if (error) { els.tMsg.textContent = 'Couldn’t delete.'; return; }
    closeTaskSheet();
    toast('Task deleted');
    loadWeek();
  });

  /* ── Add / edit session sheet ── */
  let editing = null;
  function openSheet(ev, preset) {
    editing = ev;
    const f = els.sheetForm;
    els.sheetTitle.textContent = ev ? 'Edit session' : 'New session';
    els.sheetDelete.hidden = !ev;
    els.sheetCopy.hidden = !ev;
    els.sheetMsg.textContent = '';
    f.title.value = ev ? ev.title : '';
    f.day.value = ev ? ev.day : (preset && preset.day) || selectedDate();
    const startMin = preset && preset.start != null ? preset.start : 600;
    const hhmm = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
    f.start.value = ev ? String(ev.start_time).slice(0, 5) : hhmm(startMin);
    f.end.value = ev ? String(ev.end_time).slice(0, 5) : hhmm(Math.min(startMin + 120, 23 * 60 + 45));
    f.who.innerHTML = '<option value="">Everyone</option>' + state.members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    f.who.value = ev ? (ev.who || '') : state.me;
    els.sheet.hidden = false;
    document.documentElement.classList.add('cw-noscroll');
    requestAnimationFrame(() => els.sheet.classList.add('is-open'));
    if (!ev) setTimeout(() => f.title.focus(), 50);
  }
  function closeSheet() {
    els.sheet.classList.remove('is-open');
    document.documentElement.classList.remove('cw-noscroll');
    setTimeout(() => { els.sheet.hidden = true; }, 220);
  }
  els.sheetCancel.addEventListener('click', closeSheet);
  els.sheetCopy.addEventListener('click', () => { const ev = editing; closeSheet(); if (ev) startPaste('event', ev); });
  els.sheet.addEventListener('click', e => { if (e.target === els.sheet) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.sheet.hidden) closeSheet(); });

  els.sheetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const f = els.sheetForm;
    const title = f.title.value.trim();
    if (!title) { els.sheetMsg.textContent = 'Give it a name.'; return; }
    if (f.end.value <= f.start.value) { els.sheetMsg.textContent = 'End time needs to be after the start.'; return; }
    els.sheetMsg.textContent = 'Saving…';
    const { error } = await call('cowork_save_event', {
      p_id: editing ? editing.id : null, p_day: f.day.value, p_start: f.start.value, p_end: f.end.value,
      p_title: title, p_who: f.who.value, p_by: state.me
    });
    if (error) { els.sheetMsg.textContent = 'Couldn’t save. Check your signal.'; return; }
    const wasEdit = !!editing;
    closeSheet();
    const whoFor = f.who.value;
    toast(wasEdit ? 'Session updated' : whoFor && whoFor !== state.me ? `Added to ${whoFor}’s calendar` : 'Session added');
    const d = new Date(f.day.value + 'T00:00:00');
    state.weekStart = mondayOf(d);
    state.selected = dayIndex(d);
    loadWeek();
  });
  els.sheetDelete.addEventListener('click', async () => {
    if (!editing || !confirm(`Delete “${editing.title}” for everyone?`)) return;
    const { error } = await call('cowork_delete_event', { p_id: editing.id });
    if (error) { els.sheetMsg.textContent = 'Couldn’t delete.'; return; }
    closeSheet();
    toast('Session deleted');
    loadWeek();
  });

  /* ── Navigation ── */
  els.strip.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    state.selected = Number(b.dataset.day);
    render();
  });
  els.strip.addEventListener('keydown', e => {
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    state.selected = Math.min(6, Math.max(0, state.selected + moves[e.key]));
    render();
    els.strip.querySelector(`[data-day="${state.selected}"]`).focus();
  });
  els.prev.addEventListener('click', () => { state.weekStart = addDays(state.weekStart, -7); loadWeek(); });
  els.next.addEventListener('click', () => { state.weekStart = addDays(state.weekStart, 7); loadWeek(); });
  els.today.addEventListener('click', () => { state.weekStart = mondayOf(new Date()); state.selected = dayIndex(new Date()); loadWeek(); });

  /* ── Go: reuse a remembered passcode, otherwise show the keypad ── */
  const savedPin = store.get(PIN_STORE);
  if (savedPin) tryPin(savedPin, true);
  else els.lock.hidden = false;
})();
