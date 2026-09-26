/* ============================================================
   THE ULTIMATE CALENDAR | calendar.js
   Global holidays, cultural events & occasions with a
   supply-chain / retail-demand lens for the clothing brand.
   ============================================================ */

'use strict';

(function () {

  /* ── CATEGORY + IMPACT META ── */
  /* Apple system colours (dark) */
  const CAT = {
    retail:   { label: 'Retail', color: '#FF453A', icon: '🛍️' },
    occasion: { label: 'Gifting', color: '#FF9F0A', icon: '🎁' },
    cultural: { label: 'Cultural', color: '#BF5AF2', icon: '🌐' },
    public:   { label: 'Public Holiday', color: '#0A84FF', icon: '🏛️' },
    supply:   { label: 'Supply Chain', color: '#FFD60A', icon: '📦' }
  };
  const IMPACT = {
    demand:  { label: 'Demand spike', icon: '📈', color: '#32D74B' },
    closure: { label: 'Factory closure', icon: '🏭', color: '#FF453A' },
    delay:   { label: 'Shipping delay', icon: '🚚', color: '#FF9F0A' },
    watch:   { label: 'Plan ahead',    icon: '📌', color: '#0A84FF' }
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
    { md:'03-26', name:'Independence Day (Bangladesh)', region:'Bangladesh', cat:'supply', impact:'watch',
      note:"National holiday in the world's #2 garment exporter — factories and freight forwarders close for the day; build in a short buffer on Bangladesh-sourced orders." },
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
      note:'Late Aug–early Sep restock rush for youth & staples — land stock by mid-August.' },
    { md:'09-02', name:'National Day (Vietnam)', region:'Vietnam', cat:'supply', impact:'watch',
      note:"Vietnam's national holiday — a fast-growing sourcing alternative to China. Factories and ports pause, sometimes into a long weekend." },
    { md:'10-01', name:'China National Day / Golden Week', region:'China', cat:'supply', impact:'closure', days:7,
      note:'🚨 Chinese factories & freight shut ~1 Oct–7 Oct. Confirm and pay for orders by late August or they slip to mid-October.' },
    { md:'10-29', name:'Republic Day (Turkey)', region:'Turkey', cat:'supply', impact:'watch',
      note:"National holiday in a key nearshore supplier for EU/UK brands — Turkish mills and cut-make-trim factories close, tightening quick-turn/fast-fashion lead times that week." },
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
      { date:'2026-02-17', name:'Tet (Vietnamese New Year)', region:'Vietnam', cat:'supply', impact:'closure', days:7,
        note:'🚨 Same lunar date as Chinese New Year but a separate closure — Vietnamese garment factories shut for a week and workers often travel home for longer. Confirm Vietnam-sourced orders by early January.' },
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
        note:'End-of-summer sale weekend + autumn demand.' },
      { date:'2026-09-12', name:'Rosh Hashanah (approx.)', region:'Global (Jewish)', cat:'cultural', impact:'watch',
        note:'Jewish New Year — gifting & new-clothes tradition.' },
      { date:'2026-09-25', name:'Mid-Autumn Festival', region:'China / East Asia', cat:'supply', impact:'delay',
        note:'Factories slow before Golden Week shutdown — compounds October risk.' },
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
      { date:'2027-02-06', name:'Tet (Vietnamese New Year)', region:'Vietnam', cat:'supply', impact:'closure', days:7,
        note:'🚨 Same lunar date as Chinese New Year but a separate closure — Vietnamese garment factories shut for a week; confirm Vietnam-sourced orders by mid-December 2026.' },
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
        note:'End-of-summer sale weekend + autumn demand.' },
      { date:'2027-09-15', name:'Mid-Autumn Festival', region:'China / East Asia', cat:'supply', impact:'delay',
        note:'Factories slow before Golden Week shutdown — compounds October risk.' },
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
  // Playful emoji per event, matched by keyword (first hit wins)
  const EMOJI = [
    [/chinese new year|lunar/i, '🧧'], [/golden week|national day/i, '🏮'],
    [/dragon boat/i, '🐉'], [/mid-autumn/i, '🥮'],
    [/christmas eve/i, '🎁'], [/christmas/i, '🎄'], [/boxing day/i, '🛍️'],
    [/new year/i, '🎉'], [/valentine/i, '💝'], [/st patrick/i, '☘️'],
    [/april fool/i, '🃏'], [/earth day/i, '🌍'], [/cinco de mayo/i, '🌮'],
    [/juneteenth/i, '✊'], [/independence day \(india\)|republic day \(india\)/i, '🇮🇳'],
    [/republic day \(turkey\)/i, '🇹🇷'], [/independence day \(bangladesh\)/i, '🇧🇩'],
    [/\btet\b/i, '🧧'],
    [/independence/i, '🎆'], [/back to school/i, '🎒'], [/halloween/i, '🎃'],
    [/bonfire/i, '🎆'], [/singles/i, '🛒'], [/ramadan/i, '🌙'], [/eid/i, '🕌'],
    [/holi\b/i, '🎨'], [/diwali/i, '🪔'], [/hanukkah/i, '🕎'], [/rosh hashanah/i, '🍎'],
    [/mother/i, '💐'], [/father/i, '👔'], [/good friday|easter/i, '🐣'],
    [/memorial day/i, '🇺🇸'], [/labor day/i, '🇺🇸'], [/prime day/i, '📦'],
    [/thanksgiving/i, '🦃'], [/black friday/i, '🏷️'], [/cyber monday/i, '💻'],
    [/bank holiday/i, '🏖️']
  ];
  function emojiFor(name) {
    for (const [re, e] of EMOJI) if (re.test(name)) return e;
    return '📅';
  }
  // Country tag from a region string. Flag emojis render as flags on Apple/Safari
  // and as the 2-letter code (CN, UK, US…) on other platforms — clear either way.
  const REGION_TAG = {
    'china': { flag: '🇨🇳', code: 'CN' },
    'uk': { flag: '🇬🇧', code: 'UK' },
    'us': { flag: '🇺🇸', code: 'US' },
    'india': { flag: '🇮🇳', code: 'IN' },
    'ireland': { flag: '🇮🇪', code: 'IE' },
    'vietnam': { flag: '🇻🇳', code: 'VN' },
    'turkey': { flag: '🇹🇷', code: 'TR' },
    'bangladesh': { flag: '🇧🇩', code: 'BD' },
    'middle east': { flag: '🌙', code: 'ME' },
    'global': { flag: '🌍', code: 'WW' }
  };
  function regionTag(region) {
    const first = String(region).split('/')[0].trim().toLowerCase();
    return REGION_TAG[first] || { flag: '🌍', code: 'INT' };
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
    todayPct = pct;
    $('#calYearFill').style.width = pct + '%';
    $('#calYearMarker').style.left = pct + '%';
    $('#calYearMeta').textContent = `Day ${dayOfYear} of ${totalDays} · ${pct}% through ${y} · ${totalDays - dayOfYear} days left`;
  }
  let todayPct = 0;

  /* ── SUMMARY (counts for the viewed year) ──
     A plain data-row list — label + meaning on the left, the count as
     a right-aligned figure — rather than either a grid of hero-metric
     cards or paragraph sentences. Reads like a real table/legend, so
     it stays legible as a single column at any width instead of
     wrapping into a ragged block of prose. */
  const IMPACT_MEANING = {
    demand:  'Shoppers buy more — stock up',
    closure: 'Supplier shutdowns — order early',
    delay:   'Slower dispatch — pad timelines',
    watch:   'Worth planning around'
  };
  function renderSummary() {
    const all = eventsFor(state.viewYear);
    const counts = {};
    all.forEach(e => { counts[e.impact] = (counts[e.impact] || 0) + 1; });
    const head = $('#calSummaryHead');
    if (head) head.innerHTML = `<span class="cal-yearstats__year">${state.viewYear}</span> in numbers`;
    $('#calSummary').innerHTML = Object.keys(IMPACT).map(k => {
      const n = counts[k] || 0;
      return `<div class="cal-yearstats__item" style="--c:${IMPACT[k].color}">
         <span class="cal-yearstats__icon" aria-hidden="true">${IMPACT[k].icon}</span>
         <div class="cal-yearstats__copy">
           <p class="cal-yearstats__label">${IMPACT[k].label}</p>
           <p class="cal-yearstats__meaning">${IMPACT_MEANING[k]}</p>
         </div>
         <p class="cal-yearstats__num">${n}<span class="cal-yearstats__unit">day${n === 1 ? '' : 's'}</span></p>
       </div>`;
    }).join('');
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
  function renderMonth(dir) {
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
    // Trailing days: always fill a full 6-week (42-cell) grid so every month
    // is the same height, regardless of how many week-rows it spans.
    while (cells.length < 42) {
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
          const e = x.event, im = IMPACT[e.impact], rt = regionTag(e.region);
          const summary = e.note.replace(/^🚨\s*/, '').replace(/\s+/g, ' ').split(/[.—]/)[0].trim();
          return `<span class="cal-day__chip" style="--c:${im.color}" title="${e.name} · ${e.region} · ${im.label} — ${summary}">
                    <span class="cal-day__chip-emoji">${emojiFor(e.name)}</span>
                    <span class="cal-day__chip-txt">${shortName(e.name)}</span>
                    <span class="cal-day__chip-flag" title="${e.region}">${rt.flag}</span>
                  </span>`;
        }).join('');
        const extra = starts.length > 2 ? `<span class="cal-day__more">+${starts.length - 2} more</span>` : '';
        const ongoing = (!starts.length && cover.length)
          ? (() => { const oe = cover[0].event, rt = regionTag(oe.region);
              return `<span class="cal-day__chip cal-day__chip--cont" style="--c:${IMPACT[imp].color}" title="${oe.name} · ${oe.region} (continues)">
               <span class="cal-day__chip-emoji">${emojiFor(oe.name)}</span>
               <span class="cal-day__chip-txt">${shortName(oe.name)} ›</span>
               <span class="cal-day__chip-flag" title="${oe.region}">${rt.flag}</span>
             </span>`; })()
          : '';
        chips = `<span class="cal-day__chips">${items}${extra}${ongoing}</span>`;
      }

      return `<button class="${cls.join(' ')}" data-date="${ds}"${cover.length ? '' : ' tabindex="-1"'} style="${style}">
                <span class="cal-day__num">${c.d.getDate()}</span>
                ${chips}
              </button>`;
    }).join('');

    // Slide the incoming month in from the direction it arrived —
    // restarted on every call via the remove/reflow/add trick since the
    // same class name wouldn't otherwise re-trigger the CSS animation.
    if (dir) {
      const daysEl = $('#calDays');
      daysEl.classList.remove('cal-anim-left', 'cal-anim-right');
      void daysEl.offsetWidth;
      daysEl.classList.add(dir > 0 ? 'cal-anim-right' : 'cal-anim-left');
    }
  }

  /* ── AGENDA (always the viewed month) ── */
  function renderAgenda() {
    const grid = $('#calGrid');
    const titleEl = $('#calAgendaTitle');
    const searching = state.q.trim().length > 0;
    let list;

    if (searching) {
      // Search reaches across the whole viewed year, not just the open
      // month — the calendar keeps browsing month-by-month, but a query
      // widens the agenda into year-wide results you can jump to.
      list = eventsFor(state.viewYear)
        .filter(matchesFilters)
        .sort((a, b) => a.date.localeCompare(b.date));
      titleEl.textContent = `“${state.q.trim()}” — ${list.length} match${list.length === 1 ? '' : 'es'} in ${state.viewYear}`;
    } else {
      list = eventsFor(state.viewYear).concat(eventsFor(state.viewYear - 1))
        .filter(matchesFilters)
        .filter(e => {
          const d = new Date(e.date + 'T00:00:00');
          return d.getFullYear() === state.viewYear && d.getMonth() === state.viewMonth;
        })
        // Most relevant first: the date closest to today (soonest
        // upcoming, or most recently passed) leads, oldest last.
        .sort((a, b) => b.date.localeCompare(a.date));
      titleEl.textContent = MONTHS[state.viewMonth] + ' ' + state.viewYear + ' — ' + list.length + ' event' + (list.length === 1 ? '' : 's');
    }

    if (!list.length) {
      const filtered = state.cat !== 'all' || state.impact !== 'all';
      grid.innerHTML = searching
        ? `<p class="cal-empty">No events in ${state.viewYear} match “${state.q.trim()}”${filtered ? ' with these filters' : ''}.</p>`
        : `<p class="cal-empty">No events this month${filtered ? ' for these filters' : ''}.</p>`;
    } else {
      grid.innerHTML = `<div class="cal-month__list">${list.map((e, i) => cardHtml(e, searching, i)).join('')}</div>`;
    }
  }

  /* ── DAY POPUP: events for a clicked day, shown in a centred modal ── */
  function eventsOnDay(iso) {
    return eventsFor(new Date(iso+'T00:00:00').getFullYear())
      .concat(eventsFor(new Date(iso+'T00:00:00').getFullYear() - 1))
      .filter(matchesFilters)
      .filter(e => {
        const total = e.days && e.days > 1 ? e.days : 1;
        return iso >= e.date && iso <= addDaysIso(e.date, total - 1);
      });
  }
  function openDayModal(iso) {
    const modal = $('#calModal');
    if (!modal) return;
    const list = eventsOnDay(iso);
    if (!list.length) return;
    const f = fmtDate(iso);
    const yr = new Date(iso+'T00:00:00').getFullYear();
    $('#calModalTitle').textContent = `${f.wk} ${f.day} ${f.mon} ${yr}`;
    $('#calModalSub').textContent = list.length + ' event' + (list.length === 1 ? '' : 's');
    $('#calModalBody').innerHTML = list.map(modalCardHtml).join('');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const closeBtn = $('#calModalClose');
    if (closeBtn) closeBtn.focus();
  }
  function closeDayModal() {
    const modal = $('#calModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (state.selected) { state.selected = null; renderMonth(); }
  }

  /* Same data-row language as the Year in numbers list: a colored icon
     badge, then content, in one continuous divided panel rather than
     separate bordered/shadowed cards — just with the extra per-event
     metadata (status, tags, note) that a single stat row doesn't need,
     and a right-aligned date figure taking the numeral's place. */
  function cardHtml(e, jumpable, i) {
    const d = fmtDate(e.date);
    const c = CAT[e.cat], im = IMPACT[e.impact];
    const du = daysUntil(e.date);
    let status = '';
    if (du === 0) status = '<span class="cal-card__status cal-card__status--today">Today</span>';
    else if (du > 0 && du <= 45) status = `<span class="cal-card__status">in ${du} day${du===1?'':'s'}</span>`;
    else if (du < 0) status = `<span class="cal-card__status cal-card__status--past">Passed</span>`;
    // Year-wide search results span every month, so they get a jump-to-date
    // affordance plus a month label the single-month agenda doesn't need.
    const [dayNum, ...ordRest] = d.day.match(/(\d+)(\D*)/).slice(1);
    return `<article class="cal-card${jumpable ? ' cal-card--jump' : ''}" style="--cat:${c.color};--imp:${im.color};--i:${i || 0}"${jumpable ? ` data-jump="${e.date}" role="button" tabindex="0"` : ''}>
      <div class="cal-card__figure">
        <span class="cal-card__daynum">${dayNum}<sup>${ordRest.join('')}</sup></span>
        <span class="cal-card__dayunit">${jumpable ? d.mon.slice(0, 3) : d.wk}</span>
      </div>
      <div class="cal-card__body">
        <div class="cal-card__head">
          <h4 class="cal-card__name">${e.name}</h4>
          ${status}
        </div>
        <div class="cal-card__tags">
          <span class="cal-tag cal-tag--region">${e.region}</span>
          <span class="cal-tag cal-tag--cat">${c.label}</span>
          <span class="cal-tag cal-tag--imp"><span class="cal-tag__icon">${im.icon}</span>${im.label}</span>
        </div>
        <p class="cal-card__note">${e.note}</p>
      </div>
      <span class="cal-card__icon" style="--c:${im.color}" aria-hidden="true">${im.icon}</span>
    </article>`;
  }

  /* Day-popup layout — deliberately its own markup rather than reusing
     cardHtml(): the modal header already states the date once, so
     repeating a weekday/day-number sidebar per event (cardHtml's list
     layout, built for scanning many different dates at once) just
     produced a cramped, misaligned block for what's really a single
     detail view. This drops the redundant date and gives each event a
     clear top row (icon + name + status) over its tags and note. */
  function modalCardHtml(e) {
    const c = CAT[e.cat], im = IMPACT[e.impact];
    const du = daysUntil(e.date);
    let countdown = '';
    if (du === 0) countdown = '<span class="cal-detail__status cal-detail__status--today">Today</span>';
    else if (du > 0 && du <= 45) countdown = `<span class="cal-detail__status">in ${du} day${du === 1 ? '' : 's'}</span>`;
    else if (du < 0) countdown = `<span class="cal-detail__status cal-detail__status--past">Passed</span>`;
    return `<article class="cal-detail" style="--cat:${c.color};--imp:${im.color}">
      <div class="cal-detail__head">
        <span class="cal-detail__icon" style="--c:${c.color}">${emojiFor(e.name)}</span>
        <h4 class="cal-detail__name">${e.name}</h4>
        ${countdown}
      </div>
      <div class="cal-detail__tags">
        <span class="cal-tag cal-tag--region">${e.region}</span>
        <span class="cal-tag cal-tag--cat">${c.label}</span>
        <span class="cal-tag cal-tag--imp"><span class="cal-tag__icon">${im.icon}</span>${im.label}</span>
      </div>
      <p class="cal-detail__note">${e.note}</p>
    </article>`;
  }

  function renderAll(dir) { renderSummary(); renderMonth(dir); renderAgenda(); }

  /* ── NAVIGATION ── */
  function shiftMonth(delta) {
    let m = state.viewMonth + delta;
    let y = state.viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.viewMonth = m; state.viewYear = y; state.selected = null;
    renderAll(delta);
  }
  function goToday() {
    state.viewYear = TODAY.getFullYear();
    state.viewMonth = TODAY.getMonth();
    state.selected = null;
    renderAll();
  }

  /* ── SCRUBBER: drag the progress marker to peek through months,
     then it springs back to today's date on release ── */
  function setupScrubber() {
    const track  = $('#calYearTrack');
    const marker = $('#calYearMarker');
    const fill   = $('#calYearFill');
    const bubble = $('#calScrubBubble');
    if (!track) return;
    let dragging = false;

    const pctFromX = clientX => {
      const r = track.getBoundingClientRect();
      return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    };
    const scrubTo = pct => {
      marker.style.left = pct + '%';
      fill.style.width = pct + '%';
      const month = Math.max(0, Math.min(11, Math.floor(pct / 100 * 12)));
      bubble.style.left = pct + '%';
      bubble.textContent = MONTHS[month] + ' ' + TODAY.getFullYear();
      if (month !== state.viewMonth || state.viewYear !== TODAY.getFullYear()) {
        state.viewYear = TODAY.getFullYear();
        state.viewMonth = month;
        state.selected = null;
        renderMonth(); renderAgenda();
      }
    };
    const start = e => {
      dragging = true;
      track.classList.add('is-scrubbing');
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
      scrubTo(pctFromX(e.clientX));
      e.preventDefault();
    };
    const move = e => { if (dragging) scrubTo(pctFromX(e.clientX)); };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-scrubbing');
      // Stay wherever the user scrubbed to — the calendar below has
      // already followed the drag via scrubTo(), so releasing here
      // shouldn't discard that and jump back to today on its own.
    };
    track.addEventListener('pointerdown', start);
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    // Keyboard support: arrows scrub, then release returns to today
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { shiftMonth(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { shiftMonth(1); e.preventDefault(); }
      else if (e.key === 'Home' || e.key.toLowerCase() === 't') { goToday(); e.preventDefault(); }
    });
  }

  /* ── FILTER DROPDOWNS (Type / Impact) ──
     A single reusable listbox-style dropdown: a pill button showing the
     current selection, opening a floating menu of options. Replaces the
     old chip rows so filtering reads as "choose one setting" rather than
     a wall of buttons, and collapses two long chip rows into two compact
     controls on every screen size. */
  const _dropdownClosers = [];
  function closeAllDropdowns() { _dropdownClosers.forEach(fn => fn()); }

  function setupDropdown({ root, btn, menu, valueEl, options, getKey, onSelect }) {
    function render() {
      const active = getKey();
      menu.innerHTML = options.map(([k, label, icon, color]) => {
        const swatch = icon ? `<span class="cal-dropdown__opt-icon"${color ? ` style="color:${color}"` : ''}>${icon}</span>`
                     : color ? `<span class="cal-dropdown__dot" style="--dot:${color}"></span>` : '';
        return `<li class="cal-dropdown__opt${k === active ? ' is-active' : ''}" data-k="${k}" role="option" aria-selected="${k === active}" tabindex="-1">
          ${swatch}<span class="cal-dropdown__opt-text">${label}</span>${k === active ? '<span class="cal-dropdown__check">✓</span>' : ''}
        </li>`;
      }).join('');
    }
    function isOpen() { return root.classList.contains('is-open'); }
    function open() {
      closeAllDropdowns();
      render();
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('.cal-dropdown__opt.is-active') || menu.querySelector('.cal-dropdown__opt');
      if (first) first.focus();
    }
    function close(refocus) {
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }
    btn.addEventListener('click', e => {
      e.stopPropagation();
      isOpen() ? close() : open();
    });
    menu.addEventListener('click', e => {
      e.stopPropagation();
      const li = e.target.closest('[data-k]'); if (!li) return;
      const opt = options.find(o => o[0] === li.dataset.k);
      onSelect(li.dataset.k);
      valueEl.textContent = opt[1];
      root.classList.toggle('has-filter', li.dataset.k !== 'all');
      render();
      close(true);
    });
    // Roving focus: Up/Down move between options, Enter/Space select,
    // Escape closes and returns focus to the trigger button.
    menu.addEventListener('keydown', e => {
      const opts = Array.from(menu.querySelectorAll('.cal-dropdown__opt'));
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close();
    });
    _dropdownClosers.push(() => close());
    render();
    // Reflect the initial selection's active styling on load
    root.classList.toggle('has-filter', getKey() !== 'all');
  }

  /* ── CONTROLS ── */
  function buildControls() {
    setupDropdown({
      root: $('#calCatDropdown'), btn: $('#calCatBtn'), menu: $('#calCatMenu'), valueEl: $('#calCatValue'),
      options: [['all', 'All events']].concat(Object.keys(CAT).map(k => [k, CAT[k].label, CAT[k].icon, CAT[k].color])),
      getKey: () => state.cat,
      onSelect: k => { state.cat = k; renderMonth(); renderAgenda(); }
    });
    setupDropdown({
      root: $('#calImpDropdown'), btn: $('#calImpBtn'), menu: $('#calImpMenu'), valueEl: $('#calImpValue'),
      options: [['all', 'All impacts']].concat(Object.keys(IMPACT).map(k => [k, IMPACT[k].label, IMPACT[k].icon, IMPACT[k].color])),
      getKey: () => state.impact,
      onSelect: k => { state.impact = k; renderMonth(); renderAgenda(); }
    });
    document.addEventListener('click', closeAllDropdowns);

    // Search — now scoped to the whole viewed year rather than the open
    // month, so typing surfaces matches anywhere in state.viewYear.
    const search = $('#calSearch');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = search.value; renderMonth(); renderAgenda(); }, 120);
    });

    // Month navigation
    $('#calPrev').addEventListener('click', () => shiftMonth(-1));
    $('#calNext').addEventListener('click', () => shiftMonth(1));
    setupDatePicker();

    // Day click → open the day popup (suppressed right after a swipe so
    // the same gesture doesn't also fire a click on whatever cell ends
    // up under the finger).
    $('#calDays').addEventListener('click', e => {
      if (suppressNextDayClick) { suppressNextDayClick = false; return; }
      const b = e.target.closest('[data-date]'); if (!b) return;
      const ds = b.dataset.date;
      if (!b.classList.contains('has-events')) return;
      state.selected = ds;
      renderMonth();
      openDayModal(ds);
    });
    setupMonthSwipe($('#calDays'));

    // Year-wide search results are jumpable: click/Enter a card to hop
    // the month grid to that date and open its day popup.
    $('#calGrid').addEventListener('click', e => {
      const card = e.target.closest('.cal-card--jump[data-jump]'); if (!card) return;
      jumpToDate(card.dataset.jump);
    });
    $('#calGrid').addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.cal-card--jump[data-jump]'); if (!card) return;
      e.preventDefault();
      jumpToDate(card.dataset.jump);
    });

    // Modal close: X button, overlay backdrop, Escape
    const modal = $('#calModal');
    if (modal) {
      $('#calModalClose').addEventListener('click', closeDayModal);
      modal.addEventListener('click', e => { if (e.target === modal) closeDayModal(); });
    }

    // Keyboard: month nav, and Escape closes the popup / any open dropdown
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeDayModal(); closeAllDropdowns(); return; }
      if (e.target.matches('input, textarea')) return;
      if (modal && modal.classList.contains('is-open')) return; // don't nav while popup open
      if (e.key === 'ArrowLeft') shiftMonth(-1);
      else if (e.key === 'ArrowRight') shiftMonth(1);
      else if (e.key.toLowerCase() === 't') goToday();
    });
  }

  /* ── TODAY / JUMP-TO-DATE PICKER ──
     The Today button opens a compact year → month → day picker (styled
     like the Type/Impact dropdowns) for jumping to an exact date with
     more precision than the prev/next buttons. Its own dp.year/dp.month
     are a scratch position independent of the main state — browsing the
     picker doesn't move the calendar until a day is actually chosen. */
  const dp = { year: TODAY.getFullYear(), month: TODAY.getMonth() };

  function renderDpMonths() {
    $('#calDpYear').textContent = dp.year;
    $('#calDpMonths').innerHTML = MONTHS.map((m, i) =>
      `<button class="cal-datepicker__month${i === dp.month ? ' is-active' : ''}" data-m="${i}" role="option" aria-selected="${i === dp.month}">${m.slice(0, 3)}</button>`
    ).join('');
  }
  function renderDpDays() {
    if (!$('#calDpWeekdays').children.length) {
      $('#calDpWeekdays').innerHTML = WEEKDAYS.map(w => `<span>${w[0]}</span>`).join('');
    }
    const first = new Date(dp.year, dp.month, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(dp.year, dp.month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ d: new Date(dp.year, dp.month, 1 - (lead - i)), out: true });
    for (let day = 1; day <= daysInMonth; day++) cells.push({ d: new Date(dp.year, dp.month, day), out: false });
    while (cells.length < 42) {
      const last = cells[cells.length - 1].d;
      cells.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), out: true });
    }
    $('#calDpDays').innerHTML = cells.map(c => {
      const ds = iso(c.d);
      const cls = ['cal-datepicker__day'];
      if (c.out) cls.push('is-out');
      if (ds === TODAY_ISO) cls.push('is-today');
      if (ds === state.selected) cls.push('is-selected');
      return `<button class="${cls.join(' ')}" data-date="${ds}" role="option" aria-selected="${ds === state.selected}">${c.d.getDate()}</button>`;
    }).join('');
  }
  function renderDp() { renderDpMonths(); renderDpDays(); }

  function setupDatePicker() {
    const root = $('#calDpDropdown'), btn = $('#calTodayBtn'), panel = $('#calDpPanel');

    function open() {
      closeAllDropdowns();
      dp.year = state.viewYear;
      dp.month = state.viewMonth;
      renderDp();
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
    function close(refocus) {
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      root.classList.contains('is-open') ? close() : open();
    });
    panel.addEventListener('click', e => e.stopPropagation());

    // Every change inside the picker — stepping the year, picking a
    // month — follows through to the main calendar live, instead of
    // only committing once a specific day is clicked.
    function syncMainToPicker() {
      const delta = (dp.year - state.viewYear) * 12 + (dp.month - state.viewMonth);
      state.viewYear = dp.year;
      state.viewMonth = dp.month;
      state.selected = null;
      renderSummary();
      renderMonth(delta > 0 ? 1 : delta < 0 ? -1 : 0);
      renderAgenda();
      renderDpDays(); // reflect the (now cleared) selection back in the mini day-grid
    }

    $('#calDpYearPrev').addEventListener('click', () => { dp.year--; renderDp(); syncMainToPicker(); });
    $('#calDpYearNext').addEventListener('click', () => { dp.year++; renderDp(); syncMainToPicker(); });
    $('#calDpMonths').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      dp.month = Number(b.dataset.m);
      renderDpMonths();
      renderDpDays();
      syncMainToPicker();
    });
    $('#calDpDays').addEventListener('click', e => {
      const b = e.target.closest('[data-date]'); if (!b) return;
      close();
      jumpToDate(b.dataset.date);
    });
    $('#calDpJumpToday').addEventListener('click', () => { close(); goToday(); });

    _dropdownClosers.push(() => close());
  }

  /* Jump the month grid + agenda to a given ISO date and open its popup —
     used by year-wide search results, which can point outside the
     currently viewed month. */
  function jumpToDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const delta = (d.getFullYear() - state.viewYear) * 12 + (d.getMonth() - state.viewMonth);
    state.viewYear = d.getFullYear();
    state.viewMonth = d.getMonth();
    state.selected = iso;
    renderSummary();
    renderMonth(delta > 0 ? 1 : delta < 0 ? -1 : 0);
    openDayModal(iso);
    $('#calMonthTitle').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── SWIPE: drag left/right across the month grid to page months ──
     Touch/pen only (desktop already has arrow buttons + arrow keys).
     touch-action:pan-y on the grid lets vertical page-scroll keep
     working; a horizontal drag past the threshold pages the month and
     suppresses the click that would otherwise fire on release. */
  let suppressNextDayClick = false;
  function setupMonthSwipe(el) {
    if (!el) return;
    let start = null;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    el.addEventListener('pointerup', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressNextDayClick = true;
        shiftMonth(dx < 0 ? 1 : -1);
      }
    });
    el.addEventListener('pointercancel', () => { start = null; });
  }

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', () => {
    renderLive();
    buildControls();
    setupScrubber();
    renderAll();
  });

})();
