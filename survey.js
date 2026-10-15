/* ============================================================
   GENAI SURVEY | survey.js
   One question per screen. Questions live in STEPS below: edit
   wording or options there and the page follows.
   ============================================================ */

'use strict';

(function initSurvey() {
  const ENDPOINT = (document.querySelector('meta[name="survey-endpoint"]') || {}).content || '';
  const STORE_KEY = 'jb-genai-survey-v3';
  // Bump with each change so responses show which version of the page sent them
  const SURVEY_VERSION = '24';

  const AGREE_ENDS = ['Strongly disagree', 'Strongly agree'];

  // Each question maps to a dissertation objective (O1–O4). Drivers and
  // barriers carry a TOE tag (Technological / Organisational / Environmental)
  // which is tallied into the response for analysis; respondents never see it.
  const notNever = a => a.frequency !== 'Never';

  const STEPS = [
    { id: 'intro', type: 'intro' },

    /* ── About you (screening + profile) ── */
    { id: 'works_in_fashion', type: 'single', section: 'About you',
      q: 'Do you work in fashion marketing, or a closely related role?',
      help: 'Brand, social, content, e-commerce, CRM, PR, creative or agency work for fashion brands all count.',
      options: ['Yes, currently', 'Yes, within the last 2 years', 'No'] },
    { id: 'company_size', type: 'single', section: 'About you', columns: 2,
      q: 'Roughly how many people work at your company?',
      options: ['Under 250', '250–999', '1,000–4,999', '5,000+', 'Not sure'] },
    { id: 'age', type: 'single', section: 'About you', columns: 2,
      q: 'How old are you?',
      options: ['18–24', '25–34', '35–44', '45–54', '55+'] },

    /* ── O1 Evolution + O2 Application ── */
    { id: 'frequency', type: 'single', section: 'Your use of AI',
      q: 'How often do you use AI in your marketing workflow?',
      help: 'Think ChatGPT, Claude, Perplexity, Midjourney, Firefly, Copilot and similar.',
      options: ['Every day', 'Sometimes', 'Never'] },
    { id: 'started', type: 'single', section: 'Your use of AI', columns: 2, when: notNever,
      q: 'When did you start using AI?',
      options: ['Before 2023', '2023', '2024', '2025', '2026', 'Not sure'] },
    { id: 'tasks', type: 'multi', section: 'Your use of AI', when: notNever,
      q: 'What do you use AI for?',
      help: 'Select all that apply.',
      options: ['Copywriting', 'Social media posts', 'Email marketing', 'Ad creative', 'Images', 'Video', 'SEO', 'Campaign ideas', 'Research', 'Data & reporting', 'Other'],
      other: 'Other' },

    /* ── O3 TOE factors ── */
    { id: 'drivers', type: 'multi', section: 'AI at your company', max: 3, when: notNever,
      q: 'What has driven your company to use AI?',
      help: 'Pick up to 3.',
      options: ['Better, easier AI tools', 'Speed & efficiency gains', 'Works with our existing systems', 'Support from leadership', 'Pressure to cut costs', 'Staff skills & enthusiasm', 'Competitors are using AI', 'Customers expect faster, more personal content', 'Agencies & tech partners pushing AI', 'Other'],
      other: 'Other',
      toe: { 'Better, easier AI tools': 'T', 'Speed & efficiency gains': 'T', 'Works with our existing systems': 'T', 'Support from leadership': 'O', 'Pressure to cut costs': 'O', 'Staff skills & enthusiasm': 'O', 'Competitors are using AI': 'E', 'Customers expect faster, more personal content': 'E', 'Agencies & tech partners pushing AI': 'E' } },
    { id: 'barriers', type: 'multi', section: 'AI at your company', max: 3, none: 'Nothing really',
      q: 'What holds AI back most at your company?',
      help: 'Pick up to 3.',
      options: ['Poor quality', 'Privacy & security', 'Skills gap', 'Cost', 'Legal & ethics', 'Nothing really', 'Other'],
      other: 'Other',
      toe: { 'Poor quality': 'T', 'Privacy & security': 'T', 'Skills gap': 'O', 'Cost': 'O', 'Legal & ethics': 'E' } },
    { id: 'readiness', type: 'multi', section: 'AI at your company', none: 'None of these',
      q: 'Which of these does your company have?',
      help: 'Select all that apply.',
      options: ['AI policy', 'AI training', 'AI budget', 'AI lead or team', 'None of these', 'Other'],
      other: 'Other' },

    /* ── O4 Impact ── */
    { id: 'impact', type: 'likert', section: 'The impact of AI', ends: AGREE_ENDS,
      q: 'How much do you agree?',
      help: '1 is strongly disagree, 5 is strongly agree.',
      statements: [
        ['productivity', 'AI has made our marketing team more productive.'],
        ['content_quality', 'AI has improved the quality of our marketing.'],
        ['personalisation', 'AI lets us create more personalised marketing.'],
        ['authenticity_risk', 'AI risks weakening brand authenticity.'],
        ['skills_change', 'AI is changing the skills marketers need.'],
        ['fewer_roles', 'AI will lead to fewer marketing jobs.']
      ] },
    { id: 'quote', type: 'text', section: 'In your words', optional: true,
      q: 'In a sentence or two, how has AI changed marketing where you work?',
      help: 'This may be quoted anonymously in the dissertation.',
      placeholder: 'Type as much or as little as you like…' },
    { id: 'contact', type: 'email', section: 'Last one', optional: true,
      q: 'Want to be part of my interview research?',
      help: 'I’m running quick interviews on Microsoft Teams to discuss your ideas and views on AI in digital marketing in more depth. Leave your email and I’ll be in touch. Your email is kept separate from your survey answers and never shared.',
      placeholder: 'you@example.com' }
  ];

  /* ── Elements ── */
  const form     = document.getElementById('svForm');
  const stage    = document.getElementById('svStep');
  const bar      = document.getElementById('svBar');
  const counter  = document.getElementById('svCount');
  const actions  = document.getElementById('svActions');
  const prevBtn  = document.getElementById('svPrev');
  const nextBtn  = document.getElementById('svNext');
  const trap     = document.getElementById('svTrap');
  if (!form || !stage) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── State (kept in localStorage so a refresh doesn't lose progress) ── */
  let state = { answers: {}, history: [], idx: 0, started: null };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.answers && typeof saved.idx === 'number' && STEPS[saved.idx]) state = saved;
  } catch (e) { /* storage blocked: start fresh */ }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function clearSaved() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  const A = () => state.answers;
  const isShown = s => !s.when || s.when(A());
  const questionSteps = () => STEPS.filter(s => s.type !== 'intro' && isShown(s));

  function nextIndex(from) {
    for (let i = from + 1; i < STEPS.length; i++) if (isShown(STEPS[i])) return i;
    return -1;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyFor = i => String.fromCharCode(65 + i);
  const TICK = '<svg class="sv-opt__tick" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ── Rendering ── */
  function head(step) {
    const opt = step.optional ? '<span class="sv-optional">Optional</span>' : '';
    const help = step.help ? `<p class="sv-help" id="svHelp">${esc(step.help)}</p>` : '';
    return `<p class="sv-eyebrow">${esc(step.section)}</p>
      <h1 class="sv-q" id="svQ" tabindex="-1">${esc(step.q)}${opt}</h1>${help}`;
  }

  function renderChoice(step) {
    const multi = step.type === 'multi';
    const current = A()[step.id];
    const picked = multi ? (current || []) : [current];
    const opts = step.options.map((o, i) => {
      const on = picked.includes(o) ? ' checked' : '';
      return `<label class="sv-opt">
          <input type="${multi ? 'checkbox' : 'radio'}" name="${step.id}" value="${esc(o)}"${on}>
          <span class="sv-opt__box"><span class="sv-opt__key">${keyFor(i)}</span><span class="sv-opt__text">${esc(o)}</span>${TICK}</span>
        </label>`;
    }).join('');
    const other = step.other
      ? `<div class="sv-other" id="svOther" ${picked.includes(step.other) ? '' : 'hidden'}>
           <input class="sv-input" type="text" id="svOtherText" maxlength="200" placeholder="Please say…" aria-label="Please say" value="${esc(A()[step.id + '_other'] || '')}">
         </div>`
      : '';
    const hint = step.options.length <= 26
      ? `<p class="sv-hint">Tip: press <kbd>A</kbd>–<kbd>${keyFor(step.options.length - 1)}</kbd> to choose${multi ? ', <kbd>Enter</kbd> to continue' : ''}.</p>`
      : '';
    return `${head(step)}
      <div class="sv-options${step.columns === 2 ? ' sv-options--two' : ''}" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="svQ">${opts}</div>
      ${other}${hint}`;
  }

  function renderLikert(step) {
    const vals = A()[step.id] || {};
    const rows = step.statements.map(([key, text]) => {
      const scale = [1, 2, 3, 4, 5].map(n =>
        `<label><input type="radio" name="${step.id}_${key}" value="${n}"${vals[key] === n ? ' checked' : ''} aria-label="${n}${n === 1 ? ', ' + step.ends[0] : n === 5 ? ', ' + step.ends[1] : ''}"><span>${n}</span></label>`
      ).join('');
      return `<fieldset class="sv-stmt" data-key="${key}">
          <legend>${esc(text)}</legend>
          <div class="sv-scale">${scale}</div>
          <div class="sv-scale-ends" aria-hidden="true"><span>${esc(step.ends[0])}</span><span>${esc(step.ends[1])}</span></div>
        </fieldset>`;
    }).join('');
    return `${head(step)}<div class="sv-likert">${rows}</div>`;
  }

  function renderText(step) {
    const v = esc(A()[step.id] || '');
    if (step.type === 'email') {
      return `${head(step)}
        <input class="sv-input" type="email" id="svText" inputmode="email" autocomplete="email" maxlength="200" placeholder="${esc(step.placeholder)}" value="${v}" aria-labelledby="svQ">
        <p class="sv-error" id="svErr" role="alert"></p>
        <button type="button" class="sv-btn sv-btn--ghost sv-skip" id="svSkip">Skip and submit</button>`;
    }
    return `${head(step)}
      <textarea class="sv-textarea" id="svText" maxlength="3000" placeholder="${esc(step.placeholder)}" aria-labelledby="svQ">${v}</textarea>`;
  }

  function renderIntro() {
    return `<div class="sv-hero">
        <p class="sv-eyebrow">University dissertation survey</p>
        <h1 class="sv-title" id="svQ" tabindex="-1">AI in<br><span class="sv-title__line">Fashion <span>Marketing</span></span></h1>
        <p class="sv-lede">This short survey is for my dissertation, which asks:</p>
        <blockquote class="sv-rq">How is AI being applied to digital marketing operations within the UK fashion industry’s large enterprises?</blockquote>
        <ul class="sv-facts"><li>About 60s</li><li>Anonymous</li></ul>
        <label class="sv-agree${A().consent ? ' is-on' : ''}" id="svAgree">
          <input type="checkbox" id="svConsent"${A().consent ? ' checked' : ''}>
          <span class="sv-agree__box" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="sv-agree__text"><b>Tick to agree</b>I’m 18 or over and happy for my anonymous answers to be used in this research.</span>
        </label>
        <button type="button" class="sv-btn" id="svStart"${A().consent ? '' : ' disabled'}>${state.history.length ? 'Pick up where I left off' : 'Start the survey'}</button>
        <details class="sv-consent">
          <summary>How your answers are used</summary>
          <ul>
            <li>Taking part is voluntary. Nothing is sent until you finish.</li>
            <li>No names are collected. Answers are only reported anonymously.</li>
            <li>Questions? <a href="mailto:jbyrne4279@gmail.com">jbyrne4279@gmail.com</a></li>
          </ul>
        </details>
      </div>`;
  }

  function renderEnd(kind) {
    const copy = kind === 'screenout'
      ? ['Thanks for stopping by', 'This survey is just for people working in or around fashion marketing, so there’s nothing more to fill in. If you know someone who is, I’d really appreciate you sending it their way.']
      : ['Thank you', 'That’s really helpful. Your answers are in and will help shape the findings. If you know other fashion marketers, sharing the link would mean a lot.'];
    return `<div class="sv-end">
        <div class="sv-end__mark"><svg width="30" height="30" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <p class="sv-eyebrow">${kind === 'screenout' ? 'All done' : 'Response received'}</p>
        <h1 class="sv-q" id="svQ" tabindex="-1">${copy[0]}</h1>
        <p class="sv-lede">${copy[1]}</p>
        <div class="sv-end__actions">
          <button type="button" class="sv-btn sv-btn--ghost" id="svShare">Share the survey</button>
          <a class="sv-btn" href="/">Back to portfolio</a>
        </div>
      </div>`;
  }

  /* ── Progress & buttons ── */
  function updateChrome(step) {
    const qs = questionSteps();
    const pos = qs.indexOf(step);
    const done = step.type === 'end';
    counter.textContent = pos >= 0 ? `${pos + 1} / ${qs.length}` : '';
    bar.style.width = done ? '100%' : pos >= 0 ? `${(pos / qs.length) * 100}%` : '0%';

    const inQuestion = pos >= 0;
    actions.hidden = !inQuestion;
    if (!inQuestion) return;

    const last = nextIndex(STEPS.indexOf(step)) === -1;
    nextBtn.textContent = last ? 'Submit' : (step.optional && isEmpty(step) ? 'Skip' : 'Continue');
    nextBtn.disabled = !isAnswered(step);
  }

  function isEmpty(step) {
    const v = A()[step.id];
    return v == null || v === '' || (Array.isArray(v) && !v.length);
  }

  function isAnswered(step) {
    if (step.optional) return true;
    const v = A()[step.id];
    if (step.type === 'likert') return !!v && step.statements.every(([k]) => v[k]);
    if (isEmpty(step)) return false;
    if (step.other) {
      const pickedOther = Array.isArray(v) ? v.includes(step.other) : v === step.other;
      if (pickedOther && !(A()[step.id + '_other'] || '').trim()) return false;
    }
    return true;
  }

  /* ── Show a step ── */
  function show(idx, dir) {
    state.idx = idx;
    save();
    const step = STEPS[idx];
    let html;
    if (step.type === 'intro') html = renderIntro();
    else if (step.type === 'end') html = renderEnd(step.kind);
    else if (step.type === 'likert') html = renderLikert(step);
    else if (step.type === 'text' || step.type === 'email') html = renderText(step);
    else html = renderChoice(step);

    stage.classList.toggle('is-back', dir === 'back');
    if (!reduceMotion) { stage.style.animation = 'none'; void stage.offsetWidth; stage.style.animation = ''; }
    stage.innerHTML = html;
    window.scrollTo(0, 0);
    bind(step);
    updateChrome(step);

    const q = document.getElementById('svQ');
    if (q && dir) q.focus({ preventScroll: true });
  }

  function bind(step) {
    if (step.type === 'intro') {
      const consent = document.getElementById('svConsent');
      const start = document.getElementById('svStart');
      consent.addEventListener('change', () => {
        state.answers.consent = consent.checked;
        start.disabled = !consent.checked;
        document.getElementById('svAgree').classList.toggle('is-on', consent.checked);
        save();
      });
      start.addEventListener('click', () => {
        if (!state.started) state.started = Date.now();
        // Resume at the furthest step reached, otherwise begin
        const resume = state.resumeAt && STEPS[state.resumeAt] ? state.resumeAt : nextIndex(0);
        state.history = state.history.length ? state.history : [0];
        show(resume, 'fwd');
      });
      return;
    }

    if (step.type === 'end') {
      document.getElementById('svShare').addEventListener('click', share);
      return;
    }

    if (step.type === 'single' || step.type === 'multi') {
      const inputs = [...stage.querySelectorAll(`input[name="${step.id}"]`)];
      const otherWrap = document.getElementById('svOther');
      const otherText = document.getElementById('svOtherText');

      const sync = e => {
        if (step.type === 'multi') {
          let vals = inputs.filter(i => i.checked).map(i => i.value);
          // A "none" answer can't sit alongside real ones
          if (step.none && vals.includes(step.none) && vals.length > 1) {
            const last = e && e.target && e.target.value;
            vals = last === step.none ? [step.none] : vals.filter(v => v !== step.none);
            inputs.forEach(i => { i.checked = vals.includes(i.value); });
          }
          state.answers[step.id] = vals;
          if (step.max) inputs.forEach(i => { i.disabled = !i.checked && vals.length >= step.max; });
        } else {
          const on = inputs.find(i => i.checked);
          state.answers[step.id] = on ? on.value : undefined;
        }
        if (otherWrap) {
          const v = state.answers[step.id];
          const showOther = Array.isArray(v) ? v.includes(step.other) : v === step.other;
          otherWrap.hidden = !showOther;
          if (!showOther) delete state.answers[step.id + '_other'];
        }
        save();
        updateChrome(step);
      };

      inputs.forEach(input => {
        input.addEventListener('change', sync);
        // Single choice: a tap/click moves on by itself (not arrow keys, which also "change")
        if (step.type === 'single') {
          input.addEventListener('click', e => {
            if (e.detail === 0) return;
            if (step.other && input.value === step.other) { setTimeout(() => otherText.focus(), 30); return; }
            setTimeout(() => { if (isAnswered(step)) next(); }, reduceMotion ? 120 : 280);
          });
        } else if (step.other && input.value === step.other) {
          input.addEventListener('click', () => { if (input.checked) setTimeout(() => otherText.focus(), 30); });
        }
      });
      if (otherText) {
        otherText.addEventListener('input', () => { state.answers[step.id + '_other'] = otherText.value; save(); updateChrome(step); });
      }
      if (step.max) sync();
      return;
    }

    if (step.type === 'likert') {
      stage.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', () => {
          const key = input.name.slice(step.id.length + 1);
          state.answers[step.id] = Object.assign({}, state.answers[step.id], { [key]: Number(input.value) });
          const row = input.closest('.sv-stmt');
          row.classList.remove('is-missing');
          save();
          updateChrome(step);
          // Bring the next unanswered statement into view on small screens
          if (input.matches(':focus-visible') === false) {
            const nextRow = row.nextElementSibling;
            if (nextRow && !nextRow.querySelector('input:checked') && window.innerWidth < 700) {
              nextRow.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            }
          }
        });
      });
      return;
    }

    const field = document.getElementById('svText');
    const skip = document.getElementById('svSkip');
    if (skip) {
      // Leave the email out entirely and send the response
      skip.addEventListener('click', () => {
        field.value = '';
        delete state.answers[step.id];
        save();
        next();
      });
    }
    field.addEventListener('input', () => {
      state.answers[step.id] = field.value;
      field.classList.remove('is-invalid');
      const err = document.getElementById('svErr');
      if (err) err.textContent = '';
      save();
      updateChrome(step);
    });
  }

  /* ── Navigation ── */
  function next() {
    const step = STEPS[state.idx];
    if (!isAnswered(step)) return;

    if (step.type === 'email') {
      const field = document.getElementById('svText');
      const v = (field.value || '').trim();
      if (v && !field.checkValidity()) {
        field.classList.add('is-invalid');
        document.getElementById('svErr').textContent = 'That email doesn’t look quite right. Fix it or clear the box to skip.';
        field.focus();
        return;
      }
    }

    if (step.id === 'works_in_fashion' && A().works_in_fashion === 'No') {
      clearSaved();
      showEnd('screenout');
      return;
    }

    const n = nextIndex(state.idx);
    if (n === -1) { submit(); return; }
    state.history.push(state.idx);
    state.resumeAt = n;
    show(n, 'fwd');
  }

  function prev() {
    const p = state.history.pop();
    if (p == null) return;
    show(p, 'back');
  }

  function showEnd(kind) {
    const end = { type: 'end', kind };
    stage.innerHTML = renderEnd(kind);
    if (kind === 'done') {
      // Big celebration once the response is in
      [0.2, 0.5, 0.8].forEach((f, i) => setTimeout(() => confetti.burst(innerWidth * f, innerHeight * 0.35, 60, 11), i * 180));
    }
    bind(end);
    updateChrome(end);
    const q = document.getElementById('svQ');
    if (q) q.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);

  /* ── Keyboard: letters pick options, Enter continues ── */
  document.addEventListener('keydown', e => {
    const step = STEPS[state.idx];
    if (!step || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target.matches('input[type="text"], input[type="email"], textarea');

    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
      if (actions.hidden) return;
      e.preventDefault();
      next();
      return;
    }
    if (typing || (step.type !== 'single' && step.type !== 'multi')) return;
    const i = e.key.length === 1 ? e.key.toUpperCase().charCodeAt(0) - 65 : -1;
    const input = stage.querySelectorAll(`input[name="${step.id}"]`)[i];
    if (!input || input.disabled) return;
    e.preventDefault();
    input.checked = step.type === 'single' ? true : !input.checked;
    input.dispatchEvent(new Event('change'));
    if (step.type === 'single') {
      if (step.other && input.value === step.other) document.getElementById('svOtherText').focus();
      else setTimeout(() => { if (isAnswered(step)) next(); }, reduceMotion ? 120 : 280);
    }
  });

  /* ── Submit ── */
  // Formspree shows each key as the field title, so use the question itself
  // as the title and the answer in words as the value.
  const AGREE_LABELS = ['', 'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'];
  const TOE_NAMES = { T: 'Technological', O: 'Organisational', E: 'Environmental' };

  function payload() {
    const a = A();
    const out = {
      _subject: 'AI survey response',
      'Survey version': SURVEY_VERSION,
      'Consent given': a.consent ? 'Yes' : 'No',
      'Submitted at': new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      'Time taken': state.started ? `${Math.max(1, Math.round((Date.now() - state.started) / 1000))} seconds` : '',
      'Device': window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700 ? 'Mobile or tablet' : 'Desktop'
    };
    STEPS.forEach(s => {
      if (s.type === 'intro') return;
      const v = a[s.id];
      if (s.type === 'likert') {
        s.statements.forEach(([k, text]) => {
          out[`Agree? ${text}`] = !isShown(s) ? '(not asked)' : (v && v[k]) ? `${AGREE_LABELS[v[k]]} (${v[k]}/5)` : '';
        });
        return;
      }
      if (s.type === 'email') { if (v && v.trim()) out['Email for Teams interview'] = v.trim(); return; }
      if (!isShown(s)) { out[s.q] = '(not asked)'; return; }
      out[s.q] = Array.isArray(v) ? v.join('; ') : (v || '');
      if (s.other && a[s.id + '_other']) out[`${s.q} (their own answer)`] = a[s.id + '_other'].trim();
      if (s.toe) {
        // Group the picked options under the TOE framework heading they belong to
        ['T', 'O', 'E'].forEach(f => {
          const picked = (v || []).filter(o => s.toe[o] === f);
          out[`${s.q} [${TOE_NAMES[f]} factors]`] = picked.length ? picked.join('; ') : 'None';
        });
      }
    });
    return out;
  }

  let sending = false;
  async function submit() {
    if (sending) return;
    if (trap.value) { clearSaved(); showEnd('done'); return; }   // bot: pretend it worked
    sending = true;
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload())
      });
      if (!res.ok) throw new Error('Bad response ' + res.status);
      clearSaved();
      state = { answers: {}, history: [], idx: 0, started: null };
      showEnd('done');
    } catch (err) {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Try again';
      let msg = document.getElementById('svErr');
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'sv-error'; msg.id = 'svErr'; msg.setAttribute('role', 'alert');
        stage.appendChild(msg);
      }
      msg.textContent = 'Couldn’t send just now. Your answers are saved on this device, so check your connection and try again.';
    } finally {
      sending = false;
    }
  }

  /* ── Share (end screen) ── */
  // Copies the survey link and confirms with a small pop-up
  async function share() {
    const url = location.origin + location.pathname;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      // Older browsers / non-secure pages: fall back to a hidden text box
      const box = document.createElement('textarea');
      box.value = url;
      box.setAttribute('readonly', '');
      box.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(box);
      box.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      box.remove();
    }
    toast(ok ? 'Copied to clipboard' : url);
  }

  let toastTimer = null;
  function toast(text) {
    let el = document.getElementById('svToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'svToast';
      el.className = 'sv-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
  }

  /* ── Confetti on every button tap ── */
  const confetti = (function () {
    if (reduceMotion) return { burst() {} };
    const COLORS = ['#e0143c', '#ff4d6a', '#ff8fa3', '#ffffff', '#b00020'];
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let parts = [], raf = null, dpr = 1;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    }
    size();
    window.addEventListener('resize', size);

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 20);
      parts.forEach(p => {
        p.vy += 0.25; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.rot += p.spin; p.life--;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 25);
        ctx.translate(p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w * dpr / 2, -p.h * dpr / 2, p.w * dpr, p.h * dpr * Math.abs(Math.cos(p.rot * 2)));
        ctx.restore();
      });
      raf = parts.length ? requestAnimationFrame(tick) : null;
    }

    function burst(x, y, count = 28, power = 7) {
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
        const v = power * (0.5 + Math.random());
        parts.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
          rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0], life: 70 + Math.random() * 40
        });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }

    // Capture phase, so it fires before the step re-renders and the button disappears
    document.addEventListener('click', e => {
      const t = e.target.closest('.sv-btn, .sv-opt input, .sv-scale input, .sv-agree input');
      if (!t || t.disabled) return;
      if (t.type === 'checkbox' && t.checked) return; // about to be unticked
      let x = e.clientX, y = e.clientY;
      if (!e.detail) { const r = t.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      burst(x, y);
    }, true);

    return { burst };
  })();

  /* ── Go ── */
  // A returning visitor sees the intro with a "pick up where I left off" button
  show(0);
})();
