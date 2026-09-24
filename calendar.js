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
    { md:'10-01', name:'China National Day / Golden Week', region:'China', cat:'supply', impact:'closure',
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
      note:'Biggest clearance day of the UK year — plan markdowns & a sale drop in advance.' },
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
      { date:'2026-02-17', name:'Chinese New Year — Year of the Horse', region:'China / East Asia', cat:'supply', impact:'closure',
        note:'🚨 CRITICAL: factories close ~2–3 weeks around this date and staff often return slowly. Place, confirm & pay for spring/summer orders by early January or expect 4–6 week slips.' },
      { date:'2026-02-18', name:'Ramadan begins (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
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
      { date:'2026-05-04', name:'Early May Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'UK bank holiday Monday — a dispatch day lost; warn on shipping times.' },
      { date:'2026-05-10', name:"Mother's Day (US & most)", region:'US / Global', cat:'occasion', impact:'demand',
        note:'Second-Sunday Mother’s Day for the US and most markets — big gifting spike.' },
      { date:'2026-05-25', name:'Spring Bank Holiday / US Memorial Day', region:'UK / US', cat:'public', impact:'demand',
        note:'UK bank holiday + US Memorial Day sales — summer kick-off shopping weekend on both sides.' },
      { date:'2026-05-27', name:'Eid al-Adha (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
        note:'Second Eid — supplier downtime across Muslim-majority regions.' },
      { date:'2026-06-19', name:'Dragon Boat Festival', region:'China', cat:'supply', impact:'delay',
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
      { date:'2026-11-08', name:'Diwali', region:'India / South Asia', cat:'cultural', impact:'demand',
        note:'Festival of Lights — major gifting & new-clothes occasion; Indian suppliers pause for ~a week.' },
      { date:'2026-11-26', name:'US Thanksgiving', region:'US', cat:'public', impact:'demand',
        note:'US warehouses closed; kicks off the Black Friday weekend — the biggest sales window of the year.' },
      { date:'2026-11-27', name:'Black Friday', region:'Global', cat:'retail', impact:'demand',
        note:'🔥 Peak sales day. Inventory must already be landed; plan discounts, bundles & ad budget weeks ahead.' },
      { date:'2026-11-30', name:'Cyber Monday', region:'Global', cat:'retail', impact:'demand',
        note:'Online-first sales climax — hold back a fresh offer to re-engage Friday’s traffic.' },
      { date:'2026-12-04', name:'Hanukkah begins', region:'Global (Jewish)', cat:'cultural', impact:'demand',
        note:'Eight nights of gifting — sustained late-year demand in Jewish communities.' }
    ],
    2027: [
      { date:'2027-01-18', name:'Martin Luther King Jr. Day', region:'US', cat:'public', impact:'watch',
        note:'US federal holiday — US carriers & warehouses closed.' },
      { date:'2027-02-06', name:'Chinese New Year — Year of the Goat', region:'China / East Asia', cat:'supply', impact:'closure',
        note:'🚨 CRITICAL: earlier than 2026 — factories close ~2–3 weeks. Confirm & pay spring orders by mid-December 2026 to avoid slips.' },
      { date:'2027-02-08', name:'Ramadan begins (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
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
      { date:'2027-05-03', name:'Early May Bank Holiday', region:'UK', cat:'public', impact:'delay',
        note:'UK bank holiday Monday — a dispatch day lost.' },
      { date:'2027-05-09', name:"Mother's Day (US & most)", region:'US / Global', cat:'occasion', impact:'demand',
        note:'Big gifting spike for the US and most markets.' },
      { date:'2027-05-16', name:'Eid al-Adha (approx.)', region:'Middle East / Muslim world', cat:'cultural', impact:'watch',
        note:'Second Eid — supplier downtime across the region.' },
      { date:'2027-05-31', name:'Spring Bank Holiday / US Memorial Day', region:'UK / US', cat:'public', impact:'demand',
        note:'UK bank holiday + US Memorial Day sales — summer kick-off weekend.' },
      { date:'2027-06-09', name:'Dragon Boat Festival', region:'China', cat:'supply', impact:'delay',
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
      { date:'2027-10-29', name:'Diwali', region:'India / South Asia', cat:'cultural', impact:'demand',
        note:'Festival of Lights — major gifting occasion; Indian suppliers pause for ~a week.' },
      { date:'2027-11-25', name:'US Thanksgiving', region:'US', cat:'public', impact:'demand',
        note:'US warehouses closed; kicks off Black Friday weekend.' },
      { date:'2027-11-26', name:'Black Friday', region:'Global', cat:'retail', impact:'demand',
        note:'🔥 Peak sales day. Inventory must already be landed; plan discounts & ad budget ahead.' },
      { date:'2027-11-29', name:'Cyber Monday', region:'Global', cat:'retail', impact:'demand',
        note:'Online-first sales climax.' },
      { date:'2027-12-24', name:'Hanukkah begins', region:'Global (Jewish)', cat:'cultural', impact:'demand',
        note:'Eight nights of gifting — sustained late-year demand.' }
    ]
  };

  const YEARS = [2026, 2027];

  /* ── BUILD FULL EVENT LIST FOR A YEAR ── */
  function eventsFor(year) {
    const fixed = FIXED.map(e => ({
      date: year + '-' + e.md,
      name: e.name, region: e.region, cat: e.cat, impact: e.impact, note: e.note
    }));
    const variable = (VARIABLE[year] || []).slice();
    return fixed.concat(variable).sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ── STATE ── */
  const state = {
    year: (YEARS.includes(new Date().getFullYear()) ? new Date().getFullYear() : YEARS[0]),
    cat: 'all',
    impact: 'all',
    q: ''
  };

  /* ── DOM HELPERS ── */
  const $ = sel => document.querySelector(sel);
  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDate();
    const suffix = (day % 10 === 1 && day !== 11) ? 'st'
                 : (day % 10 === 2 && day !== 12) ? 'nd'
                 : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    const wk = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return { wk, day: day + suffix, mon: MONTHS[d.getMonth()] };
  }
  function daysUntil(iso) {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(iso + 'T00:00:00');
    return Math.round((d - today) / 86400000);
  }

  /* ── RENDER ── */
  function render() {
    const all = eventsFor(state.year);
    const q = state.q.trim().toLowerCase();
    const filtered = all.filter(e => {
      if (state.cat !== 'all' && e.cat !== state.cat) return false;
      if (state.impact !== 'all' && e.impact !== state.impact) return false;
      if (q && !(e.name.toLowerCase().includes(q) || e.region.toLowerCase().includes(q) || e.note.toLowerCase().includes(q))) return false;
      return true;
    });

    // Count summary
    const counts = { demand:0, closure:0, delay:0, watch:0 };
    all.forEach(e => { counts[e.impact] = (counts[e.impact] || 0) + 1; });
    $('#calSummary').innerHTML = Object.keys(IMPACT).map(k =>
      `<div class="cal-summary__item" style="--c:${IMPACT[k].color}">
         <span class="cal-summary__num">${counts[k] || 0}</span>
         <span class="cal-summary__lbl">${IMPACT[k].icon} ${IMPACT[k].label}</span>
       </div>`).join('');

    // Group by month
    const grid = $('#calGrid');
    if (!filtered.length) {
      grid.innerHTML = `<p class="cal-empty">No events match those filters. Try clearing the search or switching category.</p>`;
      return;
    }
    const byMonth = {};
    filtered.forEach(e => { (byMonth[new Date(e.date+'T00:00:00').getMonth()] ||= []).push(e); });

    grid.innerHTML = Object.keys(byMonth).map(m => {
      const cards = byMonth[m].map(cardHtml).join('');
      return `<section class="cal-month">
                <h3 class="cal-month__title">${MONTHS[m]} <span>${state.year}</span></h3>
                <div class="cal-month__list">${cards}</div>
              </section>`;
    }).join('');
  }

  function cardHtml(e) {
    const d = fmtDate(e.date);
    const c = CAT[e.cat], im = IMPACT[e.impact];
    const du = daysUntil(e.date);
    let countdown = '';
    if (du === 0) countdown = '<span class="cal-card__soon cal-card__soon--today">Today</span>';
    else if (du > 0 && du <= 45) countdown = `<span class="cal-card__soon">in ${du} day${du===1?'':'s'}</span>`;
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

  /* ── CONTROLS ── */
  function buildControls() {
    // Year toggle
    const yearWrap = $('#calYears');
    yearWrap.innerHTML = YEARS.map(y =>
      `<button class="cal-yr${y===state.year?' is-active':''}" data-year="${y}">${y}</button>`).join('');
    yearWrap.addEventListener('click', e => {
      const b = e.target.closest('[data-year]'); if (!b) return;
      state.year = parseInt(b.dataset.year, 10);
      yearWrap.querySelectorAll('.cal-yr').forEach(x => x.classList.toggle('is-active', x === b));
      render();
    });

    // Category filter
    const catWrap = $('#calCats');
    const catOpts = [['all','All events']].concat(Object.keys(CAT).map(k => [k, CAT[k].label]));
    catWrap.innerHTML = catOpts.map(([k,l]) =>
      `<button class="cal-chip${k===state.cat?' is-active':''}" data-cat="${k}">${l}</button>`).join('');
    catWrap.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat;
      catWrap.querySelectorAll('.cal-chip').forEach(x => x.classList.toggle('is-active', x === b));
      render();
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
      render();
    });

    // Search
    const search = $('#calSearch');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = search.value; render(); }, 120);
    });
  }

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', () => {
    buildControls();
    render();
  });

})();
