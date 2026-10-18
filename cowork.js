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
  const taskColor = t => t.color || TAGS[t.tag] || (t.assignee ? colorOf(t.assignee) : '#ffffff');   // no assignee = Everyone
  const tagPill = tag => TAGS[tag] ? ` <span class="cw-tagpill" style="--tag:${TAGS[tag]}">${esc(tag)}</span>` : '';

  // Each person picks whose calendars they see (their own by default)
  // Day view can show several people; week view shows one person's week at a time
  let visible = new Set(), weekPerson = null;
  const shown = () => view === 'week' ? new Set([weekPerson || state.me]) : visible;
  const myEvents = () => { const v = shown(); return state.events.filter(e => !e.who || v.has(e.who)); };
  // A meeting someone declined drops off their own schedule (that date only)
  const declined = (t, name) => t.tag === 'Meeting' && (state.rsvps || []).some(r => r.task_id === t.id && r.day === t.day && r.member === name && r.status === 'no');
  const scheduleOwner = () => view === 'week' ? (weekPerson || state.me) : state.me;
  const myTasks = () => { const v = shown(), me = scheduleOwner(); return state.tasks.filter(t => (!t.assignee || t.tag === 'Meeting' || v.has(t.assignee)) && !declined(t, me)); };

  // Every server call carries the passcode; a wrong one sends you back to the keypad
  async function call(fn, args) {
    const { data, error } = await sb.rpc(fn, { p_pin: state.pin, ...args });
    if (error && /passcode/i.test(error.message || '')) { store.del(PIN_STORE); location.reload(); }
    return { data, error };
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
    state.personal = null;   // Joe's timetable now lives in tasks
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
      notifyFetched = 0; paintNotify();
      toast(`You’re now ${state.me}`);
    } else openApp();
  });
  $('cwSwitch').addEventListener('click', () => {
    els.app.hidden = true;
    chooseWho(true);
  });

  function openApp() {
    appOpen = true;
    setTimeout(paintNotify, 0);
    loadVisible();
    els.app.hidden = false;
    renderMembers();
    render();
    setView(view);
    setTimeout(scrollToNow, 150);
    setInterval(() => { if (!document.hidden && els.sheet.hidden && els.tSheet.hidden) loadWeek(); }, POLL_MS);
    // Keep "where you are in the day" current: redraw once a minute (not mid-drag or while editing)
    setInterval(() => { if (!document.hidden && els.tSheet.hidden && !armed && !drag) render(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadWeek(); });
  }

  els.signOut.addEventListener('click', () => { store.del(PIN_STORE); store.del(ME_STORE); location.reload(); });

  /* ── Data ── */
  function apply(data) {
    state.members = data.members || [];
    state.events = [];   // old sessions now live in tasks (copied over); everything is a task
    state.tasks = data.tasks || [];
    state.rsvps = data.rsvps || [];
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
      out.push({ kind: 'task', id: t.id, day: t.day, by: t.created_by || t.assignee, s: s0, e: e0, notes: t.notes, title: t.title, meta: t.tag === 'Meeting' ? `Set up by ${(t.created_by || t.assignee) === state.me ? 'you' : (t.created_by || t.assignee || 'someone')}` : !t.assignee ? 'Everyone' : t.assignee === state.me ? 'Task' : `${t.assignee}’s task`, color: taskColor(t), tag: t.tag, done: t.done, rep: repeats(t) });
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
  // Timeline with the free time between things shown as tappable slots (8am–10pm)
  const DAY_FROM = 8 * 60, DAY_TO = 22 * 60;
  const GRID_STORE = 'jb-cowork-grid';
  let grid = [15, 30, 60].includes(Number(store.get(GRID_STORE))) ? Number(store.get(GRID_STORE)) : 60;   // free-time slot size
  const MIN_GAP = () => Math.min(15, grid);
  const hhmm = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  // Free time split into the chosen grid (15 min, 30 min or 1 hour); part-slots get their own row
  function gapParts(di, a, b, isToday, nowM) {
    const parts = [];
    for (let x = a; x < b;) {
      const y = Math.min(b, Math.floor(x / grid) * grid + grid);
      if (y - x >= Math.min(10, grid)) {
        const now = isToday && nowM >= x && nowM < y, past = isToday && nowM >= y;
        parts.push({ s: x, now, html: `<li class="cw-gap${past ? ' is-past' : ''}${now ? ' is-now' : ''}">
          <div class="sc-item__time"><b>${clock(x)}</b></div>
          <button type="button" class="cw-gap__card" data-gap="${di}" data-s="${x}" data-e="${y}" aria-label="${now ? 'Now, free' : 'Free'} ${range(x, y)}. Add a task">
            <span>${now ? '<em>Now</em> · ' : ''}Free${y - x < grid ? ' · ' + range(x, y) : grid < 60 ? ' · ' + duration(y - x) : ''}</span><b aria-hidden="true">+</b>
          </button>
        </li>` });
      }
      x = y;
    }
    return parts;
  }
  const itemEnd = it => it.e > it.s ? it.e : it.s + 30;
  function timelineHtml(items, di, isToday, nowM) {
    const timed = items.filter(it => !it.anytime), rest = items.filter(it => it.anytime);
    let cur = timed.length ? Math.min(DAY_FROM, timed[0].s) : DAY_FROM;
    const parts = [];
    timed.forEach(it => {
      if (it.s - cur >= MIN_GAP()) parts.push(...gapParts(di, cur, it.s, isToday, nowM));
      parts.push({ s: it.s, now: isToday && !it.done && nowM >= it.s && nowM < itemEnd(it), html: itemCard(it, isToday, nowM) });
      cur = Math.max(cur, itemEnd(it));
    });
    if (DAY_TO - cur >= MIN_GAP()) parts.push(...gapParts(di, cur, DAY_TO, isToday, nowM));
    // Nothing on right now: a red line marks the current time between cards
    if (isToday && !parts.some(p => p.now)) {
      const at = parts.findIndex(p => p.s > nowM);
      const line = { html: `<li class="cw-nowline" aria-label="Now, ${clock(nowM)}"><b>${clock(nowM)}</b><i></i></li>` };
      if (at === -1) parts.push(line); else parts.splice(at, 0, line);
    }
    return parts.map(p => p.html).join('') + rest.map(it => itemCard(it, isToday, nowM)).join('');
  }
  // Bring the current time into view (today only)
  function scrollToNow() {
    const pane = view === 'week' ? els.grid : els.day;
    const el = pane.querySelector('.cw-wk.is-today .is-now, .cw-wk.is-today .cw-nowline') || (view === 'day' ? pane.querySelector('.is-now, .cw-nowline') : null);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function openGap(el) {
    openTaskSheet(null, { day: el.dataset.gap, s: Number(el.dataset.s), e: Number(el.dataset.e) });
  }

  /* Meetings: everyone can accept or decline each date, and sees who's coming */
  function rsvpOf(it, name) {
    const r = (state.rsvps || []).find(x => x.task_id === it.id && x.day === it.day && x.member === name);
    return r ? r.status : name === it.by ? 'yes' : null;   // whoever set it up is going unless they decline
  }
  function rsvpHtml(it) {
    const mine = rsvpOf(it, state.me);
    const chips = state.members.map(m => {
      const st = rsvpOf(it, m.name);
      return `<span class="cw-rsvp__who is-${st || 'wait'}" style="--who:${esc(m.color)}" title="${esc(m.name)}: ${st === 'yes' ? 'going' : st === 'no' ? 'not going' : 'no reply yet'}">${st === 'yes' ? '✓' : st === 'no' ? '✕' : '?'} ${esc(m.name)}</span>`;
    }).join('');
    const going = state.members.filter(m => rsvpOf(it, m.name) === 'yes').length;
    const attr = `data-rsvp-task="${esc(it.id)}" data-tday="${esc(it.day)}"`;
    return `<div class="cw-rsvp">
        <div class="cw-rsvp__people" aria-label="${going} of ${state.members.length} going">${chips}</div>
        <div class="cw-rsvp__btns" role="group" aria-label="Can you make it?">
          <button type="button" class="cw-rsvp__btn${mine === 'yes' ? ' is-on' : ''}" data-rsvp="yes" ${attr} aria-pressed="${mine === 'yes'}">✓ Accept</button>
          <button type="button" class="cw-rsvp__btn cw-rsvp__btn--no${mine === 'no' ? ' is-on' : ''}" data-rsvp="no" ${attr} aria-pressed="${mine === 'no'}">✕ Decline</button>
        </div>
      </div>`;
  }
  // Meetings you declined on this day, with a way back in
  function declinedHtml(di) {
    const list = state.tasks.filter(t => t.day === di && declined(t, state.me));
    if (!list.length) return '';
    return `<div class="cw-declined"><span>Declined</span>${list.map(t =>
      `<button type="button" data-rsvp="yes" data-rsvp-task="${esc(t.id)}" data-tday="${esc(t.day)}" aria-label="Rejoin ${esc(t.title)}">${esc(t.title)}${t.at_time ? ' ' + clock(t.at_time) : ''} · <b>Rejoin</b></button>`).join('')}</div>`;
  }
  async function rsvp(btn) {
    const id = btn.dataset.rsvpTask, day = btn.dataset.tday, want = btn.dataset.rsvp;
    const t = state.tasks.find(x => x.id === id && x.day === day);
    const current = rsvpOf({ id, day, by: t && (t.created_by || t.assignee) }, state.me);
    const status = current === want ? null : want;   // tap your answer again to clear it
    state.rsvps = (state.rsvps || []).filter(r => !(r.task_id === id && r.day === day && r.member === state.me));
    if (status) state.rsvps.push({ task_id: id, day, member: state.me, status });
    render();
    const { error } = await call('cowork_rsvp', { p_id: id, p_day: day, p_who: state.me, p_status: status });
    if (error) { toast('Couldn’t save your reply. Check your signal.'); loadWeek(); return; }
    toast(status === 'yes' ? 'You’re going ✓' : status === 'no' ? 'Declined · removed from your day' : 'Reply cleared');
  }

  // One timeline card, used by both the day and week views
  function itemCard(it, isToday, nowM) {
    // Done (ticked) → "Done"; today: happening now → "Now"; already over → faded
    const st = it.done ? ' is-past' : isToday && !it.anytime ? (nowM >= itemEnd(it) ? ' is-gone' : nowM >= it.s ? ' is-now' : '') : '';
    const tag = it.kind === 'mine' ? 'div' : 'button';
    const when = it.anytime ? 'Anytime' : itemRange(it) + (it.e > it.s ? ' · ' + duration(it.e - it.s) : '');
    const drop = it.anytime || !it.day ? '' : ` data-drop-day="${esc(it.day)}" data-drop-s="${it.s}"`;
    return `<li class="sc-item${st}${it.routine ? ' is-routine' : ''}${it.tag === 'Meeting' ? ' cw-meeting' : ''}"${drop} style="--kind:${esc(it.color)}">
        <div class="sc-item__time">${it.anytime ? '<b>Any</b><span>time</span>' : `<b>${clock(it.s)}</b>${it.e > it.s ? `<span>${clock(it.e)}</span>` : ''}`}</div>
        <${tag} ${tag === 'button' ? `type="button" ${itemAttr(it)} aria-label="${it.kind === 'task' ? `${esc(it.title)}${it.done ? ', done' : ''}. Tap to tick, hold to edit` : 'Edit ' + esc(it.title)}"` : ''} class="sc-item__card${tag === 'button' ? ' cw-card' : ''}">
          <p class="sc-item__title">${esc(it.title)}${tagPill(it.tag)}${it.rep ? ' <span class="cw-rep">↻</span>' : ''}${st === ' is-now' ? '<span class="sc-pill">Now</span>' : ''}${st === ' is-past' ? '<span class="sc-done">Done</span>' : ''}</p>
          <p class="sc-item__meta">${when}${it.meta ? ' · ' + esc(it.meta) : ''}${it.flex ? ' · flexible' : ''}</p>
          ${it.during ? `<p class="cw-during__note">↳ ${esc(it.during)}</p>` : ''}
          ${it.notes ? `<p class="cw-item__notes">${esc(it.notes)}</p>` : ''}
        </${tag}>
        ${it.kind === 'task' && !it.anytime ? `<span class="cw-grip" data-grip data-edit-task="${esc(it.id)}" data-tday="${esc(it.day)}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>` : ''}
        ${it.tag === 'Meeting' ? rsvpHtml(it) : ''}
        ${it.kind === 'task' ? `<button type="button" class="cw-editbtn" data-edit-btn data-edit-task="${esc(it.id)}" data-tday="${esc(it.day)}" aria-label="Edit ${esc(it.title)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>` : ''}
      </li>`;
  }

  // Tasks with no time, shown as "Anytime" cards at the end of the day
  const anytimeItems = di => myTasks().filter(t => t.day === di && !t.at_time).map(t => ({
    kind: 'task', anytime: true, id: t.id, day: t.day, by: t.created_by || t.assignee, s: 0, e: 0, title: t.title, notes: t.notes, tag: t.tag, done: t.done, rep: repeats(t),
    meta: !t.assignee ? 'Everyone' : t.assignee === state.me ? 'Task' : `${t.assignee}’s task`, color: taskColor(t)
  }));

  // Week view: each day laid out like the day view
  function renderGrid() {
    const ws = state.weekStart, todayIso = iso(new Date());
    const n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
    // This week: today first, then the rest of the week, then days already gone
    const ti = iso(ws) === iso(mondayOf(n)) ? dayIndex(n) : 0;
    const order = [0, 1, 2, 3, 4, 5, 6].map(k => (ti + k) % 7);
    els.grid.innerHTML = order.map((i, k) => {
      const d = addDays(ws, i), di = iso(d), isToday = di === todayIso;
      const earlier = ti > 0 && i < ti && k === 7 - ti ? '<p class="cw-wk__earlier">Earlier this week</p>' : '';
      const items = dayItems(i).concat(anytimeItems(di));
      return `${earlier}<section class="cw-wk${isToday ? ' is-today' : ''}${ti > 0 && i < ti ? ' is-earlier' : ''}" aria-label="${DAY_LONG[i]}">
          <button type="button" class="sc-agenda__day cw-wk__head" data-open-day="${i}" aria-label="Open ${DAY_LONG[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}${isToday ? ', today' : ''}">
            ${isToday ? 'Today' : DAY_LONG[i]} <span>${isToday ? DAY_LONG[i] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span>
          </button>
          <ol class="sc-list">${timelineHtml(items, di, isToday, nowM)}</ol>
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
  function setGrid(g) {
    grid = g; store.set(GRID_STORE, String(g));
    document.querySelectorAll('[data-grid]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.grid) === g));
    if (appOpen) render();
  }
  document.querySelectorAll('[data-grid]').forEach(b => b.addEventListener('click', () => setGrid(Number(b.dataset.grid))));
  setGrid(grid);
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
      ({ error } = await call('cowork_add_task', { p_day: dayIso, p_title: it.title, p_assignee: it.assignee, p_by: state.me, p_time: st == null ? null : hhmm(st), p_end: st != null && it.at_time && it.end_time ? hhmm(Math.min(st + toMin(it.end_time) - toMin(it.at_time), 23 * 60 + 59)) : null, p_notes: it.notes || null, p_tag: it.tag || null, p_color: it.color || null, p_repeat: true, p_days: [dayIndex(new Date(dayIso + 'T00:00:00')) + 1], p_every: 1 }));
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
    const rv = e.target.closest('[data-rsvp]');
    if (rv && !clip) { rsvp(rv); return; }
    const hd = e.target.closest('[data-open-day]');
    const gap = e.target.closest('[data-gap]');
    if (clip) {
      if (gap) pasteTo(gap.dataset.gap, Number(gap.dataset.s));
      else if (hd) pasteTo(iso(addDays(state.weekStart, Number(hd.dataset.openDay))), null);
      return;
    }
    if (gap) { openGap(gap); return; }
    const eb = e.target.closest('[data-edit-btn]');
    if (eb) { const t = taskAt(eb); if (t) openTaskSheet(t); return; }
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

  // Press and hold a task: let go to edit it, or drag it to a new time (or day) to move it. A quick tap ticks it.
  let holdTimer = null, held = false, holdStart = null, armed = null, drag = null;
  const cancelHold = () => {
    clearTimeout(holdTimer); holdTimer = null;
    document.querySelectorAll('.is-holding').forEach(r => r.classList.remove('is-holding'));
  };
  const endDrag = () => {
    if (drag) { drag.ghost.remove(); drag.card.classList.remove('is-lifted'); document.body.classList.remove('cw-dragging'); }
    document.querySelectorAll('.is-drop').forEach(el => el.classList.remove('is-drop'));
    drag = null; armed = null;
  };
  // Where would a drop at (x, y) land? A free slot, another task's start, or a day heading (keeps the time)
  function dropAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const gap = el.closest('[data-gap]');
    if (gap) return { el: gap, day: gap.dataset.gap, s: Number(gap.dataset.s) };
    const li = el.closest('[data-drop-day]');
    if (li) return { el: li.querySelector('.sc-item__card') || li, day: li.dataset.dropDay, s: Number(li.dataset.dropS) };
    const hd = el.closest('[data-open-day]');
    if (hd) return { el: hd, day: iso(addDays(state.weekStart, Number(hd.dataset.openDay))), s: null };
    return null;
  }
  function attachHold(root) {
    // iPhone Safari cancels pointer events during a long press, so phones use touch events
    const begin = (target, x, y, mouse) => {
      const grip = target.closest('[data-grip]');
      const tk = grip ? grip.closest('.sc-item').querySelector('.sc-item__card[data-edit-task]') : target.closest('[data-edit-task]');
      if (!tk || clip || target.closest('[data-edit-btn]')) return;
      held = false; holdStart = { x, y };
      // The grip (phones) and the mouse drag straight away, no hold needed
      if (grip || mouse) { const t = taskAt(tk); if (t) armed = { tk, t, instant: true }; if (grip) { held = true; tk.classList.add('is-lifted'); } return; }
      tk.classList.add('is-holding');
      holdTimer = setTimeout(() => {
        held = true; cancelHold();
        const t = taskAt(tk); if (!t) return;
        if (navigator.vibrate) navigator.vibrate(12);
        armed = { tk, t };
        tk.classList.add('is-lifted');
      }, 450);
    };
    const move = (x, y, e) => {
      if (holdTimer && holdStart && Math.hypot(x - holdStart.x, y - holdStart.y) > 10) { cancelHold(); return; }   // scrolling, not holding
      if (!armed) return;
      if (armed.instant && !drag && Math.hypot(x - holdStart.x, y - holdStart.y) < 6) return;
      if (armed.instant) held = true;   // a drag, so the click that follows mustn't tick the task
      if (e && e.cancelable) e.preventDefault();   // dragging, so don't scroll the page
      if (!drag) {
        if (Math.hypot(x - holdStart.x, y - holdStart.y) < 8) return;
        const r = armed.tk.getBoundingClientRect();
        const ghost = armed.tk.cloneNode(true);
        ghost.className += ' cw-ghost';
        ghost.style.cssText += `;width:${r.width}px;left:${r.left}px;top:${r.top}px;--kind:${armed.tk.closest('.sc-item').style.getPropertyValue('--kind')}`;
        document.body.appendChild(ghost);
        drag = { ghost, card: armed.tk, dx: x - r.left, dy: y - r.top, t: armed.t };
        document.body.classList.add('cw-dragging');
      }
      drag.ghost.style.left = (x - drag.dx) + 'px';
      drag.ghost.style.top = (y - drag.dy) + 'px';
      document.querySelectorAll('.is-drop').forEach(el => el.classList.remove('is-drop'));
      drag.ghost.style.visibility = 'hidden';
      const tgt = dropAt(x, y);
      drag.ghost.style.visibility = '';
      if (tgt) tgt.el.classList.add('is-drop');
      drag.last = tgt;
      // Scroll the page when dragging near the top or bottom edge
      if (y < 70) window.scrollBy(0, -14); else if (y > innerHeight - 70) window.scrollBy(0, 14);
    };
    const finish = () => {
      cancelHold();
      if (drag) { const { t, last } = drag; endDrag(); if (last) moveTask(t, last.day, last.s); return; }
      if (armed) {
        const { t, tk, instant } = armed; tk.classList.remove('is-lifted'); armed = null;
        if (!instant) openTaskSheet(t);   // held and let go: edit (a plain click or grip tap does nothing extra)
      }
    };
    root.addEventListener('touchstart', e => { if (e.touches.length === 1) begin(e.target, e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    root.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
    root.addEventListener('touchend', finish);
    root.addEventListener('touchcancel', () => { cancelHold(); endDrag(); });
    root.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) begin(e.target, e.clientX, e.clientY, true); });
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); });
    window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && (holdTimer || armed || drag)) finish(); });
    root.addEventListener('contextmenu', e => { if (e.target.closest('[data-edit-task]')) e.preventDefault(); });
  }
  attachHold(els.grid);
  attachHold(els.day);

  // Save a drag-and-drop move: new start time (kept to the grid), same length; a new weekday replaces this one
  async function moveTask(t, day, s) {
    const oldS = t.at_time ? toMin(t.at_time) : null;
    const newS = s == null ? oldS : Math.round(s / grid) * grid;
    if (newS == null) { toast('Give the task a time first'); return; }
    const len = t.at_time && t.end_time ? toMin(t.end_time) - toMin(t.at_time) : 0;
    const oldDow = isoDow(t.day), newDow = isoDow(day);
    let days = (t.repeat_days ? t.repeat_days.map(Number) : [isoDow(t.start_day || t.day)]);
    if (newDow !== oldDow) days = [...new Set(days.filter(d => d !== oldDow).concat(newDow))];
    if (newS === oldS && newDow === oldDow) return;
    const start = t.start_day || t.day;
    const args = {
      p_id: t.id, p_day: day < start ? day : start, p_title: t.title, p_assignee: t.assignee || '',
      p_time: hhmm(newS), p_end: len ? hhmm(Math.min(newS + len, 23 * 60 + 59)) : null,
      p_notes: t.notes || null, p_tag: t.tag || null, p_color: t.color || null,
      p_repeat: true, p_days: days, p_every: t.repeat_every || 1, p_until: null
    };
    // Show it moved straight away, then save
    state.tasks.filter(x => x.id === t.id).forEach(x => { x.at_time = args.p_time + ':00'; x.end_time = args.p_end ? args.p_end + ':00' : null; });
    render();
    const { error } = await call('cowork_update_task', args);
    if (error) { toast('Couldn’t move it. Check your signal.'); loadWeek(); return; }
    toast(`Moved to ${DAY_LONG[newDow - 1]} ${clock(newS)}${len ? '–' + clock(newS + len) : ''} · every week`);
    loadWeek();
  }

  function tapTick(tk) {
    if (held) { held = false; return; }
    const t = taskAt(tk);
    if (t) { t.done = !t.done; render(); saveDone(t, t.done); toast(t.done ? 'Done ✓' : 'Not done'); }
  }
  els.day.addEventListener('click', e => {
    const rv = e.target.closest('[data-rsvp]');
    if (rv) { rsvp(rv); return; }
    const gap = e.target.closest('[data-gap]');
    if (gap) { openGap(gap); return; }
    const eb = e.target.closest('[data-edit-btn]');
    if (eb) { const t = taskAt(eb); if (t) openTaskSheet(t); return; }
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
    const n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
    const items = dayItems(state.selected).concat(anytimeItems(di));

    const timeline = '<ol class="sc-list">' + timelineHtml(items, di, isToday, nowM) + '</ol>';

    els.day.innerHTML = `
      <h2 class="sc-agenda__day">${isToday ? 'Today' : DAY_LONG[state.selected]} <span>${isToday ? DAY_LONG[state.selected] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span></h2>
      ${timeline}
      ${declinedHtml(di)}
      <div class="cw-addrow"><button type="button" class="cw-add" id="cwAddTask">+ Add task</button></div>`;
    bindDay();
  }

  function bindDay() {
    els.day.querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => openSheet(state.events.find(e => e.id === b.dataset.event))));
    $('cwAddTask').addEventListener('click', () => openTaskSheet(null));
  }

  /* ── Phone alarms: set-up guide for an Apple Shortcut that reads today's alarms ── */
  const alarmSheet = $('cwAlarmSheet');
  async function loadAlarms() {
    const list = $('cwAlarmList');
    list.innerHTML = '<li>Loading…</li>';
    const { data, error } = await call('cowork_alarms', { p_who: state.me });
    if (error) { list.innerHTML = '<li>Couldn’t load. Check your signal.</li>'; return; }
    list.innerHTML = (data || []).length
      ? data.map(a => `<li><b>${esc(clock(toMin(a.time)))}</b><span>${esc(a.label)}</span></li>`).join('')
      : '<li>No timed tasks today.</li>';
  }
  $('cwAlarmsOpen').addEventListener('click', () => {
    $('cwAlarmUrl').textContent = `${SB_URL}/rest/v1/rpc/cowork_alarms`;
    $('cwAlarmKey').textContent = SB_KEY;
    $('cwAlarmWho').textContent = state.me;
    alarmSheet.hidden = false;
    document.documentElement.classList.add('cw-noscroll');
    requestAnimationFrame(() => alarmSheet.classList.add('is-open'));
    loadAlarms();
  });
  const closeAlarms = () => {
    alarmSheet.classList.remove('is-open');
    document.documentElement.classList.remove('cw-noscroll');
    setTimeout(() => { alarmSheet.hidden = true; }, 220);
  };
  $('cwAlarmClose').addEventListener('click', closeAlarms);
  $('cwAlarmRefresh').addEventListener('click', loadAlarms);
  alarmSheet.addEventListener('click', async e => {
    if (e.target === alarmSheet) return closeAlarms();
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch (err) { const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected – tap Copy'); }
  });

  /* ── Desktop notifications: start and end of each of today's tasks, while this page is open ── */
  const NOTIFY_STORE = 'jb-cowork-notify';
  let notifyList = [], notifyFetched = 0;
  const fired = new Set();
  const notifyOn = () => 'Notification' in window && Notification.permission === 'granted' && store.get(NOTIFY_STORE + ':' + state.me) === '1';
  function paintNotify() {
    const st = $('cwNotifyState');
    st.textContent = !('Notification' in window) ? 'Not supported here' : Notification.permission === 'denied' ? 'Blocked in browser settings' : notifyOn() ? 'On' : 'Off';
  }
  async function notifyTick() {
    if (!appOpen || !notifyOn()) return;
    const now = new Date();
    if (Date.now() - notifyFetched > 5 * 60 * 1000 || (notifyList.day && notifyList.day !== iso(now))) {
      const { data } = await call('cowork_alarms', { p_who: state.me });
      if (data) { notifyList = data; notifyList.day = iso(now); notifyFetched = Date.now(); }
    }
    const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    notifyList.filter(a => a.time === hm).forEach(a => {
      const key = iso(now) + ' ' + a.time;
      if (fired.has(key)) return;
      fired.add(key);
      const n = new Notification(`Co-working · ${clock(toMin(a.time))}`, { body: a.label.replace(/ · /g, '\n'), tag: key });
      n.onclick = () => { window.focus(); n.close(); };
    });
  }
  setInterval(notifyTick, 20000);
  $('cwNotifyBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('This browser can’t show notifications'); return; }
    if (notifyOn()) { store.set(NOTIFY_STORE + ':' + state.me, '0'); paintNotify(); toast('Desktop notifications off'); return; }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { paintNotify(); toast('Allow notifications for this site in your browser settings'); return; }
    store.set(NOTIFY_STORE + ':' + state.me, '1'); notifyFetched = 0; paintNotify();
    new Notification('Co-working notifications on', { body: 'You’ll get a notification at the start and end of each task while this page is open.' });
    notifyTick();
  });

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
  // Colour: "Auto" (tag / person colour), a swatch, or any custom colour
  const swatchEls = () => [...els.tForm.querySelectorAll('[name=colour]')];
  function setColour(c) {
    const custom = els.tForm.querySelector('#cwColourCustom');
    const match = swatchEls().find(r => r.value !== 'custom' && r.value === (c || 'auto'));
    if (match) match.checked = true;
    else { els.tForm.querySelector('[name=colour][value=custom]').checked = true; custom.value = c; }
    custom.closest('label').style.setProperty('--sw', c && !match ? c : 'conic-gradient(#ff453a, #ffd60a, #30d158, #0a84ff, #bf5af2, #ff453a)');
  }
  function pickedColour() {
    const v = (swatchEls().find(r => r.checked) || {}).value;
    return v === 'custom' ? els.tForm.querySelector('#cwColourCustom').value : v === 'auto' || !v ? null : v;
  }
  els.tForm.querySelector('#cwColourCustom').addEventListener('input', e => {
    els.tForm.querySelector('[name=colour][value=custom]').checked = true;
    e.target.closest('label').style.setProperty('--sw', e.target.value);
  });

  let editingTask = null, saving = false;
  function openTaskSheet(t, preset) {
    editingTask = t;
    saving = false;   // the sheet stays locked after a save until it's opened again
    els.tForm.querySelector('button[type=submit]').disabled = false;
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
    if (!t && preset) {   // from a free slot: that day and time
      f.day.value = preset.day; f.time.value = hhmm(preset.s); f.end.value = hhmm(Math.min(preset.s + 60, preset.e));
    }
    f.notes.value = t && t.notes ? t.notes : '';
    f.tag.value = t && TAGS[t.tag] ? t.tag : 'none';
    setColour(t && t.color ? t.color : '');
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

  // The first day on/after today this task happens (respects its days and "every N weeks")
  function nextOccurrence(startIso, days, every) {
    const start = new Date(startIso + 'T00:00:00'), today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(Math.max(start, today));
    for (let k = 0; k < 7 * 9; k++, d.setDate(d.getDate() + 1)) {
      const weeks = Math.round((mondayOf(d) - mondayOf(start)) / 6048e5);
      if (days.includes(dayIndex(d) + 1) && weeks % (every || 1) === 0) return new Date(d);
    }
    return start;
  }
  els.tForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (saving) return;   // no double saves from a double tap
    const f = els.tForm;
    const title = f.title.value.trim();
    if (!title) { els.tMsg.textContent = 'What’s the task?'; return; }
    els.tMsg.textContent = 'Saving…';
    const args = { p_day: f.day.value, p_title: title, p_assignee: f.who.value, p_time: f.time.value || null, p_end: f.time.value && f.end.value ? f.end.value : null, p_notes: f.notes.value.trim() || null, p_tag: TAGS[f.tag.value] ? f.tag.value : null, p_color: pickedColour() };
    const days = [...f.querySelectorAll('[name=rday]:checked')].map(c => +c.value);
    if (!days.length) { els.tMsg.textContent = 'Pick at least one day.'; return; }
    if (args.p_end && args.p_end <= args.p_time) { els.tMsg.textContent = 'Finish needs to be after the start.'; return; }
    if (f.end.value && !f.time.value) { els.tMsg.textContent = 'Add a start time too.'; return; }
    Object.assign(args, { p_repeat: true, p_days: days, p_every: +f.every.value, p_until: null });
    // A new task never starts in the past: e.g. picking Monday on a Sunday means tomorrow
    if (!editingTask && args.p_day < iso(new Date())) args.p_day = iso(nextOccurrence(args.p_day, days, 1));
    saving = true;
    const submitBtn = f.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    const { error } = editingTask
      ? await call('cowork_update_task', { p_id: editingTask.id, ...args })
      : await call('cowork_add_task', { ...args, p_by: state.me });
    if (error) {
      saving = false;
      submitBtn.disabled = false;
      els.tMsg.textContent = /function|schema cache/i.test(error.message || '')
        ? 'The database needs updating first (see cowork/update-3-task-days-weeks.sql).'
        : 'Couldn’t save. Check your signal.';
      return;
    }
    const wasEdit = !!editingTask, who = args.p_assignee;
    closeTaskSheet();
    // Make sure the person it's for is showing, so a saved task never looks lost
    if (who) {
      if (view === 'week') { weekPerson = who; store.set(SEE_STORE + ':week:' + state.me, who); }
      else if (!visible.has(who)) { visible.add(who); store.set(SEE_STORE + ':' + state.me, JSON.stringify([...visible])); }
      renderMembers();
    }
    // Jump to where the task actually is next, and say so
    const d = nextOccurrence(args.p_day, days, args.p_every);
    toast(`${wasEdit ? 'Saved' : who === state.me || !who ? 'Saved' : `Saved to ${who}’s calendar`} · next on ${DAY_LONG[dayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
    state.weekStart = mondayOf(d);
    state.selected = dayIndex(d);
    loadWeek();
  });
  // Deleting: a repeating task asks "just this day" or "every week"
  async function deleteTask(mode) {
    const t = editingTask;
    const { error } = mode === 'day'
      ? await call('cowork_skip_task', { p_id: t.id, p_day: t.day })
      : await call('cowork_delete_task', { p_id: t.id });
    if (error) { els.tMsg.textContent = 'Couldn’t delete. Check your signal.'; return; }
    closeTaskSheet();
    const d = new Date(t.day + 'T00:00:00');
    toast(mode === 'day' ? `Removed from ${DAY_LONG[dayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} only` : 'Task deleted');
    loadWeek();
  }
  els.tDelete.addEventListener('click', () => {
    const t = editingTask;
    if (!t) return;
    const repeating = t.repeat_weekly && repeats(t);
    if (!repeating) { if (confirm(`Delete “${t.title}”?`)) deleteTask('all'); return; }
    const d = new Date(t.day + 'T00:00:00');
    els.tMsg.innerHTML = `<span class="cw-delask">
        <span>Delete “${esc(t.title)}”…</span>
        <button type="button" class="cw-btn cw-btn--ghost" data-del="day">Just ${DAY_LONG[dayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}</button>
        <button type="button" class="cw-btn cw-btn--danger-fill" data-del="all">Every week</button>
        <button type="button" class="cw-btn cw-btn--ghost" data-del="cancel">Keep it</button>
      </span>`;
    els.tMsg.querySelector('[data-del="day"]').focus();
  });
  els.tMsg.addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (b.dataset.del === 'cancel') { els.tMsg.textContent = ''; return; }
    deleteTask(b.dataset.del);
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
    if (!b || Date.now() - stripSwiped < 400) return;
    state.selected = Number(b.dataset.day);
    render();
  });
  // Day strip: swipe it (phones) or use the arrows (computers) to go to the previous/next week
  function stepWeek(dir) {
    state.weekStart = addDays(state.weekStart, dir * 7);
    loadWeek().then(() => {
      els.strip.classList.remove('slide-l', 'slide-r');
      void els.strip.offsetWidth;
      els.strip.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    });
  }
  $('cwStripPrev').addEventListener('click', () => stepWeek(-1));
  $('cwStripNext').addEventListener('click', () => stepWeek(1));
  let stripSwipe = null;
  els.strip.addEventListener('touchstart', e => {
    if (e.touches.length === 1) stripSwipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  els.strip.addEventListener('touchend', e => {
    if (!stripSwipe) return;
    const dx = e.changedTouches[0].clientX - stripSwipe.x, dy = e.changedTouches[0].clientY - stripSwipe.y;
    const quick = Date.now() - stripSwipe.t < 700;
    stripSwipe = null;
    if (quick && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { stripSwiped = Date.now(); stepWeek(dx < 0 ? 1 : -1); }
  }, { passive: true });
  let stripSwiped = 0;

  // Day view: swipe left/right to change day (crosses into the next/previous week)
  function stepDay(dir) {
    let i = state.selected + dir;
    const slide = () => {
      els.day.classList.remove('slide-l', 'slide-r');
      void els.day.offsetWidth;
      els.day.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    };
    if (i < 0 || i > 6) {
      state.weekStart = addDays(state.weekStart, dir * 7);
      state.selected = i < 0 ? 6 : 0;
      loadWeek().then(slide);
    } else {
      state.selected = i;
      render();
      slide();
    }
  }
  let swipe = null;
  els.dayPane.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('input, textarea, select, .sc-strip')) { swipe = null; return; }
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  els.dayPane.addEventListener('touchend', e => {
    if (!swipe) return;
    if (held) { swipe = null; return; }   // that was a hold or a drag, not a swipe
    const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
    const quick = Date.now() - swipe.t < 700;
    swipe = null;
    // A clear sideways flick, not a scroll or a hold
    if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { cancelHold(); held = true; stepDay(dx < 0 ? 1 : -1); setTimeout(() => { held = false; }, 350); }
  }, { passive: true });

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
  els.today.addEventListener('click', () => { state.weekStart = mondayOf(new Date()); state.selected = dayIndex(new Date()); loadWeek().then(scrollToNow); });

  /* ── Go: reuse a remembered passcode, otherwise show the keypad ── */
  const savedPin = store.get(PIN_STORE);
  if (savedPin) tryPin(savedPin, true);
  else els.lock.hidden = false;
})();
