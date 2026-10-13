/* ============================================================
   GENAI SURVEY | survey.js
   One question per screen. Questions live in STEPS below: edit
   wording or options there and the page follows.
   ============================================================ */

'use strict';

(function initSurvey() {
  const ENDPOINT = (document.querySelector('meta[name="survey-endpoint"]') || {}).content || '';
  const STORE_KEY = 'jb-genai-survey-v1';

  const AGREE_ENDS = ['Strongly disagree', 'Strongly agree'];

  const STEPS = [
    { id: 'intro', type: 'intro' },

    /* ── Section 1: About you ── */
    { id: 'works_in_fashion', type: 'single', section: 'About you',
      q: 'Do you work in fashion marketing, or a closely related role?',
      help: 'Brand, social, content, e-commerce, CRM, PR, creative, buying or agency work for fashion brands all count.',
      options: ['Yes, currently', 'Yes, within the last 2 years', 'No'] },
    { id: 'age', type: 'single', section: 'About you', columns: 2,
      q: 'How old are you?',
      options: ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'] },
    { id: 'location', type: 'single', section: 'About you', columns: 2,
      q: 'Where in England are you based?',
      help: 'Roughly is fine.',
      options: ['North of England', 'South of England', 'East of England', 'West of England', 'Midlands', 'London', 'Outside England'] },
    { id: 'gender', type: 'single', section: 'About you', optional: true, columns: 2,
      q: 'How do you describe your gender?',
      options: ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'],
      other: 'Prefer to self-describe' },

    /* ── Section 2: Your work ── */
    { id: 'role', type: 'single', section: 'Your work',
      q: 'Which best describes your main area?',
      options: ['Brand & marketing', 'Social media & content', 'E-commerce & digital', 'CRM & email', 'PR & communications', 'Creative, design & imagery', 'Buying & merchandising', 'Other'],
      other: 'Other' },
    { id: 'seniority', type: 'single', section: 'Your work',
      q: 'What level are you at?',
      options: ['Intern, placement or graduate', 'Junior or executive', 'Manager', 'Senior manager', 'Head of or director', 'Founder or owner', 'Freelance or consultant'] },
    { id: 'experience', type: 'single', section: 'Your work', columns: 2,
      q: 'How long have you worked in fashion?',
      options: ['Under 1 year', '1–3 years', '4–7 years', '8–15 years', '15+ years'] },
    { id: 'segment', type: 'single', section: 'Your work',
      q: 'What kind of business do you work for?',
      help: 'If you work across several, pick the main one.',
      options: ['Luxury or designer', 'Premium', 'High street', 'Fast fashion or online pure-play', 'Independent or DTC brand', 'Agency working for fashion clients', 'Other'],
      other: 'Other' },
    { id: 'company_size', type: 'single', section: 'Your work', columns: 2,
      q: 'Roughly how many people work there?',
      options: ['1–10', '11–50', '51–250', '251–1,000', '1,000+', 'Not sure'] },

    /* ── Section 3: GenAI at work ── */
    { id: 'frequency', type: 'single', section: 'GenAI at work',
      q: 'How often do you use generative AI tools for work?',
      help: 'Think ChatGPT, Midjourney, Firefly, Copilot and similar.',
      options: ['Every day', 'A few times a week', 'About weekly', 'Monthly or less', 'Never'] },
    { id: 'tools', type: 'multi', section: 'GenAI at work', columns: 2,
      when: a => a.frequency !== 'Never',
      q: 'Which tools do you use?',
      help: 'Select all that apply.',
      options: ['ChatGPT', 'Claude', 'Google Gemini', 'Microsoft Copilot', 'Midjourney', 'Adobe Firefly / Photoshop AI', 'Canva AI', 'Runway or other video AI', 'AI built into our e-com or CRM platform', 'Other'],
      other: 'Other' },
    { id: 'tasks', type: 'multi', section: 'GenAI at work',
      when: a => a.frequency !== 'Never',
      q: 'What do you use it for?',
      help: 'Select all that apply.',
      options: ['Product descriptions & copywriting', 'Social captions & posts', 'Campaign ideas & brainstorming', 'Generating images or visuals', 'Video or motion content', 'Trend & competitor research', 'Data analysis & reporting', 'Personalisation, CRM & email', 'SEO', 'Customer service & chatbots', 'Other'],
      other: 'Other' },
    { id: 'policy', type: 'single', section: 'GenAI at work',
      q: 'Does your organisation have rules on using GenAI?',
      options: ['Yes, a formal written policy', 'Informal guidance only', 'No rules at all', 'GenAI is banned or restricted', 'Not sure'] },
    { id: 'training', type: 'single', section: 'GenAI at work',
      q: 'Have you had any training on GenAI?',
      options: ['Yes, formal training from work', 'Yes, a course I found myself', 'No, self-taught', 'No training and I don’t use it'] },
    { id: 'disclosure', type: 'single', section: 'GenAI at work',
      q: 'When AI helps make customer-facing content, is that disclosed?',
      options: ['Always', 'Sometimes', 'Never', 'We don’t use AI for customer-facing content', 'Not sure'] },

    /* ── Section 4: Your view ── */
    { id: 'attitudes', type: 'likert', section: 'Your view', ends: AGREE_ENDS,
      q: 'How much do you agree?',
      help: '1 is strongly disagree, 5 is strongly agree.',
      statements: [
        ['productivity', 'GenAI has made me more productive.'],
        ['quality', 'GenAI output is usually good enough to use with light edits.'],
        ['confidence', 'I feel confident using GenAI tools.'],
        ['authenticity', 'GenAI risks weakening brand authenticity.'],
        ['consumer_trust', 'Customers trust content less when they know AI made it.'],
        ['jobs', 'GenAI is a threat to creative jobs in fashion marketing.']
      ] },
    { id: 'barriers', type: 'multi', section: 'Your view', max: 3,
      q: 'What holds GenAI back most where you work?',
      help: 'Pick up to 3.',
      options: ['Off-brand or low-quality output', 'Copyright & IP worries', 'Data privacy & security', 'Lack of skills or training', 'Cost of tools', 'Leadership not on board', 'Ethics & customer trust', 'Inaccurate or made-up results', 'Environmental impact', 'Nothing really', 'Other'],
      other: 'Other' },
    { id: 'future', type: 'single', section: 'Your view',
      q: 'Over the next 2 years, how will your use of GenAI change?',
      options: ['Increase a lot', 'Increase a little', 'Stay about the same', 'Decrease', 'Not sure'] },
    { id: 'gap', type: 'text', section: 'Your view', optional: true,
      q: 'Is there anything about GenAI in fashion marketing that people aren’t talking about enough?',
      help: 'Opportunities, worries, things you’ve seen go right or wrong. This is the most useful bit for the research.',
      placeholder: 'Type as much or as little as you like…' },
    { id: 'contact', type: 'email', section: 'Last one', optional: true,
      q: 'Happy to chat more, or want a copy of the findings?',
      help: 'Leave your email and I’ll be in touch. It’s kept separate from your answers in the write-up and never shared.',
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
        <p class="sv-error" id="svErr" role="alert"></p>`;
    }
    return `${head(step)}
      <textarea class="sv-textarea" id="svText" maxlength="3000" placeholder="${esc(step.placeholder)}" aria-labelledby="svQ">${v}</textarea>`;
  }

  function renderIntro() {
    return `<div class="sv-hero">
        <p class="sv-eyebrow">University dissertation survey</p>
        <h1 class="sv-title" id="svQ" tabindex="-1">GenAI in<br>fashion <span>marketing</span></h1>
        <p class="sv-lede">This short survey is for my dissertation, which asks:</p>
        <blockquote class="sv-rq">How is Generative AI (GenAI) being applied to digital marketing operations within the UK fashion industry’s large enterprises?</blockquote>
        <ul class="sv-facts"><li>About 4 minutes</li><li>Anonymous</li></ul>
        <details class="sv-consent">
          <summary>How your answers are used</summary>
          <ul>
            <li>Taking part is voluntary. Nothing is sent until you finish.</li>
            <li>No names are collected. Answers are only reported anonymously.</li>
            <li>Questions? <a href="mailto:jbyrne4279@gmail.com">jbyrne4279@gmail.com</a></li>
          </ul>
        </details>
        <label class="sv-agree${A().consent ? ' is-on' : ''}" id="svAgree">
          <input type="checkbox" id="svConsent"${A().consent ? ' checked' : ''}>
          <span class="sv-agree__box" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="sv-agree__text"><b>Tick to agree</b>I’m 18 or over and happy for my anonymous answers to be used in this research.</span>
        </label>
        <button type="button" class="sv-btn" id="svStart"${A().consent ? '' : ' disabled'}>${state.history.length ? 'Pick up where I left off' : 'Start the survey'}</button>
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
        <button type="button" class="sv-btn sv-btn--ghost" id="svShare">Share the survey</button>
        <p class="sv-hint" id="svShareMsg" aria-live="polite"></p>
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
          // "Nothing really" can't sit alongside real barriers
          if (vals.includes('Nothing really') && vals.length > 1) {
            const last = e && e.target && e.target.value;
            vals = last === 'Nothing really' ? ['Nothing really'] : vals.filter(v => v !== 'Nothing really');
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
  function payload() {
    const a = A();
    const out = {
      _subject: 'GenAI survey response',
      consent: a.consent ? 'yes' : 'no',
      submitted_at: new Date().toISOString(),
      minutes_taken: state.started ? Math.round((Date.now() - state.started) / 6000) / 10 : '',
      device: window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700 ? 'mobile/tablet' : 'desktop'
    };
    STEPS.forEach(s => {
      if (s.type === 'intro') return;
      if (!isShown(s)) { out[s.id] = '(not asked)'; return; }
      const v = a[s.id];
      if (s.type === 'likert') {
        s.statements.forEach(([k]) => { out[`${s.id}_${k}`] = (v && v[k]) || ''; });
        return;
      }
      if (s.type === 'email') { if (v && v.trim()) out.email = v.trim(); return; }
      out[s.id] = Array.isArray(v) ? v.join('; ') : (v || '');
      if (s.other && a[s.id + '_other']) out[s.id + '_other'] = a[s.id + '_other'].trim();
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
  async function share() {
    const url = location.origin + location.pathname;
    const data = { title: 'GenAI in fashion marketing survey', text: 'A 4-minute anonymous survey for fashion marketers on how GenAI is really being used.', url };
    const msg = document.getElementById('svShareMsg');
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      msg.textContent = 'Link copied.';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      msg.textContent = url;
    }
  }

  /* ── Go ── */
  // A returning visitor sees the intro with a "pick up where I left off" button
  show(0);
})();
