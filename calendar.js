/* ============================================================
   THE ULTIMATE CALENDAR | calendar.js
   Global holidays, cultural events & occasions with a
   supply-chain / retail-demand lens for the clothing brand.
   ============================================================ */

'use strict';

(function () {

  /* ── CATEGORY + IMPACT META ── */
  const CAT = {
    retail:   { label: 'Retail / Shopping', color: '#e0143c' },
    occasion: { label: 'Occasion / Gifting', color: '#ff7a00' },
    cultural: { label: 'Cultural / Religious', color: '#c060ff' },
    public:   { label: 'Public Holiday', color: '#00b4d8' },
    supply:   { label: 'Supply Chain', color: '#ffb703' }
  };
  const IMPACT = {
    demand:  { label: 'Demand spike', icon: '▲', color: '#1DB954' },
    closure: { label: 'Factory closure', icon: '■', color: '#e0143c' },
    delay:   { label: 'Shipping delay', icon: '◆', color: '#ffb703' },
    watch:   { label: 'Plan ahead',    icon: '●', color: '#00b4d8' }
  };

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  /* ── FIXED-DATE EVENTS (same M/D every year) ──
     Generated for each tracked year automatically. */
  const FIXED = [
    { md:'01-01', name:"New Year's Day", region:'Global', cat:'public', impact:'closure',
      note:'Public holiday worldwide + Chinese suppliers wind down toward Spring Festival. Expect slow dispatch in the first week of January.' },
    { md:'01-26', name:'Republic Day (India)', region:'India', cat:'public', impact:'watch',
      note:'National holiday in India — factor in if sourcing fabric or trims from Indian suppliers.' },
    { md:'02-14', name:"Valentine's Day", region:'Global', cat:'occasion', impact:'demand',
      note:'Gifting peak for going-out & couple pieces. Land stock by late Jan; run paid campaigns from 1 Feb.' },
    { md:'03-17', name:"St Patrick's Day", region:'Ireland / US / UK', cat:'occasion', impact:'demand',
      note:'Green everything — novelty & event demand, especially US. Small but reliable seasonal spike.' },
    { md:'04-01', name:"April Fools' Day", region:'Global', cat:'occasion', impact:'watch',
      note:'Content / drop opportunity — playful limited edition or joke SKU can drive engagement.' },
    { md:'04-22', name:'Earth Day', region:'Global', cat:'occasion', impact:'watch',
      note:'Sustainability messaging window — spotlight any eco fabric, recycled packaging or slow-fashion story.' },
    { md:'05-05', name:'Cinco de Mayo', region:'US / Mexico', cat:'cultural', impact:'demand',
      note:'US event/party demand. Minor but worth a themed push if you sell to US customers.' },
    { md:'06-19', name:'Juneteenth', region:'US', cat:'public', impact:'watch',
      note:'US federal holiday — carriers & warehouses may run reduced hours; nudges US delivery windows.' },
    { md:'07-04', name:'US Independence Day', region:'US', cat:'public', impact:'demand',
      note:'Summer party & Americana demand + big US sale weekend. US couriers pause on the day.' },
    { md:'08-15', name:'Independence Day (India)', region:'India', cat:'public', impact:'watch',
      note:'India national holiday — pauses Indian supplier communication and dispatch.' },
    { md:'09-01', name:'Back to School (peak)', region:'UK / Europe', cat:'retail', impact:'demand',
      note:'Late Aug–early Sep restock rush for youth & staple basics. Have replenishment stock landed by mid-August.' },
    { md:'10-01', name:'China National Day / Golden Week', region:'China', cat:'supply', impact:'closure', days:7,
      note:'🚨 Chinese factories & freight shut ~1 Oct–7 Oct. Confirm and pay for orders by late August or they slip to mid-October.' },
    { md:'10-31', name:'Halloween', region:'Global', cat:'occasion', impact:'demand',
      note:'Huge costume, going-out & grunge/alt demand — core for the brand aesthetic. Land stock by early October.' },
    { md:'11-05', name:'Bonfire Night', region:'UK', cat:'occasion', impact:'watch',
      note:'UK outerwear & layering nudge as the cold sets in — good moment to push jackets & hoodies.' },
    { md:'11-11', name:"Singles' Day (11.11)", region:'China / Global', cat:'retail', impact:'demand',
      note:"World's largest shopping day. Even a small 11.11 promo converts; align inventory + ad spend for the week." },
    { md:'12-24', name:'Christmas Eve', region:'Global', cat:'public', impact:'delay',
      note:'Last-mile courier cut-off already passed — set clear "order by" dates on site to avoid angry customers.' },
    { md:'12-25', name:'Christmas Day', region:'Global', cat:'public', impact:'demand',
      note:'Peak gifting season climax. Stock must be in-country by late November; nothing new ships now.' },
    { md:'12-26', name:'Boxing Day', region:'UK / Commonwealth', cat:'retail', impact:'demand',
      note:'Biggest clearance day of the UK year — plan markdowns & a sale drop in advance. When it lands on a weekend the UK bank-holiday closure moves to the following Monday (e.g. 28 Dec 2026), so dispatch is paused then.' },
    { md:'12-31', name:"New Year's Eve", region:'Global', cat:'occasion', impact:'demand',
      note:'Going-out & party-wear peak. Sits inside the CNY wind-down, so restocking is already frozen.' }
  ];

  /* ── VARIABLE-DATE EVENTS (per year) ── */
  const VARIABLE = {
    2026: [
      { date:'2026-01-19', name:'Martin Luther King Jr. Day', region:'US', cat:'public', impact:'watch',
        note:'US federal holiday — US carriers & warehouses closed.' },
      { date:'2026-02-16', name:"Presidents' Day", region:'US', cat:'retail', impact:'demand',
        note:'Major US sale weekend — a discount moment for US traffic.' },
      { date:'2026-02-17', name:'Chinese New Year — Year of the Horse', region:'China / East Asia', cat:'supply', impact:'closure', days:7,
        note:'🚨 CRITICAL: factories close ~2–3 weeks around this date and staff often return slowly. Place, confirm & pay for spring/summer orders by early January or expect 4–6 week slips.' },
      { date:'2026-02-18', name:'Ramadan begins (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch', days:29,
        note:'Reduced working hours across Muslim-majority supplier regions for ~a month; modest-wear demand rises.' },
      { date:'2026-03-03', name:'Holi', region:'India / South Asia', cat:'cultural', impact:'watch',
        note:'Colour festival — pauses Indian suppliers; colourful/festival content angle.' },
      { date:'2026-03-15', name:"Mother's Day (UK)", region:'UK / Ireland', cat:'occasion', impact:'demand',
        note:'UK Mothering Sunday — gifting peak. Push gift-ready pieces & bundles from late February.' },
      { date:'2026-03-20', name:'Eid al-Fitr (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'demand',
        note:'End of Ramadan — major new-clothes gifting occasion; supplier downtime in the region.' },
      { date:'2026-04-03', name:'Good Friday', region:'UK / Europe / US', cat:'public', impact:'delay',
        note:'Easter long weekend — couriers & warehouses closed Fri–Mon; build the gap into delivery promises.' },
      { date:'2026-04-05', name:'Easter Sunday', region:'Global (Christian)', cat:'cultural', impact:'demand',
        note:'Spring refresh & pastel demand + long-weekend shopping.' },
      { date:'2026-04-06', name:'Easter Monday', region:'UK / Europe', cat:'public', impact:'delay',
        note:'UK bank holiday — couriers & warehouses closed, closing out the four-day Easter dispatch gap.' },
      { date:'2026-05-04', name:'Early May Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'UK bank holiday Monday — a dispatch day lost; warn on shipping times.' },
      { date:'2026-05-10', name:"Mother's Day (US & most)", region:'US / Global', cat:'occasion', impact:'demand',
        note:'Second-Sunday Mother’s Day for the US and most markets — big gifting spike.' },
      { date:'2026-05-25', name:'Spring Bank Holiday / US Memorial Day', region:'UK / US', cat:'public', impact:'demand',
        note:'UK bank holiday + US Memorial Day sales — summer kick-off shopping weekend on both sides.' },
      { date:'2026-05-27', name:'Eid al-Adha (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
        note:'Second Eid — supplier downtime across Muslim-majority regions.' },
      { date:'2026-06-19', name:'Dragon Boat Festival', region:'China', cat:'supply', impact:'delay', days:3,
        note:'Chinese public holiday — 1–3 days of factory & freight downtime; small slip on lead times.' },
      { date:'2026-06-21', name:"Father's Day (UK & US)", region:'UK / US', cat:'occasion', impact:'demand',
        note:'Menswear gifting peak — push men’s staples & gift bundles from early June.' },
      { date:'2026-07-14', name:'Amazon Prime Day (approx.)', region:'Global', cat:'retail', impact:'demand',
        note:'Mid-July discount tentpole drags the whole market into sale mode — consider a parallel promo.' },
      { date:'2026-08-31', name:'Summer Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'Final UK summer bank holiday — dispatch day lost; also end-of-summer clearance moment.' },
      { date:'2026-09-07', name:'US Labor Day', region:'US', cat:'retail', impact:'demand',
        note:'End-of-summer US sale weekend + autumn transition demand.' },
      { date:'2026-09-12', name:'Rosh Hashanah (approx.)', region:'Global (Jewish)', cat:'cultural', impact:'watch',
        note:'Jewish New Year — gifting & new-clothes tradition in Jewish communities.' },
      { date:'2026-09-25', name:'Mid-Autumn Festival', region:'China / East Asia', cat:'supply', impact:'delay',
        note:'Chinese holiday days before Golden Week — factories slow, then shut for National Day. Compounds October risk.' },
      { date:'2026-11-08', name:'Diwali', region:'India / South Asia', cat:'cultural', impact:'demand', days:5,
        note:'Festival of Lights — major gifting & new-clothes occasion; Indian suppliers pause for ~a week.' },
      { date:'2026-11-26', name:'US Thanksgiving', region:'US', cat:'public', impact:'demand',
        note:'US warehouses closed; kicks off the Black Friday weekend — the biggest sales window of the year.' },
      { date:'2026-11-27', name:'Black Friday', region:'Global', cat:'retail', impact:'demand',
        note:'🔥 Peak sales day. Inventory must already be landed; plan discounts, bundles & ad budget weeks ahead.' },
      { date:'2026-11-30', name:'Cyber Monday', region:'Global', cat:'retail', impact:'demand',
        note:'Online-first sales climax — hold back a fresh offer to re-engage Friday’s traffic.' },
      { date:'2026-12-04', name:'Hanukkah begins', region:'Global (Jewish)', cat:'cultural', impact:'demand', days:8,
        note:'Eight nights of gifting — sustained late-year demand in Jewish communities.' }
    ],
    2027: [
      { date:'2027-01-18', name:'Martin Luther King Jr. Day', region:'US', cat:'public', impact:'watch',
        note:'US federal holiday — US carriers & warehouses closed.' },
      { date:'2027-02-06', name:'Chinese New Year — Year of the Goat', region:'China / East Asia', cat:'supply', impact:'closure', days:7,
        note:'🚨 CRITICAL: earlier than 2026 — factories close ~2–3 weeks. Confirm & pay spring orders by mid-December 2026 to avoid slips.' },
      { date:'2027-02-08', name:'Ramadan begins (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch', days:29,
        note:'Reduced working hours across Muslim-majority supplier regions for ~a month.' },
      { date:'2027-02-15', name:"Presidents' Day", region:'US', cat:'retail', impact:'demand',
        note:'Major US sale weekend.' },
      { date:'2027-03-07', name:"Mother's Day (UK)", region:'UK / Ireland', cat:'occasion', impact:'demand',
        note:'UK Mothering Sunday — gifting peak; push gift-ready pieces from late February.' },
      { date:'2027-03-10', name:'Eid al-Fitr (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'demand',
        note:'End of Ramadan — major new-clothes gifting occasion; supplier downtime.' },
      { date:'2027-03-22', name:'Holi', region:'India / South Asia', cat:'cultural', impact:'watch',
        note:'Colour festival — pauses Indian suppliers.' },
      { date:'2027-03-26', name:'Good Friday', region:'UK / Europe / US', cat:'public', impact:'delay',
        note:'Easter long weekend — couriers & warehouses closed Fri–Mon.' },
      { date:'2027-03-28', name:'Easter Sunday', region:'Global (Christian)', cat:'cultural', impact:'demand',
        note:'Spring refresh demand + long-weekend shopping.' },
      { date:'2027-03-29', name:'Easter Monday', region:'UK / Europe', cat:'public', impact:'delay',
        note:'UK bank holiday — couriers & warehouses closed, closing out the four-day Easter dispatch gap.' },
      { date:'2027-05-03', name:'Early May Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'UK bank holiday Monday — a dispatch day lost.' },
      { date:'2027-05-09', name:"Mother's Day (US & most)", region:'US / Global', cat:'occasion', impact:'demand',
        note:'Big gifting spike for the US and most markets.' },
      { date:'2027-05-16', name:'Eid al-Adha (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
        note:'Second Eid — supplier downtime across the region.' },
      { date:'2027-05-31', name:'Spring Bank Holiday / US Memorial Day', region:'UK / US', cat:'public', impact:'demand',
        note:'UK bank holiday + US Memorial Day sales — summer kick-off weekend.' },
      { date:'2027-06-09', name:'Dragon Boat Festival', region:'China', cat:'supply', impact:'delay', days:3,
        note:'Chinese public holiday — 1–3 days of factory & freight downtime.' },
      { date:'2027-06-20', name:"Father's Day (UK & US)", region:'UK / US', cat:'occasion', impact:'demand',
        note:'Menswear gifting peak — push men’s staples & gift bundles from early June.' },
      { date:'2027-07-13', name:'Amazon Prime Day (approx.)', region:'Global', cat:'retail', impact:'demand',
        note:'Mid-July discount tentpole — market goes into sale mode.' },
      { date:'2027-08-30', name:'Summer Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'Final UK summer bank holiday — dispatch day lost; clearance moment.' },
      { date:'2027-09-06', name:'US Labor Day', region:'US', cat:'retail', impact:'demand',
        note:'End-of-summer US sale weekend + autumn transition demand.' },
      { date:'2027-09-15', name:'Mid-Autumn Festival', region:'China / East Asia', cat:'supply', impact:'delay',
        note:'Chinese holiday before Golden Week — factories slow, then shut for National Day.' },
      { date:'2027-10-02', name:'Rosh Hashanah (approx.)', region:'Global (Jewish)', cat:'cultural', impact:'watch',
        note:'Jewish New Year — gifting & new-clothes tradition.' },
      { date:'2027-10-29', name:'Diwali', region:'India / South Asia', cat:'cultural', impact:'demand', days:5,
        note:'Festival of Lights — major gifting occasion; Indian suppliers pause for ~a week.' },
      { date:'2027-11-25', name:'US Thanksgiving', region:'US', cat:'public', impact:'demand',
        note:'US warehouses closed; kicks off Black Friday weekend.' },
      { date:'2027-11-26', name:'Black Friday', region:'Global', cat:'retail', impact:'demand',
        note:'🔥 Peak sales day. Inventory must already be landed; plan discounts & ad budget ahead.' },
      { date:'2027-11-29', name:'Cyber Monday', region:'Global', cat:'retail', impact:'demand',
        note:'Online-first sales climax.' },
      { date:'2027-12-24', name:'Hanukkah begins', region:'Global (Jewish)', cat:'cultural', impact:'demand', days:8,
        note:'Eight nights of gifting — sustained late-year demand.' }
    ]
  };

  const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // Monday-first (UK)

  /* ── BUILD FULL EVENT LIST FOR A YEAR ── */
  const _cache = {};
  function eventsFor(year) {
    if (_cache[year]) return _cache[year];
    const fixed = FIXED.map(e => ({
      date: year + '-' + e.md,
      name: e.name, region: e.region, cat: e.cat, impact: e.impact, note: e.note, days: e.days
    }));
    const variable = (VARIABLE[year] || []).slice();
    return (_cache[year] = fixed.concat(variable).sort((a, b) => a.date.localeCompare(b.date)));
  }

  /* ── TODAY (live) ── */
  const NOW = new Date();
  const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  const TODAY_ISO = iso(TODAY);

  /* ── STATE ── */
  const state = {
    viewYear:  TODAY.getFullYear(),
    viewMonth: TODAY.getMonth(),   // 0-11
    selected:  null,               // ISO string of a clicked day, or null = whole month
    cat: 'all',
    impact: 'all',
    q: ''
  };

  /* ── DOM HELPERS ── */
  const $ = sel => document.querySelector(sel);
  function fmtDate(isoStr) {
    const d = new Date(isoStr + 'T00:00:00');
    const day = d.getDate();
    const suffix = (day % 10 === 1 && day !== 11) ? 'st'
                 : (day % 10 === 2 && day !== 12) ? 'nd'
                 : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    const wk = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return { wk, day: day + suffix, mon: MONTHS[d.getMonth()] };
  }
  function shortName(name) {
    // Trim qualifiers so the chip stays legible; CSS ellipsis handles the rest.
    return name.split('—')[0].split('(')[0].trim();
  }
  function daysUntil(isoStr) {
    const d = new Date(isoStr + 'T00:00:00');
    return Math.round((d - TODAY) / 86400000);
  }
  function matchesFilters(e) {
    if (state.cat !== 'all' && e.cat !== state.cat) return false;
    if (state.impact !== 'all' && e.impact !== state.impact) return false;
    const q = state.q.trim().toLowerCase();
    if (q && !(e.name.toLowerCase().includes(q) || e.region.toLowerCase().includes(q) || e.note.toLowerCase().includes(q))) return false;
    return true;
  }

  /* ── LIVE BANNER + YEAR PROGRESS ── */
  function renderLive() {
    const opts = { weekday:'long', day:'numeric', month:'long', year:'numeric' };
    $('#calToday').textContent = TODAY.toLocaleDateString('en-GB', opts);

    const y = TODAY.getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    const dayOfYear = Math.floor((TODAY - start) / 86400000) + 1;
    const totalDays = Math.round((end - start) / 86400000);
    const pct = Math.min(100, Math.round((dayOfYear / totalDays) * 100));
    $('#calYearFill').style.width = pct + '%';
    $('#calYearMarker').style.left = pct + '%';
    $('#calYearMeta').textContent = `Day ${dayOfYear} of ${totalDays} · ${pct}% through ${y} · ${totalDays - dayOfYear} days left`;
  }

  /* ── SUMMARY (counts for the viewed year) ── */
  function renderSummary() {
    const all = eventsFor(state.viewYear);
    const counts = {};
    all.forEach(e => { counts[e.impact] = (counts[e.impact] || 0) + 1; });
    $('#calSummary').innerHTML = Object.keys(IMPACT).map(k =>
      `<div class="cal-summary__item" style="--c:${IMPACT[k].color}">
         <span class="cal-summary__num">${counts[k] || 0}</span>
         <span class="cal-summary__lbl">${IMPACT[k].icon} ${IMPACT[k].label}</span>
       </div>`).join('');
  }

  /* ── COVERAGE: expand multi-day holidays across their span ──
     Returns { iso: [{ event, offset, total, isStart, isEnd }] } */
  const IMPACT_PRIORITY = { closure: 4, delay: 3, demand: 2, watch: 1 };
  function addDaysIso(isoStr, n) {
    const d = new Date(isoStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function buildCoverage(year) {
    // include previous year so a late-December span bleeds correctly into January
    const events = eventsFor(year).concat(eventsFor(year - 1)).filter(matchesFilters);
    const map = {};
    events.forEach(e => {
      const total = e.days && e.days > 1 ? e.days : 1;
      for (let i = 0; i < total; i++) {
        const key = addDaysIso(e.date, i);
        (map[key] ||= []).push({ event: e, offset: i, total, isStart: i === 0, isEnd: i === total - 1 });
      }
    });
    return map;
  }
  function dominant(cover) {
    return cover.slice().sort((a, b) =>
      IMPACT_PRIORITY[b.event.impact] - IMPACT_PRIORITY[a.event.impact])[0].event.impact;
  }

  /* ── MONTH GRID ── */
  function renderMonth() {
    $('#calMonthTitle').textContent = MONTHS[state.viewMonth] + ' ' + state.viewYear;
    $('#calWeekdays').innerHTML = WEEKDAYS.map(w => `<span>${w}</span>`).join('');

    const map = buildCoverage(state.viewYear);

    const first = new Date(state.viewYear, state.viewMonth, 1);
    // Monday-first offset: JS getDay() 0=Sun..6=Sat -> 0=Mon..6=Sun
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
    const cells = [];

    // Leading days from previous month
    for (let i = 0; i < lead; i++) {
      const d = new Date(state.viewYear, state.viewMonth, 1 - (lead - i));
      cells.push({ d, out: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ d: new Date(state.viewYear, state.viewMonth, day), out: false });
    }
    // Trailing to complete the last week row
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].d;
      cells.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), out: true });
    }

    $('#calDays').innerHTML = cells.map(c => {
      const ds = iso(c.d);
      const cover = map[ds] || [];
      const isToday = ds === TODAY_ISO;
      const isSel = ds === state.selected;
      const cls = ['cal-day'];
      if (c.out) cls.push('is-out');
      if (isToday) cls.push('is-today');
      if (isSel) cls.push('is-selected');

      let style = '';
      let chips = '';
      if (cover.length) {
        cls.push('has-events');
        const imp = dominant(cover);
        style = `--dayc:${IMPACT[imp].color}`;

        // Multi-day span: coloured top bar + rounded ends
        if (cover.some(x => x.total > 1)) {
          cls.push('is-span');
          if (cover.some(x => x.total > 1 && x.isStart)) cls.push('is-span-start');
          if (cover.some(x => x.total > 1 && x.isEnd)) cls.push('is-span-end');
        }

        // Chips: name + impact for each event that STARTS on this day.
        // Ongoing span days show a "continues" chip instead of repeating the name.
        const starts = cover.filter(x => x.isStart);
        const items = starts.slice(0, 2).map(x => {
          const e = x.event, im = IMPACT[e.impact];
          const alert = e.impact === 'closure' ? '⚠ ' : '';
          const summary = e.note.replace(/^🚨\s*/, '').replace(/\s+/g, ' ').split(/[.—]/)[0].trim();
          return `<span class="cal-day__chip" style="--c:${im.color}" title="${e.name} · ${im.label} — ${summary}">
                    <span class="cal-day__chip-dot"></span>
                    <span class="cal-day__chip-txt">${alert}${shortName(e.name)}</span>
                  </span>`;
        }).join('');
        const extra = starts.length > 2 ? `<span class="cal-day__more">+${starts.length - 2} more</span>` : '';
        const ongoing = (!starts.length && cover.length)
          ? `<span class="cal-day__chip cal-day__chip--cont" style="--c:${IMPACT[imp].color}" title="${cover[0].event.name} (continues)">
               <span class="cal-day__chip-dot"></span>
               <span class="cal-day__chip-txt">${shortName(cover[0].event.name)} ›</span>
             </span>`
          : '';
        chips = `<span class="cal-day__chips">${items}${extra}${ongoing}</span>`;
      }

      return `<button class="${cls.join(' ')}" data-date="${ds}"${cover.length ? '' : ' tabindex="-1"'} style="${style}">
                <span class="cal-day__num">${c.d.getDate()}</span>
                ${chips}
              </button>`;
    }).join('');
  }

  /* ── AGENDA (viewed month, or a selected day) ── */
  function renderAgenda() {
    const grid = $('#calGrid');
    const titleEl = $('#calAgendaTitle');
    let list = eventsFor(state.viewYear).concat(eventsFor(state.viewYear - 1)).filter(matchesFilters);

    if (state.selected) {
      // include multi-day holidays whose span covers the selected day
      const sel = state.selected;
      list = list.filter(e => {
        const total = e.days && e.days > 1 ? e.days : 1;
        return sel >= e.date && sel <= addDaysIso(e.date, total - 1);
      });
      const f = fmtDate(state.selected);
      titleEl.innerHTML = `${f.wk} ${f.day} ${f.mon} ${new Date(sel+'T00:00:00').getFullYear()}
        <button class="cal-agenda__clear" id="calClearSel">Show whole month ✕</button>`;
    } else {
      list = list.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d.getFullYear() === state.viewYear && d.getMonth() === state.viewMonth;
      });
      titleEl.textContent = MONTHS[state.viewMonth] + ' ' + state.viewYear + ' — ' + list.length + ' event' + (list.length === 1 ? '' : 's');
    }

    if (!list.length) {
      grid.innerHTML = `<p class="cal-empty">No events ${state.selected ? 'on this day' : 'this month'}${state.cat!=='all'||state.impact!=='all'||state.q?' for these filters':''}.</p>`;
    } else {
      grid.innerHTML = `<div class="cal-month__list">${list.map(cardHtml).join('')}</div>`;
    }

    const clear = $('#calClearSel');
    if (clear) clear.addEventListener('click', () => { state.selected = null; renderMonth(); renderAgenda(); });
  }

  function cardHtml(e) {
    const d = fmtDate(e.date);
    const c = CAT[e.cat], im = IMPACT[e.impact];
    const du = daysUntil(e.date);
    let countdown = '';
    if (du === 0) countdown = '<span class="cal-card__soon cal-card__soon--today">Today</span>';
    else if (du > 0 && du <= 45) countdown = `<span class="cal-card__soon">in ${du} day${du===1?'':'s'}</span>`;
    else if (du < 0) countdown = `<span class="cal-card__soon cal-card__soon--past">passed</span>`;
    return `<article class="cal-card" style="--cat:${c.color};--imp:${im.color}">
      <div class="cal-card__date">
        <span class="cal-card__wk">${d.wk}</span>
        <span class="cal-card__day">${d.day}</span>
      </div>
      <div class="cal-card__body">
        <div class="cal-card__head">
          <h4 class="cal-card__name">${e.name}</h4>
          ${countdown}
        </div>
        <div class="cal-card__tags">
          <span class="cal-tag cal-tag--region">${e.region}</span>
          <span class="cal-tag cal-tag--cat">${c.label}</span>
          <span class="cal-tag cal-tag--imp">${im.icon} ${im.label}</span>
        </div>
        <p class="cal-card__note">${e.note}</p>
      </div>
    </article>`;
  }

  function renderAll() { renderSummary(); renderMonth(); renderAgenda(); }

  /* ── NAVIGATION ── */
  function shiftMonth(delta) {
    let m = state.viewMonth + delta;
    let y = state.viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.viewMonth = m; state.viewYear = y; state.selected = null;
    renderAll();
  }
  function goToday() {
    state.viewYear = TODAY.getFullYear();
    state.viewMonth = TODAY.getMonth();
    state.selected = null;
    renderAll();
  }

  /* ── CONTROLS ── */
  function buildControls() {
    // Category filter
    const catWrap = $('#calCats');
    const catOpts = [['all','All events']].concat(Object.keys(CAT).map(k => [k, CAT[k].label]));
    catWrap.innerHTML = catOpts.map(([k,l]) =>
      `<button class="cal-chip${k===state.cat?' is-active':''}" data-cat="${k}">${l}</button>`).join('');
    catWrap.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat;
      catWrap.querySelectorAll('.cal-chip').forEach(x => x.classList.toggle('is-active', x === b));
      renderMonth(); renderAgenda();
    });

    // Impact filter
    const impWrap = $('#calImpacts');
    const impOpts = [['all','All impacts']].concat(Object.keys(IMPACT).map(k => [k, IMPACT[k].icon + ' ' + IMPACT[k].label]));
    impWrap.innerHTML = impOpts.map(([k,l]) =>
      `<button class="cal-chip cal-chip--imp${k===state.impact?' is-active':''}" data-imp="${k}">${l}</button>`).join('');
    impWrap.addEventListener('click', e => {
      const b = e.target.closest('[data-imp]'); if (!b) return;
      state.impact = b.dataset.imp;
      impWrap.querySelectorAll('.cal-chip--imp').forEach(x => x.classList.toggle('is-active', x === b));
      renderMonth(); renderAgenda();
    });

    // Search
    const search = $('#calSearch');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = search.value; renderMonth(); renderAgenda(); }, 120);
    });

    // Month navigation
    $('#calPrev').addEventListener('click', () => shiftMonth(-1));
    $('#calNext').addEventListener('click', () => shiftMonth(1));
    $('#calTodayBtn').addEventListener('click', goToday);

    // Day click (select / deselect)
    $('#calDays').addEventListener('click', e => {
      const b = e.target.closest('[data-date]'); if (!b) return;
      const ds = b.dataset.date;
      if (!b.classList.contains('has-events')) return;
      state.selected = (state.selected === ds) ? null : ds;
      renderMonth(); renderAgenda();
    });

    // Keyboard arrows for month nav
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowLeft') shiftMonth(-1);
      else if (e.key === 'ArrowRight') shiftMonth(1);
      else if (e.key.toLowerCase() === 't') goToday();
    });
  }

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', () => {
    renderLive();
    buildControls();
    renderAll();
  });

})();
