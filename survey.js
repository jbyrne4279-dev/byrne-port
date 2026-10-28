/* ============================================================
   GENAI SURVEY | survey.js
   One question per screen. Questions live in STEPS below: edit
   wording or options there and the page follows.
   ============================================================ */

'use strict';

(function initSurvey() {
  const ENDPOINT = (document.querySelector('meta[name="survey-endpoint"]') || {}).content || '';
  const STORE_KEY = 'jb-aifashion-public-v3';
  // Bump with each change so responses show which version of the page sent them
  const SURVEY_VERSION = 'public-3';

  const AGREE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  // "scale" steps are one-line Likert questions: labels run from the low end
  // to the high end and the answer is stored as 1..labels.length.
  const STEPS = [
    { id: 'intro', type: 'intro' },

    /* ── About you ── */
    { id: 'age', type: 'single', section: 'About you', columns: 2,
      q: 'How old are you?',
      options: ['18–24', '25–34', '35–44', '45–54', '55+'] },

    /* ── Using GenAI ── */
    { id: 'first_use', type: 'single', section: 'Using GenAI', columns: 2,
      q: 'When did you first use a GenAI tool (e.g. ChatGPT)?',
      options: ['Before 2022', '2022', '2023', '2024', '2025 or later', 'Never'] },
    { id: 'why_try', type: 'multi', section: 'Using GenAI',
      q: 'What first made you try GenAI?',
      help: 'Select all that apply.',
      options: ['Easy to use', 'Free', 'Recommended by someone', 'Needed it for uni or work', 'Curiosity', 'Saw it online or in the news'] },
    { id: 'ease', type: 'scale', section: 'Using GenAI',
      q: 'How easy is GenAI to use?',
      labels: ['Very difficult', 'Difficult', 'Neutral', 'Easy', 'Very easy'] },
    { id: 'overhyped', type: 'scale', section: 'Using GenAI',
      q: '“GenAI is overhyped.”', help: 'How much do you agree?',
      labels: AGREE },
    { id: 'how_often', type: 'single', section: 'Using GenAI', columns: 2,
      q: 'How often do you use GenAI now?',
      options: ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never'] },

    /* ── AI in fashion ── */
    { id: 'noticed', type: 'single', section: 'AI in fashion', columns: 2,
      q: 'Have you noticed fashion brands using AI-generated images or content?',
      options: ['Yes, often', 'Yes, sometimes', 'No', 'Not sure'] },
    { id: 'feel', type: 'scale', section: 'AI in fashion',
      q: 'How do you feel about fashion brands using AI-generated models or images?',
      labels: ['Very negative', 'Negative', 'Neutral', 'Positive', 'Very positive'] },
    { id: 'trust', type: 'scale', section: 'AI in fashion',
      q: 'If you found out a fashion ad was AI-generated, how would you trust the brand?',
      labels: ['Much less', 'A little less', 'No change', 'A little more', 'Much more'] },
    { id: 'matters', type: 'single', section: 'AI in fashion', columns: 2,
      q: 'What matters more to you in fashion images?',
      options: ['Whether it’s real or AI', 'How good it looks', 'Both equally', 'Neither'] },
    { id: 'less_likely', type: 'scale', section: 'AI in fashion',
      q: '“I would be less likely to buy from a brand that uses AI-generated models.”', help: 'How much do you agree?',
      labels: AGREE },
    { id: 'disclose', type: 'single', section: 'AI in fashion',
      q: 'Should fashion brands have to say when content is AI-generated?',
      options: ['Yes', 'No', 'Not sure'] },

    /* ── Skills and careers ── */
    { id: 'training', type: 'single', section: 'Skills and careers',
      q: 'Have you had any training in using GenAI?',
      options: ['Yes, a lot', 'Yes, a little', 'No'] },
    { id: 'confidence', type: 'scale', section: 'Skills and careers',
      q: 'How confident are you using GenAI for marketing tasks?',
      labels: ['Not confident', 'Slightly confident', 'Fairly confident', 'Very confident'] },
    { id: 'career', type: 'single', section: 'Skills and careers',
      q: 'Do you expect to use GenAI in your future career?',
      options: ['Yes', 'Maybe', 'No'] },
    { id: 'jobs_worry', type: 'scale', section: 'Skills and careers',
      q: 'How worried are you that GenAI could reduce jobs in fashion marketing?',
      labels: ['Not worried', 'Slightly worried', 'Quite worried', 'Very worried'] },

    /* ── In your words ── */
    { id: 'thoughts', type: 'text', section: 'In your words', optional: true,
      q: 'Any other thoughts on AI in fashion marketing?',
      help: 'A sentence is plenty. This may be quoted anonymously.',
      placeholder: 'Type as much or as little as you like…' }
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

  function renderScale(step) {
    const v = A()[step.id];
    const n = step.labels.length;
    const pts = step.labels.map((label, i) =>
      `<label><input type="radio" name="${step.id}" value="${i + 1}"${v === i + 1 ? ' checked' : ''} aria-label="${esc(label)}"><span>${i + 1}</span><em>${esc(label)}</em></label>`
    ).join('');
    return `${head(step)}
      <div class="sv-scale sv-scale--words" style="--n:${n}" role="radiogroup" aria-labelledby="svQ">${pts}</div>
      <p class="sv-hint">Tip: press <kbd>1</kbd>–<kbd>${n}</kbd> to choose.</p>`;
  }

  function renderImagePick(step) {
    const current = A()[step.id];
    const cards = step.images.map((im, i) => {
      const k = keyFor(i);
      const on = current === k ? ' is-selected' : '';
      return `<button type="button" class="sv-img${on}" data-pick="${k}" aria-pressed="${current === k}">
          <span class="sv-img__frame"><img src="${esc(im.src)}" alt="${esc(im.alt || ('Option ' + k))}" loading="lazy" draggable="false"></span>
          <span class="sv-img__tag"><span class="sv-img__key">${k}</span>${TICK}</span>
        </button>`;
    }).join('');
    const unsure = step.allowUnsure
      ? `<button type="button" class="sv-img-unsure${current === 'Not sure' ? ' is-selected' : ''}" data-pick="Not sure" aria-pressed="${current === 'Not sure'}">I honestly can’t tell</button>`
      : '';
    return `${head(step)}
      <div class="sv-imggrid" role="group" aria-labelledby="svQ">${cards}</div>
      ${unsure}`;
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
        <h1 class="sv-title" id="svQ" tabindex="-1"><span class="sv-title__ai">AI in<span class="sv-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span><span class="sv-title__line">Fashion <span>Marketing</span></span></h1>
        <p class="sv-lede">A short, anonymous survey for my dissertation on GenAI and fashion marketing. It asks:</p>
        <blockquote class="sv-rq">How do people start using GenAI, and how do they feel when fashion brands use it?</blockquote>
        <ul class="sv-facts"><li>About 3 mins</li><li>Anonymous</li><li>Spin to win £50</li></ul>
        <p class="sv-incentive"><b>Prize incentive</b>Everyone who finishes gets one spin of a prize wheel with a 1 in 1,000 chance of winning £50. Your answers make no difference to your chance of winning.</p>
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
            <li>Prize incentive: finishing the survey gives you one spin of a prize wheel, with a 1 in 1,000 chance of winning £50. The prize is paid by the researcher.</li>
            <li>Your answers have no effect on the result, and a winning code is not linked to your answers.</li>
            <li>The draw is free, one spin per person, open to UK residents aged 18 and over. Winners claim by email within 30 days and are paid by bank transfer.</li>
            <li>Questions? <a href="mailto:jbyrne4279@gmail.com">jbyrne4279@gmail.com</a></li>
          </ul>
        </details>
      </div>`;
  }

  function renderEnd(kind, data) {
    const copy = kind === 'screenout'
      ? ['Thanks for stopping by', 'This study focuses on the UK public, so there’s nothing more to fill in here. Thanks for your interest all the same.']
      : ['Thank you', 'Your answers are in and will help shape the findings. Sharing the link with a few friends would mean a lot.'];
    const score = (kind === 'done' && data && data.total)
      ? `<div class="sv-end__score"><span class="sv-end__score-num">${data.correct} / ${data.total}</span><span class="sv-end__score-label">AI images spotted correctly${data.skipped ? ` · ${data.skipped} you couldn’t call` : ''}</span></div>`
      : '';
    return `<div class="sv-end">
        <div class="sv-end__mark"><svg width="30" height="30" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <p class="sv-eyebrow">${kind === 'screenout' ? 'All done' : 'Response received'}</p>
        <h1 class="sv-q" id="svQ" tabindex="-1">${copy[0]}</h1>
        <p class="sv-lede">${copy[1]}</p>
        ${score}
        ${kind === 'done' ? renderWheel() : ''}
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
    else if (step.type === 'scale') html = renderScale(step);
    else if (step.type === 'imagepick') html = renderImagePick(step);
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
      bindWheel();
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

    if (step.type === 'scale') {
      stage.querySelectorAll(`input[name="${step.id}"]`).forEach(input => {
        input.addEventListener('change', () => {
          state.answers[step.id] = Number(input.value);
          save();
          updateChrome(step);
        });
        input.addEventListener('click', e => {
          if (e.detail === 0) return;
          setTimeout(() => { if (isAnswered(step)) next(); }, reduceMotion ? 120 : 280);
        });
      });
      return;
    }

    if (step.type === 'imagepick') {
      const btns = [...stage.querySelectorAll('[data-pick]')];
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          const pick = btn.getAttribute('data-pick');
          state.answers[step.id] = pick;
          btns.forEach(b => {
            const on = b === btn;
            b.classList.toggle('is-selected', on);
            b.setAttribute('aria-pressed', on);
          });
          save();
          updateChrome(step);
          setTimeout(() => { if (isAnswered(step)) next(); }, reduceMotion ? 120 : 320);
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

  function showEnd(kind, data) {
    const end = { type: 'end', kind };
    stage.innerHTML = renderEnd(kind, data);
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
    if (typing) return;
    if (step.type === 'scale') {
      const box = stage.querySelectorAll(`input[name="${step.id}"]`)[Number(e.key) - 1];
      if (!box) return;
      e.preventDefault();
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      setTimeout(() => { if (isAnswered(step)) next(); }, reduceMotion ? 120 : 280);
      return;
    }
    if (step.type !== 'single' && step.type !== 'multi') return;
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

  // Tally correct guesses across the "Spot the AI" rounds.
  function spotScore() {
    let correct = 0, total = 0, skipped = 0;
    STEPS.forEach(s => {
      if (s.type !== 'imagepick' || !isShown(s)) return;
      total++;
      const v = A()[s.id];
      if (!v || v === 'Not sure') { skipped++; return; }
      const idx = v.charCodeAt(0) - 65;
      if (s.images[idx] && s.images[idx].ai) correct++;
    });
    return { correct, total, skipped };
  }

  function payload() {
    const a = A();
    const sc = spotScore();
    const out = {
      _subject: 'AI-in-fashion survey response',
      'Survey version': SURVEY_VERSION,
      'Consent given': a.consent ? 'Yes' : 'No',
      'Submitted at': new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      'Time taken': state.started ? `${Math.max(1, Math.round((Date.now() - state.started) / 1000))} seconds` : '',
      'Device': window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700 ? 'Mobile or tablet' : 'Desktop'
    };
    if (sc.total) out['Spot-the-AI score'] = `${sc.correct}/${sc.total}` + (sc.skipped ? ` (${sc.skipped} skipped)` : '');
    let num = 0;
    STEPS.forEach(s => {
      if (s.type === 'intro') return;
      const v = a[s.id];
      if (s.type === 'scale') {
        out[`${++num}. ${s.q}`] = v ? `${s.labels[v - 1]} (${v}/${s.labels.length})` : '';
        return;
      }
      if (s.type === 'likert') {
        s.statements.forEach(([k, text]) => {
          out[`Agree? ${text}`] = !isShown(s) ? '(not asked)' : (v && v[k]) ? `${AGREE_LABELS[v[k]]} (${v[k]}/5)` : '';
        });
        return;
      }
      if (s.type === 'email') { if (v && v.trim()) out['Email for Teams interview'] = v.trim(); return; }
      if (s.type === 'imagepick') {
        if (!isShown(s)) { out[s.q] = '(not asked)'; return; }
        const aiIdx = s.images.findIndex(im => im.ai);
        if (!v) { out[s.q] = '(skipped)'; return; }
        if (v === 'Not sure') { out[s.q] = 'Couldn’t tell'; out[`${s.q} [result]`] = 'No guess'; out[`${s.q} [AI was]`] = keyFor(aiIdx); return; }
        const idx = v.charCodeAt(0) - 65;
        out[s.q] = `Picked ${v}`;
        out[`${s.q} [result]`] = idx === aiIdx ? 'Correct' : 'Wrong';
        out[`${s.q} [AI was]`] = keyFor(aiIdx);
        return;
      }
      if (!isShown(s)) { out[s.q] = '(not asked)'; return; }
      const title = `${++num}. ${s.q}`;
      out[title] = Array.isArray(v) ? v.join('; ') : (v || '');
      if (s.other && a[s.id + '_other']) out[`${title} (their own answer)`] = a[s.id + '_other'].trim();
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
      const sc = spotScore();
      clearSaved();
      state = { answers: {}, history: [], idx: 0, started: null };
      showEnd('done', sc);
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

  /* ── Prize wheel (end screen) ── */
  // One spin per device. The odds are decided here, before the wheel moves:
  // 1 in 1,000 wins. The £50 slice is drawn small so the wheel doesn't
  // suggest better odds than that.
  const SPIN_KEY = 'jb-survey-spin-v1';
  const WIN_ODDS = 0.001;
  const WIN_SLICE = 12;                       // degrees, centred on the top of the wheel
  const LOSE_SLICES = 6;

  function spinRecord() {
    try { return JSON.parse(localStorage.getItem(SPIN_KEY) || 'null'); } catch (e) { return null; }
  }

  function wheelSvg() {
    const pt = (deg, r) => {
      const a = deg * Math.PI / 180;
      return `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    };
    const slice = (a1, a2, cls) =>
      `<path class="${cls}" d="M0 0 L${pt(a1, 96)} A96 96 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${pt(a2, 96)} Z"/>`;
    const label = (mid, text, cls) =>
      `<text class="${cls}" transform="rotate(${mid}) translate(0 -62) rotate(90)" text-anchor="middle" dominant-baseline="central">${text}</text>`;
    const half = WIN_SLICE / 2;
    const step = (360 - WIN_SLICE) / LOSE_SLICES;
    let paths = slice(-half, half, 'sv-wheel__win');
    let labels = label(0, '£50', 'sv-wheel__win-text');
    for (let i = 0; i < LOSE_SLICES; i++) {
      const a1 = half + i * step;
      paths += slice(a1, a1 + step, i % 2 ? 'sv-wheel__b' : 'sv-wheel__a');
      labels += label(a1 + step / 2, 'No prize', 'sv-wheel__text');
    }
    return `<svg class="sv-wheel__disc" id="svDisc" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="99" class="sv-wheel__rim"/>${paths}${labels}<circle r="14" class="sv-wheel__hub"/></svg>`;
  }

  function wheelResult(rec) {
    if (!rec) return '';
    if (!rec.won) return `<p class="sv-wheel__msg">Not this time. Thanks so much for taking part.</p>`;
    const mail = `mailto:jbyrne4279@gmail.com?subject=${encodeURIComponent('Survey prize claim ' + rec.code)}&body=${encodeURIComponent('Hi Joe, I won the £50 on the survey wheel. My code is ' + rec.code + '.')}`;
    return `<div class="sv-wheel__won">
        <p class="sv-wheel__msg"><b>You won £50!</b> Screenshot this code and email it to claim.</p>
        <p class="sv-wheel__code">${esc(rec.code)}</p>
        <a class="sv-btn" href="${mail}">Email my code to claim</a>
      </div>`;
  }

  function renderWheel() {
    const rec = spinRecord();
    return `<div class="sv-wheel" id="svWheel">
        <p class="sv-eyebrow">Prize wheel</p>
        <h2 class="sv-wheel__title">Spin for a chance to win £50</h2>
        <div class="sv-wheel__frame${rec ? ' is-done' : ''}">
          <span class="sv-wheel__pointer" aria-hidden="true"></span>
          ${wheelSvg()}
        </div>
        <div id="svWheelOut" aria-live="polite">${rec ? wheelResult(rec) : '<button type="button" class="sv-btn" id="svSpin">Spin the wheel</button>'}</div>
        <p class="sv-wheel__terms">Free prize draw, no purchase needed. One spin per person. Each spin has a 1 in 1,000 chance of winning £50. Winners claim by emailing their code within 30 days and are paid by bank transfer. UK residents aged 18 and over.</p>
      </div>`;
  }

  function claimCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.random() * 256; });
    return 'JB-' + [...bytes].map(b => abc[b % abc.length]).join('');
  }

  function bindWheel() {
    const btn = document.getElementById('svSpin');
    const disc = document.getElementById('svDisc');
    if (!btn || !disc) return;
    btn.addEventListener('click', () => {
      if (spinRecord()) return;
      btn.disabled = true;
      btn.textContent = 'Spinning…';
      const won = Math.random() < WIN_ODDS;
      const rec = { won, at: Date.now() };
      if (won) rec.code = claimCode();
      try { localStorage.setItem(SPIN_KEY, JSON.stringify(rec)); } catch (e) {}
      if (won && ENDPOINT) {
        // Log the code so a claim can be checked against it
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ _subject: 'Survey prize wheel: WINNER', 'Winning code': rec.code, 'Won at': new Date().toLocaleString('en-GB') })
        }).catch(() => {});
      }

      // Where the pointer lands, in degrees clockwise from the top of the wheel
      const half = WIN_SLICE / 2;
      const land = won
        ? (Math.random() - 0.5) * (WIN_SLICE - 4)
        : half + 4 + Math.random() * (360 - WIN_SLICE - 8);
      const turns = reduceMotion ? 0 : 6;
      const deg = turns * 360 + (360 - land);
      const ms = reduceMotion ? 0 : 5200;
      disc.style.transition = `transform ${ms}ms cubic-bezier(.12,.7,.15,1)`;
      disc.style.transform = `rotate(${deg}deg)`;

      setTimeout(() => {
        document.getElementById('svWheelOut').innerHTML = wheelResult(rec);
        disc.closest('.sv-wheel__frame').classList.add('is-done');
        if (won) [0.2, 0.5, 0.8].forEach((f, i) => setTimeout(() => confetti.burst(innerWidth * f, innerHeight * 0.4, 80, 12), i * 200));
      }, ms + 150);
    });
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

/* ── Red mist rising from the bottom (same effect as the homepage hero) ── */
(function initMist() {
  const canvas = document.getElementById('svMist');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const PALETTE = ['216,20,40', '140,10,24'];
  function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const COUNT = Math.round(Math.max(18, canvas.height / 22));
  function Particle(initial) {
    this.reset = function (init) {
      this.x = Math.random() * canvas.width;
      this.y = init ? Math.random() * canvas.height : canvas.height + 60;
      this.radius = 80 + Math.random() * 180;
      this.opacity = 0;
      this.maxOpacity = 0.14 + Math.random() * 0.16;
      this.vy = -(0.15 + Math.random() * 0.4);
      this.vx = (Math.random() - 0.5) * 0.25;
      this.phase = Math.random() * Math.PI * 2;
      this.growing = true;
      this.color = Math.random() > 0.35 ? PALETTE[0] : PALETTE[1];
    };
    this.reset(initial);
  }
  const particles = Array.from({ length: COUNT }, () => new Particle(true));
  ctx.globalCompositeOperation = 'lighter';

  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.phase) * 0.18;
      p.phase += 0.004;
      if (p.growing) { p.opacity = Math.min(p.opacity + 0.003, p.maxOpacity); if (p.opacity >= p.maxOpacity) p.growing = false; }
      else p.opacity -= 0.0008;
      if (p.opacity <= 0 || p.y < -p.radius * 2) p.reset(false);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      g.addColorStop(0, `rgba(${p.color},${p.opacity})`);
      g.addColorStop(0.45, `rgba(${p.color},${p.opacity * 0.55})`);
      g.addColorStop(1, `rgba(${p.color},0)`);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    });
    requestAnimationFrame(loop);
  })();
})();
