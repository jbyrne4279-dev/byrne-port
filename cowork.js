/* ============================================================
   CO-WORKING WEEK | cowork.js
   Shared calendar for Joe, Ilya and Owen. Everyone gets in with the
   same passcode as /schedule, picks who they are once per device,
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
    sheetCancel: $('cwSheetCancel'), sheetMsg: $('cwSheetMsg'), toast: $('cwToast')
  };

  const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  function chooseWho() {
    const saved = store.get(ME_STORE);
    if (saved && member(saved)) { state.me = saved; openApp(); return; }
    els.whoList.innerHTML = state.members.map(m =>
      `<button type="button" class="cw-whobtn" data-me="${esc(m.name)}" style="--who:${esc(m.color)}"><i aria-hidden="true">${esc(m.name[0])}</i>${esc(m.name)}</button>`
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
    openApp();
  });

  function openApp() {
    els.app.hidden = false;
    renderMembers();
    render();
    setInterval(() => { if (!document.hidden && els.sheet.hidden) loadWeek(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadWeek(); });
  }

  els.signOut.addEventListener('click', () => { store.del(PIN_STORE); store.del(ME_STORE); location.reload(); });

  /* ── Data ── */
  function apply(data) {
    state.members = data.members || [];
    state.events = data.events || [];
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
  function renderMembers() {
    els.members.innerHTML = state.members.map(m =>
      `<li style="--who:${esc(m.color)}"><i aria-hidden="true">${esc(m.name[0])}</i>${esc(m.name)}${m.name === state.me ? ' <span>(you)</span>' : ''}</li>`
    ).join('');
  }

  function render() {
    const ws = state.weekStart, we = addDays(ws, 6);
    els.range.textContent = `${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]}`;
    const todayIso = iso(new Date());
    els.today.hidden = iso(ws) === iso(mondayOf(new Date()));

    els.strip.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), di = iso(d);
      const people = [...new Set([
        ...state.events.filter(e => e.day === di).map(e => e.who || '*'),
        ...state.tasks.filter(t => t.day === di && !t.done).map(t => t.assignee)
      ])].slice(0, 4);
      const dots = people.map(p => `<i style="background:${p === '*' ? '#fff' : esc(colorOf(p))}"></i>`).join('');
      return `<button type="button" role="tab" class="sc-day${i === state.selected ? ' is-on' : ''}${di === todayIso ? ' is-today' : ''}"
          data-day="${i}" aria-selected="${i === state.selected}" tabindex="${i === state.selected ? 0 : -1}"
          aria-label="${DAY_LONG[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}${di === todayIso ? ', today' : ''}">
          <span class="sc-day__name" aria-hidden="true">${DAY_SHORT[i]}</span>
          <span class="sc-day__num" aria-hidden="true">${d.getDate()}</span>
          <span class="sc-day__dots" aria-hidden="true">${dots}</span>
        </button>`;
    }).join('');
    renderDay();
  }

  function renderDay() {
    const d = addDays(state.weekStart, state.selected), di = iso(d);
    const isToday = di === iso(new Date());
    const events = state.events.filter(e => e.day === di).sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    const tasks = state.tasks.filter(t => t.day === di);

    const eventsHtml = events.length
      ? '<ol class="sc-list">' + events.map(e => {
          const who = e.who || 'Everyone';
          const color = e.who ? colorOf(e.who) : '#ffffff';
          return `<li class="sc-item" style="--kind:${esc(color)}">
              <div class="sc-item__time"><b>${clock(e.start_time)}</b><span>${clock(e.end_time)}</span></div>
              <button type="button" class="sc-item__card cw-card" data-event="${esc(e.id)}" aria-label="Edit ${esc(e.title)}">
                <p class="sc-item__title">${esc(e.title)}</p>
                <p class="sc-item__meta">${clock(e.start_time)}–${clock(e.end_time)} · ${esc(who)}</p>
              </button>
            </li>`;
        }).join('') + '</ol>'
      : '<p class="cw-empty">No shared sessions yet.</p>';

    const taskGroups = state.members.map(m => {
      const mine = tasks.filter(t => t.assignee === m.name);
      const items = mine.map(t => `
        <li class="cw-task${t.done ? ' is-done' : ''}">
          <label><input type="checkbox" data-task="${esc(t.id)}"${t.done ? ' checked' : ''}><span>${esc(t.title)}</span></label>
          <small>${t.created_by && t.created_by !== m.name ? `from ${esc(t.created_by)}` : ''}</small>
          <button type="button" class="cw-x" data-del-task="${esc(t.id)}" aria-label="Delete task ${esc(t.title)}">×</button>
        </li>`).join('');
      return `<section class="cw-group" style="--who:${esc(m.color)}">
          <h3><i aria-hidden="true"></i>${esc(m.name)}${m.name === state.me ? ' <span>(you)</span>' : ''}<em>${mine.filter(t => t.done).length}/${mine.length}</em></h3>
          ${items ? `<ul>${items}</ul>` : ''}
        </section>`;
    }).join('');

    // Joe's personal timetable for this weekday, read-only
    let personalHtml = '';
    const p = state.personal;
    if (p && p.week && p.week[state.selected]) {
      const rows = p.week[state.selected]
        .map(e => ({ ...e, k: (p.kinds || {})[e.kind] || { label: e.kind, color: '#8e8e93' } }))
        .sort((a, b) => toMin(a.start) - toMin(b.start))
        .map(e => `<li class="sc-row" style="--kind:${esc(e.k.color)}"><span class="sc-row__time">${clock(e.start)}–${clock(e.end)}</span><span class="sc-row__title">${esc(e.k.label)}${e.flex ? ' <span class="sc-row__flex">flexible</span>' : ''}</span></li>`)
        .join('');
      personalHtml = `<details class="cw-personal">
          <summary>Joe’s timetable</summary>
          <ul class="sc-rows">${rows || '<li class="sc-row sc-row--rest"><span class="sc-row__title">Nothing on</span></li>'}</ul>
        </details>`;
    }

    const assigneeOpts = state.members.map(m => `<option value="${esc(m.name)}"${m.name === state.me ? ' selected' : ''}>${esc(m.name)}${m.name === state.me ? ' (me)' : ''}</option>`).join('');

    els.day.innerHTML = `
      <h2 class="sc-agenda__day">${isToday ? 'Today' : DAY_LONG[state.selected]} <span>${isToday ? DAY_LONG[state.selected] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}</span></h2>
      <div class="cw-section-head"><h3 class="sc-section-title">Shared schedule</h3><button type="button" class="cw-add" id="cwAddEvent">+ Add session</button></div>
      ${eventsHtml}
      ${personalHtml}
      <div class="cw-section-head"><h3 class="sc-section-title">Tasks</h3></div>
      <form class="cw-taskform" id="cwTaskForm">
        <input type="text" id="cwTaskTitle" maxlength="140" placeholder="Add a task…" aria-label="New task" required>
        <select id="cwTaskFor" aria-label="Task for">${assigneeOpts}</select>
        <button type="submit" class="cw-add">Add</button>
      </form>
      <div class="cw-groups">${taskGroups}</div>`;
    bindDay();
  }

  function bindDay() {
    $('cwAddEvent').addEventListener('click', () => openSheet(null));
    els.day.querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => openSheet(state.events.find(e => e.id === b.dataset.event))));
    els.day.querySelectorAll('[data-task]').forEach(cb => cb.addEventListener('change', async () => {
      const t = state.tasks.find(x => x.id === cb.dataset.task);
      if (t) t.done = cb.checked;
      renderDay();                        // updates the done/total count
      const again = els.day.querySelector(`[data-task="${cb.dataset.task}"]`);
      if (again) again.focus({ preventScroll: true });
      const { error } = await call('cowork_set_task', { p_id: cb.dataset.task, p_done: cb.checked });
      if (error) { toast('Couldn’t save. Check your signal.'); loadWeek(); }
    }));
    els.day.querySelectorAll('[data-del-task]').forEach(b => b.addEventListener('click', async () => {
      state.tasks = state.tasks.filter(t => t.id !== b.dataset.delTask);
      renderDay();
      const { error } = await call('cowork_delete_task', { p_id: b.dataset.delTask });
      if (error) { toast('Couldn’t delete. Check your signal.'); loadWeek(); }
    }));
    $('cwTaskForm').addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('cwTaskTitle').value.trim();
      if (!title) return;
      const assignee = $('cwTaskFor').value;
      $('cwTaskTitle').value = '';
      const { error } = await call('cowork_add_task', { p_day: selectedDate(), p_title: title, p_assignee: assignee, p_by: state.me });
      if (error) { toast('Couldn’t add the task.'); return; }
      toast(assignee === state.me ? 'Task added' : `Task added for ${assignee}`);
      loadWeek();
    });
  }

  /* ── Add / edit session sheet ── */
  let editing = null;
  function openSheet(ev) {
    editing = ev;
    const f = els.sheetForm;
    els.sheetTitle.textContent = ev ? 'Edit session' : 'New session';
    els.sheetDelete.hidden = !ev;
    els.sheetMsg.textContent = '';
    f.title.value = ev ? ev.title : '';
    f.day.value = ev ? ev.day : selectedDate();
    f.start.value = ev ? String(ev.start_time).slice(0, 5) : '10:00';
    f.end.value = ev ? String(ev.end_time).slice(0, 5) : '12:00';
    f.who.innerHTML = '<option value="">Everyone</option>' + state.members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    f.who.value = ev && ev.who ? ev.who : '';
    els.sheet.hidden = false;
    requestAnimationFrame(() => els.sheet.classList.add('is-open'));
    setTimeout(() => f.title.focus(), 50);
  }
  function closeSheet() {
    els.sheet.classList.remove('is-open');
    setTimeout(() => { els.sheet.hidden = true; }, 220);
  }
  els.sheetCancel.addEventListener('click', closeSheet);
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
    toast(wasEdit ? 'Session updated' : 'Session added');
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
