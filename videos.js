/* ============================================================
   VIDEO LIBRARY | videos.js
   Upload (chunked, resumable per chunk), watch, search and download.
   Files are sent and stored byte-for-byte, so downloads are the
   original file in full quality.
   ============================================================ */
(() => {
  'use strict';

  const API = (document.querySelector('meta[name="video-api"]')?.content || '').trim().replace(/\/+$/, '');
  const $ = id => document.getElementById(id);
  const els = {
    setup: $('vlSetup'), search: $('vlSearch'), sort: $('vlSort'), count: $('vlCount'),
    uploadBtn: $('vlUploadBtn'), upload: $('vlUpload'), lock: $('vlLock'), pass: $('vlPass'), passBtn: $('vlPassBtn'),
    passMsg: $('vlPassMsg'), drop: $('vlDrop'), file: $('vlFile'), queue: $('vlQueue'),
    grid: $('vlGrid'), empty: $('vlEmpty'),
    player: $('vlPlayer'), video: $('vlVideo'), warn: $('vlWarn'), close: $('vlClose'),
    pTitle: $('vlPlayerTitle'), pInfo: $('vlPlayerInfo'), download: $('vlDownload'), copy: $('vlCopy'), del: $('vlDelete')
  };
  const MAX_FILE = 1024 * 1024 * 1024;
  const CHUNK = 50 * 1024 * 1024;
  const PARALLEL = 3;

  let videos = [];
  let passcode = '';
  try { passcode = sessionStorage.getItem('vlPass') || ''; } catch (e) {}
  let current = null;

  /* ── Formatting ── */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const fmtDur = s => {
    if (!(s > 0)) return '';
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  };
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const vUrl = (key, dl) => `${API}/v/${encodeURIComponent(key)}${dl ? '?download=1' : ''}`;
  const tUrl = key => `${API}/t/${encodeURIComponent(key)}`;

  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (opts.auth) headers['X-Passcode'] = passcode;
    if (opts.json) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    const res = await fetch(API + path, { method: opts.method || 'GET', headers, body: opts.body, signal: opts.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
    return data;
  }

  /* ── Library ── */
  async function load() {
    if (!API) { els.setup.hidden = false; render(); return; }
    els.count.textContent = 'Loading videos…';
    try {
      videos = (await api('/api/videos')).videos || [];
      render();
      const deep = new URLSearchParams(location.search).get('v');
      if (deep && !current) { const v = videos.find(x => x.key === deep); if (v) openPlayer(v); }
    } catch (e) {
      els.count.textContent = 'Couldn’t load the library: ' + e.message;
    }
  }

  function filtered() {
    const q = els.search.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let list = videos.filter(v => {
      const hay = (v.title + ' ' + v.name + ' ' + fmtDate(v.uploadedAt)).toLowerCase();
      return words.every(w => hay.includes(w));
    });
    const by = {
      new: (a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''),
      old: (a, b) => (a.uploadedAt || '').localeCompare(b.uploadedAt || ''),
      az: (a, b) => a.title.localeCompare(b.title, 'en', { numeric: true, sensitivity: 'base' }),
      big: (a, b) => b.size - a.size,
      long: (a, b) => (b.duration || 0) - (a.duration || 0)
    }[els.sort.value];
    return list.sort(by);
  }

  function render() {
    const list = filtered();
    const total = videos.reduce((s, v) => s + v.size, 0);
    els.count.textContent = !API ? '' : videos.length
      ? (list.length === videos.length ? `${videos.length} video${videos.length > 1 ? 's' : ''} · ${fmtSize(total)}` : `${list.length} of ${videos.length} videos match`)
      : '';
    els.grid.innerHTML = list.map(v => `
      <button type="button" class="vl-card" data-key="${esc(v.key)}">
        <span class="vl-card__thumb">
          ${v.thumb ? `<img src="${tUrl(v.key)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <span class="vl-card__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
          ${v.duration ? `<span class="vl-card__dur">${fmtDur(v.duration)}</span>` : ''}
        </span>
        <span class="vl-card__title">${esc(v.title)}</span>
        <span class="vl-card__meta">${fmtSize(v.size)} · ${fmtDate(v.uploadedAt)}${v.dims ? ' · ' + esc(v.dims.split('x')[1]) + 'p' : ''}</span>
      </button>`).join('');
    els.empty.hidden = list.length > 0 || !API;
    els.empty.textContent = videos.length ? 'No videos match your search.' : 'No videos yet. Upload the first one.';
  }

  els.search.addEventListener('input', render);
  els.sort.addEventListener('change', render);
  els.grid.addEventListener('click', e => {
    const card = e.target.closest('.vl-card');
    if (card) openPlayer(videos.find(v => v.key === card.dataset.key));
  });

  /* ── Player ── */
  function openPlayer(v) {
    if (!v) return;
    current = v;
    els.warn.hidden = true;
    els.video.src = vUrl(v.key);
    els.pTitle.textContent = v.title;
    els.pInfo.textContent = [v.name, fmtSize(v.size), fmtDur(v.duration), v.dims, 'uploaded ' + fmtDate(v.uploadedAt)].filter(Boolean).join(' · ');
    els.download.href = vUrl(v.key, true);
    els.download.setAttribute('download', v.name);
    els.player.hidden = false;
    document.body.classList.add('vl-lock');
    history.replaceState(null, '', '?v=' + encodeURIComponent(v.key));
    els.close.focus();
  }
  function closePlayer() {
    els.video.pause();
    els.video.removeAttribute('src');
    els.video.load();
    els.player.hidden = true;
    document.body.classList.remove('vl-lock');
    current = null;
    history.replaceState(null, '', location.pathname);
  }
  els.video.addEventListener('error', () => { if (current) els.warn.hidden = false; });
  els.close.addEventListener('click', closePlayer);
  els.player.addEventListener('click', e => { if (e.target === els.player) closePlayer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.player.hidden) closePlayer(); });
  els.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); els.copy.textContent = 'Link copied'; }
    catch (e) { els.copy.textContent = 'Copy failed'; }
    setTimeout(() => { els.copy.textContent = 'Copy link'; }, 1600);
  });
  els.del.addEventListener('click', async () => {
    if (!current) return;
    if (!passcode) { const p = prompt('Enter the upload passcode to delete this video'); if (!p) return; passcode = p; }
    if (!confirm(`Delete “${current.title}” for everyone? This can’t be undone.`)) return;
    try {
      await api('/api/videos?key=' + encodeURIComponent(current.key), { method: 'DELETE', auth: true });
      videos = videos.filter(v => v.key !== current.key);
      closePlayer(); render();
    } catch (e) {
      if (e.status === 401) { passcode = ''; try { sessionStorage.removeItem('vlPass'); } catch (x) {} }
      alert('Couldn’t delete: ' + e.message);
    }
  });

  /* ── Upload: passcode ── */
  els.uploadBtn.addEventListener('click', () => {
    els.upload.hidden = !els.upload.hidden;
    if (!els.upload.hidden) {
      if (passcode) unlock(true); else els.pass.focus();
      els.upload.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  async function unlock(silent) {
    if (!API) { els.passMsg.textContent = 'This page isn’t connected to storage yet.'; return; }
    const p = silent ? passcode : els.pass.value;
    if (!p) return;
    els.passBtn.disabled = true;
    try {
      passcode = p;
      await api('/api/check', { method: 'POST', auth: true });
      try { sessionStorage.setItem('vlPass', p); } catch (e) {}
      els.lock.hidden = true;
      els.drop.hidden = false;
    } catch (e) {
      passcode = '';
      try { sessionStorage.removeItem('vlPass'); } catch (x) {}
      if (!silent) els.passMsg.textContent = e.status === 401 ? 'That passcode isn’t right.' : e.message;
    } finally { els.passBtn.disabled = false; }
  }
  els.passBtn.addEventListener('click', () => unlock(false));
  els.pass.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(false); });

  /* ── Upload: files ── */
  els.file.addEventListener('change', () => { queueFiles(els.file.files); els.file.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove('is-over'); }));
  els.drop.addEventListener('drop', e => queueFiles(e.dataTransfer.files));

  const isVideo = f => /^video\//.test(f.type) || /\.(mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp|ogv)$/i.test(f.name);
  let running = Promise.resolve();

  function queueFiles(fileList) {
    [...fileList].forEach(file => {
      const li = document.createElement('li');
      li.className = 'vl-job';
      const base = file.name.replace(/\.[^.]+$/, '');
      li.innerHTML = `<div class="vl-job__top"><input class="vl-job__title" value="${esc(base)}" aria-label="Title for ${esc(file.name)}"><span class="vl-job__size">${fmtSize(file.size)}</span></div>
        <div class="vl-job__bar"><i></i></div><p class="vl-job__msg">Waiting…</p>`;
      els.queue.prepend(li);
      const msg = li.querySelector('.vl-job__msg');
      if (!isVideo(file)) { li.classList.add('is-error'); msg.textContent = 'Not a video file, skipped.'; return; }
      if (file.size > MAX_FILE) { li.classList.add('is-error'); msg.textContent = 'Over 1 GB, skipped.'; return; }
      running = running.then(() => uploadOne(file, li)).catch(() => {});
    });
  }

  // Reads duration, size and a thumbnail frame from the local file (nothing is altered)
  function probe(file) {
    return new Promise(resolve => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      let done = false;
      const finish = (info) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(info); };
      v.muted = true; v.preload = 'metadata'; v.playsInline = true;
      v.onloadedmetadata = () => {
        const d = v.duration;
        v.currentTime = isFinite(d) && d > 0 ? Math.min(Math.max(1, d * 0.1), Math.max(0, d - 0.1)) : 0.5;
      };
      v.onseeked = () => {
        const info = { duration: isFinite(v.duration) ? v.duration : null, width: v.videoWidth, height: v.videoHeight, thumb: null };
        if (!v.videoWidth) return finish(info);
        const w = Math.min(640, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        c.toBlob(b => { info.thumb = b; finish(info); }, 'image/jpeg', 0.82);
      };
      v.onerror = () => finish({});
      setTimeout(() => finish({}), 15000);
      v.src = url;
    });
  }

  async function uploadOne(file, li) {
    const bar = li.querySelector('.vl-job__bar i'), msg = li.querySelector('.vl-job__msg'), title = li.querySelector('.vl-job__title');
    li.classList.add('is-active');
    msg.textContent = 'Preparing…';
    const info = await probe(file);
    let start;
    try {
      start = await api('/api/uploads', { method: 'POST', auth: true, json: {
        name: file.name, size: file.size, type: file.type, title: title.value.trim() || file.name,
        duration: info.duration && isFinite(info.duration) ? Math.round(info.duration * 10) / 10 : null,
        width: info.width || null, height: info.height || null
      } });
    } catch (e) { li.classList.add('is-error'); msg.textContent = 'Couldn’t start: ' + e.message; return; }
    title.disabled = true;

    const partSize = Math.min(CHUNK, start.partSize || CHUNK);
    const total = Math.ceil(file.size / partSize);
    const loaded = new Array(total).fill(0);
    const parts = [];
    const t0 = Date.now();
    const show = () => {
      const sent = loaded.reduce((a, b) => a + b, 0);
      const pct = sent / file.size * 100;
      bar.style.width = pct.toFixed(1) + '%';
      const secs = (Date.now() - t0) / 1000, rate = sent / Math.max(secs, 0.5);
      const left = rate > 0 ? (file.size - sent) / rate : 0;
      msg.textContent = `Uploading ${pct.toFixed(0)}% · ${fmtSize(sent)} of ${fmtSize(file.size)}` + (secs > 3 && left > 1 ? ` · about ${fmtDur(left)} left` : '');
    };
    const sendPart = (n) => new Promise((resolve, reject) => {
      const blob = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API}/api/uploads/${encodeURIComponent(start.uploadId)}/${n}?key=${encodeURIComponent(start.key)}`);
      xhr.setRequestHeader('X-Passcode', passcode);
      xhr.upload.onprogress = e => { loaded[n - 1] = e.loaded; show(); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { loaded[n - 1] = blob.size; show(); resolve(JSON.parse(xhr.responseText)); }
        else reject(new Error((JSON.parse(xhr.responseText || '{}').error) || 'Upload failed (' + xhr.status + ')'));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(blob);
    });
    const withRetry = async (n) => {
      for (let attempt = 1; ; attempt++) {
        try { return await sendPart(n); }
        catch (e) {
          loaded[n - 1] = 0;
          if (attempt >= 4) throw e;
          msg.textContent = `Connection hiccup, retrying (${attempt}/3)…`;
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
    };

    try {
      let next = 1;
      const worker = async () => { while (next <= total) { const n = next++; parts.push(await withRetry(n)); } };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker));
      msg.textContent = 'Finishing…';
      parts.sort((a, b) => a.partNumber - b.partNumber);
      const done = await api(`/api/uploads/${encodeURIComponent(start.uploadId)}/complete?key=${encodeURIComponent(start.key)}`, { method: 'POST', auth: true, json: { parts } });
      if (info.thumb) {
        await fetch(`${API}/api/thumbs?key=${encodeURIComponent(start.key)}`, { method: 'PUT', headers: { 'X-Passcode': passcode, 'Content-Type': 'image/jpeg' }, body: info.thumb }).catch(() => {});
      }
      bar.style.width = '100%';
      li.classList.remove('is-active'); li.classList.add('is-done');
      msg.textContent = `Uploaded · ${fmtSize(file.size)} stored as the original file` + (info.width ? '' : ' (this format may not preview in every browser, but downloads are unaffected)');
      done.video.thumb = !!info.thumb;
      videos.unshift(done.video);
      render();
    } catch (e) {
      li.classList.remove('is-active'); li.classList.add('is-error');
      msg.textContent = 'Upload failed: ' + e.message;
      api(`/api/uploads/${encodeURIComponent(start.uploadId)}?key=${encodeURIComponent(start.key)}`, { method: 'DELETE', auth: true }).catch(() => {});
    }
  }

  window.addEventListener('beforeunload', e => {
    if (els.queue.querySelector('.vl-job.is-active')) { e.preventDefault(); e.returnValue = ''; }
  });

  load();
})();
