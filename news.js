/* ============================================================
   news.js — renders The Brief from news-data.json
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var elUpdated = $('nwUpdated');
  var elState = $('nwState');
  var elStateText = $('nwStateText');
  var elRefresh = $('nwRefresh');

  var SECTIONS = [
    { key: 'breaking', container: 'nwBreaking', section: 'breaking' },
    { key: 'ai', container: 'nwAi', section: 'ai' },
    { key: 'fashion', container: 'nwFashion', section: 'fashion' },
    { key: 'markets', container: 'nwMarkets', section: 'markets' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var s = Math.max(0, (Date.now() - then) / 1000);
    if (s < 90) return 'just now';
    var m = s / 60; if (m < 60) return Math.round(m) + 'm ago';
    var h = m / 60; if (h < 24) return Math.round(h) + 'h ago';
    var d = h / 24; if (d < 7) return Math.round(d) + 'd ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function initial(src) { return (src || '?').trim().charAt(0).toUpperCase(); }

  function mediaHTML(item, phClass) {
    if (item.image) {
      return '<img src="' + esc(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
        'onerror="this.parentNode.innerHTML=&quot;<div class=\\&quot;' + phClass + '\\&quot;>' + esc(initial(item.source)) + '</div>&quot;">';
    }
    return '<div class="' + phClass + '">' + esc(initial(item.source)) + '</div>';
  }

  function cardHTML(item) {
    var meta = '<span class="nw-src">' + esc(item.source || hostOf(item.url)) + '</span>' +
      (item.published ? '<span class="nw-time">' + esc(timeAgo(item.published)) + '</span>' : '');
    return '<a class="nw-card" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="nw-card__media"><span class="nw-card__badge">' + esc(item.source || hostOf(item.url)) + '</span>' +
      mediaHTML(item, 'nw-card__ph') + '</div>' +
      '<div class="nw-card__body"><h3 class="nw-card__title">' + esc(item.title) + '</h3>' +
      '<div class="nw-card__meta">' + meta + '</div></div></a>';
  }

  function miniHTML(item) {
    return '<a class="nw-mini" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="nw-mini__media">' + mediaHTML(item, 'nw-mini__ph') + '</div>' +
      '<div class="nw-mini__body"><h3 class="nw-mini__title">' + esc(item.title) + '</h3>' +
      '<div class="nw-mini__meta">' + esc(item.source || hostOf(item.url)) +
      (item.published ? ' · ' + esc(timeAgo(item.published)) : '') + '</div></div></a>';
  }

  function renderBreaking(items) {
    var host = $('nwBreaking');
    if (!items.length) { return false; }
    var lead = items[0];
    var rest = items.slice(1, 6);
    var html = '<a class="nw-card nw-lead" href="' + esc(lead.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="nw-card__media"><span class="nw-card__badge">' + esc(lead.source || hostOf(lead.url)) + '</span>' +
      mediaHTML(lead, 'nw-card__ph') + '</div>' +
      '<div class="nw-card__body"><h3 class="nw-card__title">' + esc(lead.title) + '</h3>' +
      '<div class="nw-card__meta"><span>' + esc(lead.source || hostOf(lead.url)) + '</span>' +
      (lead.published ? '<span class="nw-time">' + esc(timeAgo(lead.published)) + '</span>' : '') +
      '</div></div></a>' +
      '<div class="nw-breaking__list">' + rest.map(miniHTML).join('') + '</div>';
    host.innerHTML = html;
    return true;
  }

  function renderTicker(items) {
    var wrap = $('nwTicker');
    var track = $('nwTickerTrack');
    if (!items.length) { wrap.hidden = true; return; }
    var links = items.slice(0, 10).map(function (i) {
      return '<a href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer">' + esc(i.title) + '</a>';
    }).join('');
    track.innerHTML = links + links; // duplicate for seamless loop
    wrap.hidden = false;
  }

  function showSection(topic) {
    var sec = document.querySelector('.nw-section[data-topic="' + topic + '"]');
    if (sec) sec.hidden = false;
  }

  function render(data) {
    var buckets = (data && data.buckets) || {};
    var any = 0;

    if (renderBreaking(buckets.breaking || [])) { showSection('breaking'); any += (buckets.breaking || []).length; }
    renderTicker(buckets.breaking || []);

    [['ai', 'nwAi'], ['fashion', 'nwFashion'], ['markets', 'nwMarkets']].forEach(function (pair) {
      var items = buckets[pair[0]] || [];
      if (!items.length) return;
      $(pair[1]).innerHTML = items.map(cardHTML).join('');
      showSection(pair[0]);
      any += items.length;
    });

    if (data && data.generatedAt) {
      elUpdated.textContent = 'Updated ' + timeAgo(data.generatedAt);
    } else {
      elUpdated.textContent = any ? 'Latest headlines' : 'First briefing is compiling';
    }

    if (any) {
      elState.hidden = true;
    } else {
      elState.hidden = false;
      $('nwState').querySelector('.nw-spinner').style.display = 'none';
      elStateText.innerHTML = "Today&rsquo;s briefing is being compiled &mdash; check back shortly.";
    }
  }

  // Always read the latest committed data straight from GitHub (updated
  // daily by the Action), so the page stays current with no redeploy.
  // Falls back to the locally deployed copy if GitHub can't be reached.
  var RAW = 'https://raw.githubusercontent.com/jbyrne4279-dev/byrne-port/main/news-data.json';

  function fetchData() {
    return fetch(RAW + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('raw ' + r.status); return r.json(); })
      .catch(function () {
        return fetch('news-data.json?t=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('local ' + r.status); return r.json(); });
      });
  }

  function load() {
    elRefresh.classList.add('is-spin');
    fetchData()
      .then(render)
      .catch(function (e) {
        elState.hidden = false;
        elState.querySelector('.nw-spinner').style.display = 'none';
        elStateText.textContent = 'Could not load the briefing. Please try again.';
        elUpdated.textContent = 'Offline';
        console.error(e);
      })
      .finally(function () { setTimeout(function () { elRefresh.classList.remove('is-spin'); }, 600); });
  }

  elRefresh.addEventListener('click', load);
  load();
})();
