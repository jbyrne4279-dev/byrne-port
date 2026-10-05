/* ============================================================
   SALES ANALYSIS FOR MERCHANDISERS | sales-analysis.js
   Reads a weekly sales report (Excel / CSV / PDF / image) entirely
   in the browser, works out which columns are which, then scores
   every product for stock cover, sales strength and week-on-week
   trend so a merchandiser can see what to act on first.
   ============================================================ */

'use strict';

(function () {
  const $ = id => document.getElementById(id);

  const els = {
    uploadWrap: $('saUploadWrap'),
    drop:       $('saDrop'),
    file:       $('saFile'),
    sample:     $('saSample'),
    status:     $('saStatus'),
    results:    $('saResults'),
    fileName:   $('saFileName'),
    fileMeta:   $('saFileMeta'),
    exportBtn:  $('saExport'),
    newBtn:     $('saNew'),
    kpis:       $('saKpis'),
    insights:   $('saInsights'),
    mixBar:     $('saMixBar'),
    mixLegend:  $('saMixLegend'),
    top:        $('saTop'),
    config:     $('saConfig'),
    configHint: $('saConfigHint'),
    map:        $('saMap'),
    pills:      $('saPills'),
    search:     $('saSearch'),
    sort:       $('saSort'),
    table:      $('saTable'),
    body:       $('saBody'),
    empty:      $('saEmpty'),
    th: {
      reorderWks: $('saReorderWks'),
      watchWks:   $('saWatchWks'),
      overWks:    $('saOverWks'),
      lowLoc:     $('saLowLoc'),
      goodLoc:    $('saGoodLoc'),
      trendPct:   $('saTrendPct')
    }
  };

  /* ───────────────────────── Library loading ───────────────────────── */

  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load ' + src));
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }
  const LIB = {
    xlsx:      'vendor/xlsx/xlsx.full.min.js',
    pdf:       'vendor/pdfjs/pdf.min.js',
    pdfWorker: 'vendor/pdfjs/pdf.worker.min.js',
    ocr:       'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
  };

  /* ───────────────────────── Helpers ───────────────────────── */

  const fmtGBP = v => v == null ? '—' :
    '£' + (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-GB')
                              : v.toLocaleString('en-GB', { maximumFractionDigits: 2 }));
  const fmtInt = v => v == null ? '—' : Math.round(v).toLocaleString('en-GB');
  const fmtPct = v => (v > 0 ? '+' : '') + Math.round(v) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // "£1,234.50", "1 234", "(12)", "12%", "-", "" → number | null
  function num(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s || /^[-–—]+$/.test(s) || /^(n\/?a|blank|null|none)$/i.test(s)) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[£$€,\s%]/g, '').replace(/units?$/i, '');
    // OCR commonly reads 0 as O
    if (/^[0-9oO.]+$/.test(s)) s = s.replace(/[oO]/g, '0');
    if (!/^-?\d*\.?\d+$/.test(s)) return null;
    const n = parseFloat(s);
    return isFinite(n) ? (neg ? -n : n) : null;
  }
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const median = arr => {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  /* ───────────────────────── Column detection ───────────────────────── */

  const FIELDS = [
    { key: 'name',      label: 'Product name' },
    { key: 'code',      label: 'Code / SKU' },
    { key: 'category',  label: 'Category' },
    { key: 'units',     label: 'Units sold (this week)' },
    { key: 'value',     label: 'Sales £ (this week)' },
    { key: 'prevUnits', label: 'Units sold (previous week)' },
    { key: 'prevValue', label: 'Sales £ (previous week)' },
    { key: 'branch',    label: 'Branch / store stock' },
    { key: 'warehouse', label: 'Warehouse stock' },
    { key: 'online',    label: 'Online stock' },
    { key: 'stock',     label: 'Total stock' },
    { key: 'onOrder',   label: 'On order' },
    { key: 'price',     label: 'Price' }
  ];

  const RX = {
    code:      /(code|sku|\bref\b|reference|barcode|\bean\b|\bupc\b|\bplu\b|article|style ?(no|num|number)\b|item ?(no|num|number)\b|^id$|\bid\b)/,
    name:      /\b(product|description|desc|item|name|title|line|style)\b/,
    category:  /\b(category|cat|dept|department|division|class|range|group|sub ?cat)\b/,
    unitsLike: /\b(units?|qty|quantity|sold|volume|pcs|pieces|sell ?through|sales ?qty)\b/,
    valueLike: /(£|\$|€|\bvalue\b|revenue|turnover|\bnet\b|\bgross\b|takings|\bcash\b|amount|sales ?£|£ ?sales|\bsales\b)/,
    prevStrong:/(prev|prior|previous|week ?before|2 ?w(ee)?ks?|wk ?-? ?2|w ?-? ?2|lw ?-? ?1|last ?year|\bly\b|lwly)/,
    lastWeek:  /(last ?week|\blw\b)/,
    thisWeek:  /(this ?week|\btw\b|current|latest|wk ?0)/,
    branch:    /\b(branch|branches|store|stores|shop|shops|retail)\b/,
    warehouse: /(warehouse|w\/h|\bwh\b|\bdc\b|depot|distribution|central)/,
    online:    /(online|\bweb\b|website|e-?com|digital|dotcom|\.com)/,
    stock:     /\b(stock|soh|on ?hand|inventory|available|avail|holding)\b/,
    onOrder:   /(on ?order|intake|\bdue\b|in ?transit|\bpo\b|open ?orders?|outstanding)/,
    price:     /\b(price|rrp|sp|selling ?price|retail ?price|unit ?price)\b/,
    skipRow:   /^(grand )?total|^sub ?total|^totals?$|^all products/i
  };

  function scoreHeaderCell(h) {
    let s = 0;
    for (const k of ['code', 'name', 'unitsLike', 'valueLike', 'branch', 'warehouse', 'online', 'stock', 'onOrder', 'price', 'category']) {
      if (RX[k].test(h)) s++;
    }
    return Math.min(s, 1);
  }

  function findHeaderRow(rows) {
    let best = -1, bestScore = 1;
    const limit = Math.min(rows.length, 25);
    for (let i = 0; i < limit; i++) {
      const cells = rows[i].map(norm);
      const textCells = cells.filter(c => c && num(c) == null);
      const score = textCells.reduce((t, c) => t + scoreHeaderCell(c), 0);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    return best;
  }

  // Does a sample of the column look like money?
  function looksLikeMoney(rows, col) {
    let money = 0, seen = 0;
    for (const r of rows.slice(0, 30)) {
      const v = r[col];
      if (v == null || v === '') continue;
      seen++;
      if (/[£$€]/.test(String(v)) || (typeof v === 'number' && !Number.isInteger(v))) money++;
    }
    return seen > 0 && money / seen > 0.4;
  }
  // Cells like "£6,164 128 units" (value and units together)
  function looksCombined(rows, col) {
    let hit = 0, seen = 0;
    for (const r of rows.slice(0, 30)) {
      const v = r[col];
      if (v == null || v === '') continue;
      seen++;
      if (/[£$€]\s?[\d,.]+/.test(String(v)) && /\d\s*units?/i.test(String(v))) hit++;
    }
    return seen > 0 && hit / seen > 0.5;
  }
  function textyColumn(rows, col) {
    let t = 0, seen = 0;
    for (const r of rows.slice(0, 30)) {
      const v = r[col];
      if (v == null || v === '') continue;
      seen++;
      if (num(v) == null) t++;
    }
    return seen > 0 && t / seen > 0.6;
  }

  function weekNumber(h) {
    const m = h.match(/w(?:ee)?k\s*-?\s*(\d{1,2})\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  function detectColumns(headers, data) {
    const H = headers.map(norm);
    const map = {};
    const used = new Set();
    const take = (key, i) => { if (i != null && i >= 0 && !used.has(i)) { map[key] = i; used.add(i); } };
    const find = (test, prefer) => {
      const hits = [];
      H.forEach((h, i) => { if (h && !used.has(i) && test(h, i)) hits.push(i); });
      if (!hits.length) return -1;
      return prefer ? prefer(hits) : hits[0];
    };

    // Combined "£x / n units" cell
    H.forEach((h, i) => {
      if (map.combined == null && (RX.unitsLike.test(h) || RX.valueLike.test(h)) && looksCombined(data, i)) {
        map.combined = i; used.add(i);
      }
    });

    // Stock locations first so "store stock" never becomes the name column
    take('onOrder',   find(h => RX.onOrder.test(h)));
    take('warehouse', find(h => RX.warehouse.test(h) && !RX.unitsLike.test(h) && !RX.valueLike.test(h)));
    take('online',    find(h => RX.online.test(h) && !RX.unitsLike.test(h) && !/sales|sold|£/.test(h)));
    take('branch',    find(h => RX.branch.test(h) && !RX.unitsLike.test(h) && !/sales|sold|£/.test(h)));
    take('price',     find(h => RX.price.test(h) && !/sales/.test(h)));

    // Sales: collect units-like and value-like columns, then decide current vs previous
    const unitCols = [], valueCols = [];
    H.forEach((h, i) => {
      if (!h || used.has(i)) return;
      if (RX.stock.test(h) && !/sold|sales/.test(h)) return;
      const isValue = RX.valueLike.test(h) && (looksLikeMoney(data, i) || /£|\$|€|value|revenue|turnover|takings/.test(h));
      const isUnits = RX.unitsLike.test(h) || (/\bsales\b/.test(h) && !looksLikeMoney(data, i));
      if (isValue) valueCols.push(i);
      else if (isUnits && !textyColumn(data, i)) unitCols.push(i);
    });
    const pickCurrentPrev = cols => {
      if (!cols.length) return [null, null];
      if (cols.length === 1) return [cols[0], null];
      const anyThis = cols.some(i => RX.thisWeek.test(H[i]));
      const prevness = i => {
        const h = H[i];
        let p = 0;
        if (RX.prevStrong.test(h)) p += 2;
        if (RX.lastWeek.test(h) && anyThis) p += 1;
        if (RX.thisWeek.test(h)) p -= 1;
        return p;
      };
      const sorted = cols.slice().sort((a, b) => {
        const d = prevness(a) - prevness(b);
        if (d) return d;
        const wa = weekNumber(H[a]), wb = weekNumber(H[b]);
        if (wa != null && wb != null && wa !== wb) return wb - wa; // higher week number = current
        return b - a;                                               // otherwise right-most = current
      });
      return [sorted[0], sorted[1]];
    };
    const [u, pu] = pickCurrentPrev(unitCols);
    const [v, pv] = pickCurrentPrev(valueCols);
    take('units', u); take('prevUnits', pu);
    take('value', v); take('prevValue', pv);

    take('stock', find(h => RX.stock.test(h)));
    take('code',     find(h => RX.code.test(h)));
    take('category', find((h, i) => RX.category.test(h) && textyColumn(data, i)));
    take('name',     find((h, i) => RX.name.test(h) && !/^(action|status|notes?|comments?)$/.test(h) && textyColumn(data, i)));
    // Fall back to the first remaining text column for the name
    if (map.name == null) take('name', find((h, i) => !/^(action|status|notes?|comments?|priority)$/.test(h) && textyColumn(data, i)));
    return map;
  }

  /* ───────────────────────── Turning grids into products ───────────────────────── */

  function buildProducts(grid, map) {
    const out = [];
    for (const r of grid) {
      const get = k => map[k] != null ? r[map[k]] : null;
      const name = String(get('name') ?? '').trim();
      const code = String(get('code') ?? '').trim();
      if (!name && !code) continue;
      if (RX.skipRow.test(name) || RX.skipRow.test(code)) continue;

      let units = num(get('units'));
      let value = num(get('value'));
      if (map.combined != null) {
        const s = String(r[map.combined] ?? '');
        const mv = s.match(/[£$€]\s?([\d,]+(?:\.\d+)?)/);
        const mu = s.match(/([\d,]+)\s*units?/i);
        if (mv && value == null) value = num(mv[1]);
        if (mu && units == null) units = num(mu[1]);
      }
      const price = num(get('price'));
      if (value == null && units != null && price != null) value = units * price;
      if (units == null && value != null && price) units = Math.round(value / price);

      const branch    = map.branch    != null ? num(get('branch'))    : undefined;
      const warehouse = map.warehouse != null ? num(get('warehouse')) : undefined;
      const online    = map.online    != null ? num(get('online'))    : undefined;
      let stock       = map.stock     != null ? num(get('stock'))     : undefined;

      // Skip rows that carry no numbers at all (sub-headings, notes)
      const nums = [units, value, branch, warehouse, online, stock].filter(x => x != null && x !== undefined);
      if (!nums.length) continue;

      out.push({
        name: name || code,
        code: name ? code : '',
        category: String(get('category') ?? '').trim(),
        units, value,
        prevUnits: num(get('prevUnits')),
        prevValue: num(get('prevValue')),
        branch, warehouse, online, stock,
        onOrder: num(get('onOrder')),
        price
      });
    }
    return out;
  }

  /* ───────────────────────── File readers ───────────────────────── */

  async function readSpreadsheet(file) {
    await loadScript(LIB.xlsx);
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    // Pick the sheet that looks most like a sales table
    let best = null, bestScore = -1;
    for (const sn of wb.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
      const h = findHeaderRow(rows);
      const score = h >= 0 ? rows.length + 1000 : rows.length;
      if (score > bestScore) { best = { rows, sheet: sn }; bestScore = score; }
    }
    return { rows: best ? best.rows : [], note: wb.SheetNames.length > 1 ? 'Sheet “' + best.sheet + '”' : '' };
  }

  // Positioned text (PDF items / OCR words) → grid, by snapping each
  // piece of text to the nearest header column.
  function gridFromPositioned(lines) {
    // lines: [{ y, items:[{x0,x1,str}] }] sorted top→bottom
    const asCells = lines.map(l => {
      const cells = [];
      l.items.sort((a, b) => a.x0 - b.x0).forEach(it => {
        const last = cells[cells.length - 1];
        const gap = last ? it.x0 - last.x1 : Infinity;
        const h = Math.max(4, (it.x1 - it.x0) / Math.max(it.str.length, 1));
        if (last && gap < h * 1.2) { last.str += ' ' + it.str; last.x1 = it.x1; }
        else cells.push({ ...it });
      });
      return cells;
    });
    const hi = findHeaderRow(asCells.map(c => c.map(x => x.str)));
    if (hi < 0) return asCells.map(c => c.map(x => x.str));
    const header = asCells[hi];
    const centres = header.map(c => (c.x0 + c.x1) / 2);
    const grid = [header.map(c => c.str)];
    for (let i = hi + 1; i < asCells.length; i++) {
      const row = new Array(header.length).fill('');
      asCells[i].forEach(c => {
        const cx = (c.x0 + c.x1) / 2;
        let k = 0, d = Infinity;
        centres.forEach((hc, j) => {
          // prefer the header the cell overlaps, else nearest centre
          const overlap = c.x1 >= header[j].x0 - 6 && c.x0 <= header[j].x1 + 6;
          const dd = overlap ? Math.abs(cx - hc) * 0.25 : Math.abs(cx - hc);
          if (dd < d) { d = dd; k = j; }
        });
        row[k] = row[k] ? row[k] + ' ' + c.str : c.str;
      });
      grid.push(row);
    }
    return grid;
  }

  function groupIntoLines(items, tol) {
    items.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const lines = [];
    for (const it of items) {
      const l = lines[lines.length - 1];
      if (l && Math.abs(l.y - it.y) <= tol) { l.items.push(it); l.y = (l.y * (l.items.length - 1) + it.y) / l.items.length; }
      else lines.push({ y: it.y, items: [it] });
    }
    return lines;
  }

  async function readPdf(file) {
    await loadScript(LIB.pdf);
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let all = [];
    let yOffset = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4];
        const y = vp.height - it.transform[5];
        all.push({ x0: x, x1: x + (it.width || it.str.length * 5), y: y + yOffset, str: it.str.trim() });
      });
      yOffset += vp.height + 50;
    }
    if (!all.length) throw new Error('This PDF has no readable text (it may be a scan). Try uploading it as an image instead.');
    const lines = groupIntoLines(all, 3);
    // Repeated header rows on later pages are dropped by the "no numbers" filter in buildProducts
    return { rows: gridFromPositioned(lines), note: doc.numPages + (doc.numPages > 1 ? ' pages' : ' page') };
  }

  async function readImage(file) {
    setStatus('Loading text recognition… (first time can take a few seconds)', true);
    await loadScript(LIB.ocr);
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') setStatus('Reading your image… ' + Math.round(m.progress * 100) + '%', true);
      }
    });
    try {
      const { data } = await worker.recognize(file);
      const items = [];
      (data.words || []).forEach(w => {
        if (!w.text || !w.text.trim() || w.confidence < 25) return;
        items.push({ x0: w.bbox.x0, x1: w.bbox.x1, y: (w.bbox.y0 + w.bbox.y1) / 2, str: w.text.trim(), h: w.bbox.y1 - w.bbox.y0 });
      });
      if (!items.length) throw new Error('No text could be read from that image. Try a sharper screenshot or the original Excel file.');
      const tol = Math.max(6, median(items.map(i => i.h)) * 0.6);
      const lines = groupIntoLines(items, tol);
      // Lines that sit very close together under one product (e.g. "£3,626" over "301 units")
      // are merged into the row above so value + units stay together.
      return { rows: mergeStackedLines(gridFromPositioned(lines)), note: 'Read from image' };
    } finally {
      worker.terminate();
    }
  }

  // In screenshots like the reference design, a product spans two text lines
  // (name over code, £ over units). Merge a line into the one above when it
  // has no text in the first non-empty column of the line above.
  function mergeStackedLines(grid) {
    if (grid.length < 3) return grid;
    const out = [grid[0]];
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i];
      const prev = out[out.length - 1];
      const filled = row.filter(c => c && String(c).trim()).length;
      const prevFilled = prev.filter(c => c && String(c).trim()).length;
      const isSub = out.length > 1 && filled > 0 && filled <= Math.ceil(prevFilled / 2) &&
                    row.every((c, k) => !c || (/^[A-Z]?\d{3,}|^\d+\s*units?$/i.test(String(c).trim())));
      if (isSub) {
        row.forEach((c, k) => { if (c) prev[k] = prev[k] ? prev[k] + ' ' + c : c; });
      } else {
        out.push(row.slice());
      }
    }
    return out;
  }

  async function readCsvText(file) {
    await loadScript(LIB.xlsx);
    const text = await file.text();
    const wb = window.XLSX.read(text, { type: 'string' });
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    return { rows, note: '' };
  }

  /* ───────────────────────── Analysis ───────────────────────── */

  const STATUS = {
    act:   { label: 'Act now: reorder', short: 'Act now',   colour: 'var(--red)',      pri: 'act' },
    watch: { label: 'Watch',            short: 'Watch',     colour: '#f7b955',         pri: 'watch' },
    ok:    { label: 'Healthy',          short: 'Healthy',   colour: '#5fd884',         pri: 'ok' },
    over:  { label: 'Overstocked',      short: 'Overstock', colour: '#4c8dff',         pri: 'over' },
    idle:  { label: 'No sales',         short: 'No sales',  colour: '#8a8a92',         pri: 'idle' }
  };
  const STATUS_ORDER = ['act', 'watch', 'ok', 'over', 'idle'];

  function thresholds() {
    const v = (el, d) => { const n = parseFloat(el.value); return isFinite(n) && n >= 0 ? n : d; };
    return {
      reorder: v(els.th.reorderWks, 2),
      watch:   Math.max(v(els.th.watchWks, 4), v(els.th.reorderWks, 2)),
      over:    v(els.th.overWks, 12),
      lowLoc:  v(els.th.lowLoc, 5),
      goodLoc: Math.max(v(els.th.goodLoc, 9), v(els.th.lowLoc, 5) + 1),
      trend:   v(els.th.trendPct, 10)
    };
  }

  function analyse(products, has) {
    const T = thresholds();
    const sellers = products.filter(p => (p.units || 0) > 0);

    // Total stock per line
    products.forEach(p => {
      const parts = [p.branch, p.warehouse, p.online].filter(x => x != null);
      p.total = p.stock != null ? p.stock : (parts.length ? parts.reduce((a, b) => a + b, 0) : null);
      p.cover = (p.total != null && p.units > 0) ? p.total / p.units : null;
      p.coverInclOrder = (p.cover != null && p.onOrder) ? (p.total + p.onOrder) / p.units : p.cover;
      if (p.prevUnits != null && p.units != null) {
        p.trend = p.prevUnits > 0 ? (p.units - p.prevUnits) / p.prevUnits * 100 : (p.units > 0 ? Infinity : 0);
      } else if (p.prevValue != null && p.value != null) {
        p.trend = p.prevValue > 0 ? (p.value - p.prevValue) / p.prevValue * 100 : (p.value > 0 ? Infinity : 0);
      } else p.trend = null;
    });

    // If almost every selling line is "under 2 weeks", the stock columns are
    // probably per-store / average counts, not totals. Rank relatively instead.
    const withCover = sellers.filter(p => p.cover != null);
    const underReorder = withCover.filter(p => p.cover < T.reorder).length;
    const relative = withCover.length >= 4 && underReorder / withCover.length > 0.8;

    // Sales rank (by £ if we have it, else units)
    const salesKey = p => (p.value != null ? p.value : (p.units || 0));
    const ranked = products.slice().sort((a, b) => salesKey(b) - salesKey(a));
    const n = ranked.length;
    ranked.forEach((p, i) => { p.salesRank = i; p.salesPct = n > 1 ? i / (n - 1) : 0; });
    const medianUnits = median(sellers.map(p => p.units));

    // Pressure = how fast a line is eating its stock (relative mode)
    let pressureRank = new Map();
    if (relative) {
      const pr = withCover.slice().sort((a, b) => a.cover - b.cover);
      pr.forEach((p, i) => pressureRank.set(p, pr.length > 1 ? i / (pr.length - 1) : 0));
    }

    products.forEach(p => {
      const locs = [['branch', p.branch], ['warehouse', p.warehouse], ['online', p.online]]
        .filter(([, v]) => v !== undefined);
      const selling = (p.units || 0) > 0;
      const zeroLocs  = locs.filter(([, v]) => v === 0).map(([k]) => k);
      const blankLocs = locs.filter(([, v]) => v === null).map(([k]) => k);
      const lowLocs   = locs.filter(([, v]) => v != null && v <= T.lowLoc).map(([k]) => k);

      p.flags = new Set();
      if (selling && (zeroLocs.length || (p.total === 0))) p.flags.add('outOfStock');
      if (selling && p.online !== undefined && (p.online === 0 || p.online === null) &&
          ((p.branch || 0) + (p.warehouse || 0) > 0 || p.online === 0)) p.flags.add('onlineGap');
      if (p.trend != null && p.trend >= T.trend) p.flags.add('improving');
      if (p.trend != null && p.trend <= -T.trend) p.flags.add('declining');
      if (selling && p.salesPct <= 0.2) p.flags.add('highSales');
      if (p.salesPct >= 0.8 || !selling) p.flags.add('lowSales');

      // Status
      let status;
      const cover = p.coverInclOrder;
      if (!selling) {
        status = 'idle';
      } else if (relative) {
        const pr = pressureRank.get(p);
        const pressured = pr != null && pr <= 0.3;
        const strong = p.salesPct <= 0.5;
        const reds = lowLocs.length;
        if ((pressured && strong) || (zeroLocs.length && strong) || reds >= 2 && strong) status = 'act';
        else if (pressured || zeroLocs.length || reds >= 1 || (pr != null && pr <= 0.6)) status = 'watch';
        else status = 'ok';
      } else if (cover == null) {
        status = zeroLocs.length ? (p.units >= medianUnits ? 'act' : 'watch') : 'watch';
      } else if (cover < T.reorder || p.total === 0) {
        status = 'act';
      } else if (zeroLocs.length && p.units >= medianUnits) {
        status = 'act';
      } else if (cover < T.watch || zeroLocs.length) {
        status = 'watch';
      } else if (cover > T.over) {
        status = 'over';
      } else status = 'ok';

      // Running out = selling and stock won't last (or a location is already empty)
      if (selling) {
        const short = relative
          ? (status === 'act' || (status === 'watch' && lowLocs.length > 0))
          : (status === 'act' || (p.cover != null && p.cover < T.watch));
        if (short || p.flags.has('outOfStock')) p.flags.add('runningOut');
      }
      if (status === 'over') p.flags.add('overstock');
      p.status = status;

      // Urgency score for ordering inside a group
      const velocity = p.value != null ? p.value : (p.units || 0);
      const coverForScore = relative ? (pressureRank.get(p) ?? 1) * 4 : (cover != null ? cover : 2);
      p.score = velocity / Math.max(coverForScore, 0.15) + (zeroLocs.length * velocity * 0.25);

      // Action text
      const actions = [];
      if (status === 'act') actions.push('Reorder');
      else if (status === 'watch') actions.push('Watch');
      else if (status === 'over') actions.push(p.trend != null && p.trend < 0 ? 'Markdown / promote' : 'Hold orders');
      else if (status === 'idle') actions.push((p.total || 0) > 0 ? 'Review: no sales' : 'No sales, no stock');
      else actions.push('On track');
      if (selling && p.online !== undefined && (p.online === 0 || p.online === null) &&
          ((p.branch || 0) + (p.warehouse || 0) > 0)) actions.push('fill online');
      else if (selling && p.warehouse === 0 && status !== 'act') actions.push('warehouse empty');
      if (selling && p.branch === 0 && (p.warehouse || 0) > 0) actions.push('send to branch');
      p.action = actions[0] + (actions.length > 1 ? ', ' + actions.slice(1).join(', ') : '');
      p.zeroLocs = zeroLocs; p.blankLocs = blankLocs;
    });

    return { products, relative, T, has };
  }

  /* ───────────────────────── Insights ───────────────────────── */

  function buildInsights(A) {
    const P = A.products;
    const out = [];
    const totalValue = P.reduce((s, p) => s + (p.value || 0), 0);
    const totalUnits = P.reduce((s, p) => s + (p.units || 0), 0);
    const byVal = P.slice().sort((a, b) => (b.value ?? b.units ?? 0) - (a.value ?? a.units ?? 0));
    const metric = p => A.has.value ? fmtGBP(p.value) : fmtInt(p.units) + ' units';
    const share = p => A.has.value && totalValue ? Math.round(p.value / totalValue * 100) : (totalUnits ? Math.round((p.units || 0) / totalUnits * 100) : 0);

    const act = P.filter(p => p.status === 'act').sort((a, b) => b.score - a.score);
    if (act.length) {
      const atRisk = act.reduce((s, p) => s + (A.has.value ? (p.value || 0) : (p.units || 0)), 0);
      out.push({ tone: 'red', icon: '!', html:
        `<b>${act.length} line${act.length > 1 ? 's' : ''} need reordering now</b>, worth ${A.has.value ? fmtGBP(atRisk) : fmtInt(atRisk) + ' units'} of last week&rsquo;s sales. Start with <b>${esc(act[0].name)}</b>${act[1] ? ' and <b>' + esc(act[1].name) + '</b>' : ''}.` });
    }

    if (byVal[0] && (byVal[0].value || byVal[0].units)) {
      const top = byVal[0];
      const top5 = byVal.slice(0, 5).reduce((s, p) => s + (A.has.value ? (p.value || 0) : (p.units || 0)), 0);
      const top5Share = Math.round(top5 / (A.has.value ? totalValue : totalUnits) * 100);
      out.push({ tone: 'blue', icon: '★', html:
        `Best seller: <b>${esc(top.name)}</b> at ${metric(top)} (${share(top)}% of the week).` +
        (P.length > 6 ? ` Your top 5 lines made <b>${top5Share}%</b> of sales${top5Share >= 60 ? ', so availability on them matters most' : ''}.` : '') });
    }

    if (A.has.trend) {
      const prevTotal = P.reduce((s, p) => s + (p.prevUnits != null ? p.prevUnits : 0), 0);
      const currTotal = P.reduce((s, p) => s + (p.prevUnits != null ? (p.units || 0) : 0), 0);
      if (prevTotal > 0) {
        const d = (currTotal - prevTotal) / prevTotal * 100;
        out.push({ tone: d >= 0 ? 'green' : 'red', icon: d >= 0 ? '▲' : '▼', html:
          `Units are <b>${d >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(d))}%</b> on the previous week (${fmtInt(currTotal)} vs ${fmtInt(prevTotal)}).` });
      }
      const movers = P.filter(p => p.trend != null && isFinite(p.trend) && (p.units || 0) + (p.prevUnits || 0) >= 5);
      const riser = movers.slice().sort((a, b) => b.trend - a.trend)[0];
      const faller = movers.slice().sort((a, b) => a.trend - b.trend)[0];
      if (riser && riser.trend >= A.T.trend) out.push({ tone: 'green', icon: '↗', html:
        `Biggest riser: <b>${esc(riser.name)}</b>, <b>${fmtPct(riser.trend)}</b> week on week (${fmtInt(riser.prevUnits)} → ${fmtInt(riser.units)} units)${riser.status === 'act' || riser.status === 'watch' ? '. Check stock can keep up.' : '.'}` });
      if (faller && faller.trend <= -A.T.trend) out.push({ tone: 'amber', icon: '↘', html:
        `Slowing down: <b>${esc(faller.name)}</b>, <b>${fmtPct(faller.trend)}</b> week on week${(faller.cover || 0) > A.T.watch ? ', with ' + Math.round(faller.cover) + ' weeks of stock behind it' : ''}.` });
    }

    const online = P.filter(p => p.flags.has('onlineGap'));
    if (online.length) out.push({ tone: 'amber', icon: '⟳', html:
      `<b>${online.length} selling line${online.length > 1 ? 's have' : ' has'} no online stock</b>${online.length <= 3 ? ' (' + online.map(p => esc(p.name)).join(', ') + ')' : ''}. Move stock across to protect web sales.` });

    const oos = P.filter(p => p.flags.has('outOfStock') && !p.flags.has('onlineGap'));
    if (oos.length) out.push({ tone: 'red', icon: '0', html:
      `<b>${oos.length} line${oos.length > 1 ? 's are' : ' is'} sold out</b> in at least one location while still selling.` });

    const over = P.filter(p => p.status === 'over');
    if (over.length) {
      const units = over.reduce((s, p) => s + (p.total || 0), 0);
      out.push({ tone: 'blue', icon: '≡', html:
        `<b>${over.length} overstocked line${over.length > 1 ? 's' : ''}</b> with ${A.T.over}+ weeks of cover (${fmtInt(units)} units). Hold further orders or plan a promotion.` });
    }

    const idle = P.filter(p => p.status === 'idle' && (p.total || 0) > 0);
    if (idle.length) out.push({ tone: 'grey', icon: '–', html:
      `<b>${idle.length} line${idle.length > 1 ? 's' : ''} sold nothing</b> but ${idle.length > 1 ? 'are' : 'is'} holding stock. Review placement or price.` });

    if (A.has.category) {
      const cats = {};
      P.forEach(p => { if (p.category) cats[p.category] = (cats[p.category] || 0) + (A.has.value ? (p.value || 0) : (p.units || 0)); });
      const list = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      if (list.length > 1) out.push({ tone: 'blue', icon: '◆', html:
        `Strongest category: <b>${esc(list[0][0])}</b> (${A.has.value ? fmtGBP(list[0][1]) : fmtInt(list[0][1]) + ' units'}), ahead of ${esc(list[1][0])}.` });
    }

    if (A.relative) out.push({ tone: 'grey', icon: 'i', html:
      'Your stock figures look like per-store or average counts rather than totals, so lines are ranked against each other instead of by weeks of cover.' });

    if (!A.has.trend) out.push({ tone: 'grey', icon: 'i', html:
      'Add a <b>previous week units</b> column to see which lines are improving or declining.' });

    if (!out.length) out.push({ tone: 'green', icon: '✓', html: 'Nothing urgent this week: stock and sales look balanced.' });
    return out;
  }

  /* ───────────────────────── State + rendering ───────────────────────── */

  const state = {
    rows: null,        // raw grid
    headerIdx: -1,
    headers: [],
    data: [],
    map: {},
    analysis: null,
    filter: 'all',
    sort: 'priority',
    query: '',
    fileLabel: '',
    note: ''
  };

  const PILLS = [
    { key: 'all',        label: 'All products',     dot: null,       test: () => true },
    { key: 'act',        label: 'Reorder now',      dot: 'var(--red)', test: p => p.status === 'act' },
    { key: 'runningOut', label: 'Running out',      dot: '#ff6b84',  test: p => p.flags.has('runningOut') },
    { key: 'outOfStock', label: 'Sold out somewhere', dot: '#ff6b84', test: p => p.flags.has('outOfStock') },
    { key: 'highSales',  label: 'High sales',       dot: '#4c8dff',  test: p => p.flags.has('highSales') },
    { key: 'lowSales',   label: 'Low sales',        dot: '#8a8a92',  test: p => p.flags.has('lowSales') },
    { key: 'improving',  label: 'Improving',        dot: '#5fd884',  test: p => p.flags.has('improving'), needs: 'trend' },
    { key: 'declining',  label: 'Declining',        dot: '#f7b955',  test: p => p.flags.has('declining'), needs: 'trend' },
    { key: 'onlineGap',  label: 'Online gaps',      dot: '#f7b955',  test: p => p.flags.has('onlineGap'), needs: 'online' },
    { key: 'overstock',  label: 'Overstocked',      dot: '#4c8dff',  test: p => p.flags.has('overstock') },
    { key: 'watch',      label: 'Watch',            dot: '#f7b955',  test: p => p.status === 'watch' },
    { key: 'ok',         label: 'Healthy',          dot: '#5fd884',  test: p => p.status === 'ok' }
  ];

  function setStatus(msg, busy, isError) {
    if (!msg) { els.status.hidden = true; return; }
    els.status.hidden = false;
    els.status.classList.toggle('is-error', !!isError);
    els.status.innerHTML = (busy ? '<span class="sa-spin" aria-hidden="true"></span>' : '') + '<span>' + msg + '</span>';
  }

  function runAnalysis() {
    const products = buildProducts(state.data, state.map);
    if (!products.length) {
      throw new Error('Couldn’t find any product rows. Check the “Columns & thresholds” panel and pick the right columns.');
    }
    const has = {
      value:     products.some(p => p.value != null),
      units:     products.some(p => p.units != null),
      trend:     products.some(p => p.prevUnits != null || p.prevValue != null),
      branch:    state.map.branch != null,
      warehouse: state.map.warehouse != null,
      online:    state.map.online != null,
      total:     state.map.stock != null && state.map.branch == null && state.map.warehouse == null && state.map.online == null,
      category:  products.some(p => p.category),
      stock:     products.some(p => p.stock != null || p.branch != null || p.warehouse != null || p.online != null)
    };
    state.analysis = analyse(products, has);
  }

  function render() {
    const A = state.analysis;
    if (!A) return;
    renderKpis(A);
    renderInsights(A);
    renderMix(A);
    renderPills(A);
    renderTable(A);
  }

  function renderKpis(A) {
    const P = A.products;
    const val = P.reduce((s, p) => s + (p.value || 0), 0);
    const units = P.reduce((s, p) => s + (p.units || 0), 0);
    const prevU = P.reduce((s, p) => s + (p.prevUnits || 0), 0);
    const prevV = P.reduce((s, p) => s + (p.prevValue || 0), 0);
    const act = P.filter(p => p.status === 'act').length;
    const out = P.filter(p => p.flags.has('outOfStock')).length;
    const covers = P.filter(p => p.cover != null && isFinite(p.cover));
    const totU = covers.reduce((s, p) => s + p.units, 0);
    const avgCover = totU ? covers.reduce((s, p) => s + p.total, 0) / totU : null;

    const delta = (curr, prev) => prev > 0
      ? `<div class="sa-kpi__delta ${curr >= prev ? 'sa-up' : 'sa-down'}">${curr >= prev ? '▲' : '▼'} ${Math.abs(Math.round((curr - prev) / prev * 100))}% vs prev wk</div>`
      : '';
    const tiles = [];
    if (A.has.value) tiles.push(`<div class="sa-kpi"><div class="sa-kpi__label">Sales last week</div><div class="sa-kpi__value">${fmtGBP(val)}</div>${delta(val, prevV)}</div>`);
    tiles.push(`<div class="sa-kpi"><div class="sa-kpi__label">Units sold</div><div class="sa-kpi__value">${fmtInt(units)}</div>${delta(units, prevU)}</div>`);
    tiles.push(`<div class="sa-kpi"><div class="sa-kpi__label">Products</div><div class="sa-kpi__value">${P.length}</div><div class="sa-kpi__delta">${P.filter(p => p.units > 0).length} sold at least one</div></div>`);
    tiles.push(`<div class="sa-kpi ${act ? 'sa-kpi--alert' : ''}"><div class="sa-kpi__label">Reorder now</div><div class="sa-kpi__value">${act}</div><div class="sa-kpi__delta">${P.filter(p => p.status === 'watch').length} more to watch</div></div>`);
    tiles.push(`<div class="sa-kpi ${out ? 'sa-kpi--warn' : ''}"><div class="sa-kpi__label">Sold out somewhere</div><div class="sa-kpi__value">${out}</div><div class="sa-kpi__delta">${P.filter(p => p.flags.has('onlineGap')).length} with online gaps</div></div>`);
    if (A.has.stock) tiles.push(`<div class="sa-kpi"><div class="sa-kpi__label">Avg weeks cover</div><div class="sa-kpi__value">${avgCover == null ? '—' : avgCover < 10 ? avgCover.toFixed(1) : Math.round(avgCover)}</div><div class="sa-kpi__delta">${A.relative ? 'stock looks per-store' : 'stock ÷ weekly units'}</div></div>`);
    els.kpis.innerHTML = tiles.join('');
    els.kpis.style.gridTemplateColumns = '';
    els.kpis.dataset.count = tiles.length;
  }

  function renderInsights(A) {
    els.insights.innerHTML = buildInsights(A).map(i =>
      `<li class="sa-insight sa-insight--${i.tone}"><span class="sa-insight__icon" aria-hidden="true">${i.icon}</span><span>${i.html}</span></li>`
    ).join('');
  }

  function renderMix(A) {
    const P = A.products;
    const counts = STATUS_ORDER.map(k => [k, P.filter(p => p.status === k).length]).filter(([, c]) => c);
    els.mixBar.innerHTML = counts.map(([k, c]) => `<span style="flex-grow:${c};background:${STATUS[k].colour}" title="${STATUS[k].label}: ${c}"></span>`).join('');
    els.mixLegend.innerHTML = counts.map(([k, c]) =>
      `<li><i style="background:${STATUS[k].colour}"></i>${STATUS[k].short}<b>${c}</b></li>`).join('');
    const top = P.slice().sort((a, b) => (b.value ?? b.units ?? 0) - (a.value ?? a.units ?? 0)).slice(0, 5);
    const max = top.length ? (top[0].value ?? top[0].units ?? 1) : 1;
    els.top.innerHTML = top.map(p => {
      const v = p.value ?? p.units ?? 0;
      return `<li><span class="sa-top__name">${esc(p.name)}</span><span class="sa-top__val">${A.has.value ? fmtGBP(p.value) : fmtInt(p.units)}</span><span class="sa-top__bar"><i style="width:${Math.max(4, v / max * 100)}%"></i></span></li>`;
    }).join('');
  }

  function renderPills(A) {
    const P = A.products;
    els.pills.innerHTML = PILLS.map(pl => {
      const missing = pl.needs && !(pl.needs === 'trend' ? A.has.trend : A.has[pl.needs]);
      const count = missing ? 0 : P.filter(pl.test).length;
      if (pl.key !== 'all' && !missing && count === 0 && !['act', 'runningOut'].includes(pl.key)) return '';
      const title = missing ? (pl.needs === 'trend' ? 'Needs a previous-week column' : 'Needs an online stock column') : '';
      return `<button type="button" class="sa-pill ${state.filter === pl.key ? 'is-active' : ''}" data-key="${pl.key}" role="tab" aria-selected="${state.filter === pl.key}" ${missing ? 'disabled' : ''} ${title ? `title="${title}"` : ''}>` +
        (pl.dot ? `<i style="background:${pl.dot}"></i>` : '') + pl.label +
        `<span class="sa-pill__count">${missing ? '–' : count}</span></button>`;
    }).join('');
  }

  // Colour a location's stock. When stock figures are real totals, judge it
  // by how long it lasts at the product's weekly sales rate; when they look
  // like per-store counts (relative mode), use the fixed unit thresholds.
  function stockChip(v, T, p, A) {
    if (v === undefined) return '';
    if (v === null) return '<span class="sa-chip sa-chip--blank">blank</span>';
    let cls;
    if (A && !A.relative && p && p.units > 0) {
      const wks = v / p.units;
      cls = v === 0 || wks < 0.5 ? 'red' : wks < T.reorder ? 'amber' : 'green';
    } else {
      cls = v <= T.lowLoc ? 'red' : v >= T.goodLoc ? 'green' : 'amber';
    }
    return `<span class="sa-chip sa-chip--${cls}">${fmtInt(v)}</span>`;
  }
  function totalChip(p, T) {
    if (p.total == null) return '<span class="sa-chip sa-chip--blank">—</span>';
    const c = p.cover;
    const cls = p.total === 0 ? 'red' : c == null ? 'amber' : c < T.reorder ? 'red' : c < T.watch ? 'amber' : 'green';
    return `<span class="sa-chip sa-chip--${cls}">${fmtInt(p.total)}</span>`;
  }
  function trendChip(p) {
    if (p.trend == null) return '<span class="sa-trend sa-trend--flat">—</span>';
    if (!isFinite(p.trend)) return '<span class="sa-trend sa-trend--new">New</span>';
    const t = thresholds().trend;
    const cls = p.trend >= t ? 'up' : p.trend <= -t ? 'down' : 'flat';
    const arrow = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '•';
    return `<span class="sa-trend sa-trend--${cls}">${arrow} ${fmtPct(p.trend)}</span>`;
  }
  function coverCell(p, A) {
    if (p.cover == null) return '<span class="sa-cover sa-cover--grey"><span class="sa-cover__num">—</span></span>';
    const T = A.T;
    const c = p.cover;
    const cls = c < T.reorder ? 'red' : c < T.watch ? 'amber' : c > T.over ? 'blue' : 'green';
    const txt = c < 1 ? (c * 7 < 1 ? '<1' : Math.round(c * 7)) : c < 10 ? c.toFixed(1) : Math.round(c);
    const unit = c < 1 ? 'days' : 'wks';
    return `<span class="sa-cover sa-cover--${A.relative ? 'grey' : cls}"><span class="sa-cover__num">${txt}</span><span class="sa-cover__unit">${unit}</span></span>`;
  }

  function sorted(list, A) {
    const k = state.sort;
    const val = p => p.value ?? p.units ?? 0;
    const by = {
      priority:  (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.score - a.score,
      value:     (a, b) => val(b) - val(a),
      units:     (a, b) => (b.units || 0) - (a.units || 0),
      cover:     (a, b) => (a.cover ?? Infinity) - (b.cover ?? Infinity),
      trendUp:   (a, b) => (b.trend ?? -Infinity) - (a.trend ?? -Infinity),
      trendDown: (a, b) => (a.trend ?? Infinity) - (b.trend ?? Infinity),
      stock:     (a, b) => (b.total ?? -1) - (a.total ?? -1)
    }[k] || (() => 0);
    return list.slice().sort(by);
  }

  function renderTable(A) {
    const T = A.T;
    const pill = PILLS.find(p => p.key === state.filter) || PILLS[0];
    const q = state.query.trim().toLowerCase();
    let list = A.products.filter(pill.test);
    if (q) list = list.filter(p => (p.name + ' ' + p.code + ' ' + p.category).toLowerCase().includes(q));
    list = sorted(list, A);

    // Priority numbers always follow the overall priority order, so a line keeps its number across filters
    const priOrder = A.products.slice().sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.score - a.score);
    priOrder.forEach((p, i) => { p.priority = i + 1; });

    const maxVal = Math.max(1, ...A.products.map(p => p.value ?? p.units ?? 0));
    const t = els.table;
    t.classList.toggle('no-branch', !A.has.branch);
    t.classList.toggle('no-warehouse', !A.has.warehouse);
    t.classList.toggle('no-online', !A.has.online);
    t.classList.toggle('no-total', !A.has.total);
    t.classList.toggle('no-trend', !A.has.trend);

    const grouped = state.sort === 'priority';
    let html = '';
    let lastGroup = null;
    const groupCounts = {};
    list.forEach(p => { groupCounts[p.status] = (groupCounts[p.status] || 0) + 1; });

    list.forEach(p => {
      if (grouped && p.status !== lastGroup) {
        lastGroup = p.status;
        html += `<tr class="sa-group"><td colspan="10"><span class="sa-group__dot" style="background:${STATUS[p.status].colour}"></span>${STATUS[p.status].label}<span class="sa-group__count">${groupCounts[p.status]}</span></td></tr>`;
      }
      const v = p.value ?? p.units ?? 0;
      const tags = [];
      if (p.flags.has('highSales')) tags.push('Top seller');
      if (p.flags.has('improving')) tags.push('Rising');
      if (p.flags.has('declining')) tags.push('Slowing');
      if (p.onOrder) tags.push(fmtInt(p.onOrder) + ' on order');
      const mobileStrip = [
        A.has.trend ? `<span class="sa-mstat">Trend ${trendChip(p)}</span>` : '',
        A.has.branch ? `<span class="sa-mstat">Branch ${stockChip(p.branch, T, p, A)}</span>` : '',
        A.has.warehouse ? `<span class="sa-mstat">W/H ${stockChip(p.warehouse, T, p, A)}</span>` : '',
        A.has.online ? `<span class="sa-mstat">Online ${stockChip(p.online, T, p, A)}</span>` : '',
        A.has.total ? `<span class="sa-mstat">Stock ${totalChip(p, T)}</span>` : '',
        p.cover != null ? `<span class="sa-mstat">Cover ${coverCell(p, A)}</span>` : ''
      ].join('');
      html += `<tr class="sa-row">
        <td class="sa-pri-cell"><span class="sa-pri sa-pri--${STATUS[p.status].pri}">${p.priority}</span></td>
        <td class="sa-prod-cell"><div class="sa-prod__name">${esc(p.name)}</div><div class="sa-prod__code">${esc(p.code)}${p.category ? `<span class="sa-prod__cat">${p.code ? '· ' : ''}${esc(p.category)}</span>` : ''}</div></td>
        <td class="sa-sold">
          <div class="sa-sold__val">${A.has.value ? fmtGBP(p.value) : fmtInt(p.units) + ' units'}</div>
          ${A.has.value && p.units != null ? `<div class="sa-sold__units">${fmtInt(p.units)} units</div>` : ''}
          <div class="sa-sold__bar"><i style="width:${Math.max(2, v / maxVal * 100)}%"></i></div>
        </td>
        <td class="sa-trend-cell">${trendChip(p)}</td>
        <td class="sa-loc" data-loc="branch">${stockChip(p.branch, T, p, A)}</td>
        <td class="sa-loc" data-loc="warehouse">${stockChip(p.warehouse, T, p, A)}</td>
        <td class="sa-loc" data-loc="online">${stockChip(p.online, T, p, A)}</td>
        <td class="sa-loc" data-loc="total">${totalChip(p, T)}</td>
        <td class="sa-cover-cell">${coverCell(p, A)}</td>
        <td class="sa-mobile-strip">${mobileStrip}</td>
        <td class="sa-action-cell"><div class="sa-action">${esc(p.action)}</div>${tags.length ? `<div class="sa-action__tags">${tags.map(x => `<span class="sa-tag">${esc(x)}</span>`).join('')}</div>` : ''}</td>
      </tr>`;
    });
    els.body.innerHTML = html;
    els.empty.hidden = list.length > 0;
  }

  /* ───────────────────────── Column mapping UI ───────────────────────── */

  function renderMap() {
    const opts = ['<option value="">— not in file —</option>']
      .concat(state.headers.map((h, i) => `<option value="${i}">${esc(h || 'Column ' + (i + 1))}</option>`)).join('');
    els.map.innerHTML = FIELDS.map(f =>
      `<label>${f.label}<select data-field="${f.key}">${opts}</select></label>`).join('');
    els.map.querySelectorAll('select').forEach(sel => {
      const i = state.map[sel.dataset.field];
      sel.value = i != null ? String(i) : '';
    });
    const missing = [];
    if (state.map.name == null && state.map.code == null) missing.push('product');
    if (state.map.units == null && state.map.value == null && state.map.combined == null) missing.push('sales');
    if (state.map.stock == null && state.map.branch == null && state.map.warehouse == null && state.map.online == null) missing.push('stock');
    els.config.classList.toggle('has-warning', missing.length > 0);
    els.configHint.textContent = missing.length
      ? 'Couldn’t find a ' + missing.join(' or ') + ' column. Pick it here'
      : 'Check the tool read your columns correctly';
    if (missing.length) els.config.open = true;
  }

  els.map.addEventListener('change', e => {
    const sel = e.target.closest('select');
    if (!sel) return;
    const f = sel.dataset.field;
    const v = sel.value === '' ? null : parseInt(sel.value, 10);
    // A column can only be one thing
    Object.keys(state.map).forEach(k => { if (k !== f && state.map[k] === v && v != null) delete state.map[k]; });
    if (v == null) delete state.map[f]; else state.map[f] = v;
    if (f === 'units' || f === 'value') delete state.map.combined;
    try { runAnalysis(); renderMap(); render(); setStatus(''); }
    catch (err) { setStatus(err.message, false, true); }
  });

  Object.values(els.th).forEach(inp => inp.addEventListener('input', () => {
    if (!state.data.length) return;
    try { runAnalysis(); render(); } catch (err) { /* keep last good view */ }
  }));

  /* ───────────────────────── Loading a file ───────────────────────── */

  async function handleFile(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    setStatus('Reading ' + esc(file.name) + '…', true);
    try {
      let res;
      if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) res = await readSpreadsheet(file);
      else if (['csv', 'tsv', 'txt'].includes(ext)) res = await readCsvText(file);
      else if (ext === 'pdf' || file.type === 'application/pdf') res = await readPdf(file);
      else if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) res = await readImage(file);
      else throw new Error('That file type isn’t supported. Use Excel, CSV, PDF or an image.');
      loadGrid(res.rows, file.name, [res.note, ext === 'pdf' || /^image\//.test(file.type) ? 'auto-read, check columns' : ''].filter(Boolean).join(' · '));
    } catch (err) {
      console.error(err);
      setStatus(esc(err.message || 'Something went wrong reading that file.'), false, true);
    }
  }

  function loadGrid(rows, label, note) {
    rows = (rows || []).filter(r => Array.isArray(r) && r.some(c => c !== '' && c != null));
    const hi = findHeaderRow(rows);
    if (hi < 0) throw new Error('Couldn’t find a header row (e.g. “Product”, “Units”, “Stock”). Make sure the first rows of your file have column titles.');
    const width = Math.max(...rows.slice(hi).map(r => r.length));
    state.headers = Array.from({ length: width }, (_, i) => String(rows[hi][i] ?? '').trim());
    state.data = rows.slice(hi + 1).map(r => Array.from({ length: width }, (_, i) => r[i] ?? ''));
    state.map = detectColumns(state.headers, state.data);
    state.filter = 'all';
    state.query = '';
    els.search.value = '';
    runAnalysis();

    els.fileName.textContent = label;
    els.fileMeta.textContent = [state.analysis.products.length + ' products', note].filter(Boolean).join(' · ');
    els.uploadWrap.classList.add('is-collapsed');
    els.results.hidden = false;
    setStatus('');
    renderMap();
    render();
    els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ───────────────────────── Sample data ───────────────────────── */

  function sampleRows() {
    return [
      ['Product', 'Code', 'Category', 'Units LW', 'Units Prev Wk', 'Sales £', 'Branch', 'Warehouse', 'Online', 'On order'],
      ['OCT Stag Bust',          'Y33706', 'Ornaments',   128, 96,  6164, 41, 18, 9,  0],
      ['OCT Grumpy Cat',         'W16279', 'Ornaments',   301, 254, 3626, 120, 64, 30, 0],
      ['JAUG Dangly Pump Lite',  'V29609', 'Lighting',     89, 71,  1076, 140, 0,  0, 0],
      ['CO Bronx O And X',       'F32546', 'Decorations',  54, 58,  1218, 60, 6,  4,  0],
      ['JAUG Marble Squash',     'V29610', 'Decorations',  49, 33,   783, 70, 0, null, 0],
      ['CO Fem Ballet Figure',   'H59445', 'Figurines',    80, 92,  2575, 120, 60, 40, 0],
      ['CO Hippo Dancing',       '751599', 'Figurines',    67, 61,  1911, 210, 48, 40, 120],
      ['CO Swan Heart Orn',      'G00055', 'Ornaments',    67, 70,  1359, 150, 25, 30, 0],
      ['SEPT Priscilla Cat',     'G16416', 'Figurines',    43, 30,  1064, 190, 0, 96, 0],
      ['CO Hug Hedgehog Orn',    'V29611', 'Ornaments',    67, 75,   703, 160, 40, 22, 0],
      ['NOV Velvet Robin',       'K22018', 'Ornaments',    38, 12,   494, 160, 210, 70, 0],
      ['NOV Glass Bauble Set',   'K22041', 'Baubles',      22, 41,   418, 180, 520, 140, 0],
      ['CO Mini Gonk Trio',      'B40221', 'Figurines',    15, 26,   224, 210, 380, 90, 200],
      ['SEPT Pumpkin Spice Cand','P11090', 'Home Fragrance', 9, 22,  171, 260, 410, 150, 0],
      ['JAUG Rattan Star',       'V29640', 'Decorations',   0, 4,      0, 85, 120, 40, 0],
      ['OCT Ghost Garland',      'Y33719', 'Decorations',  31, 34,   465, 95, 60, 0, 0],
      ['CO Copper Wire Tree',    'F32601', 'Lighting',     26, 25,   884, 120, 75, 35, 0],
      ['NOV Frosted Pine Wreath','K22077', 'Decorations',  19, 9,    665, 30, 12, 6, 48]
    ];
  }

  /* ───────────────────────── Events ───────────────────────── */

  els.file.addEventListener('change', () => handleFile(els.file.files[0]));
  ['dragenter', 'dragover'].forEach(ev => els.drop.addEventListener(ev, e => {
    e.preventDefault(); els.drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, e => {
    e.preventDefault(); els.drop.classList.remove('is-over');
  }));
  els.drop.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  // Paste a screenshot straight from the clipboard
  document.addEventListener('paste', e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) handleFile(new File([item.getAsFile()], 'pasted-screenshot.png', { type: item.type }));
  });

  els.sample.addEventListener('click', () => {
    try { loadGrid(sampleRows(), 'Sample: Seasonal gifting, last week', 'demo data'); }
    catch (err) { setStatus(esc(err.message), false, true); }
  });

  els.newBtn.addEventListener('click', () => {
    els.results.hidden = true;
    els.uploadWrap.classList.remove('is-collapsed');
    els.file.value = '';
    state.analysis = null;
    setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  els.pills.addEventListener('click', e => {
    const b = e.target.closest('.sa-pill');
    if (!b || b.disabled) return;
    state.filter = b.dataset.key;
    renderPills(state.analysis);
    renderTable(state.analysis);
  });
  els.search.addEventListener('input', () => { state.query = els.search.value; renderTable(state.analysis); });
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; renderTable(state.analysis); });

  els.exportBtn.addEventListener('click', () => {
    const A = state.analysis;
    if (!A) return;
    const pill = PILLS.find(p => p.key === state.filter) || PILLS[0];
    const q = state.query.trim().toLowerCase();
    let list = A.products.filter(pill.test);
    if (q) list = list.filter(p => (p.name + ' ' + p.code).toLowerCase().includes(q));
    list = sorted(list, A);
    const cols = ['Priority', 'Status', 'Product', 'Code', 'Category', 'Units', 'Sales £', 'Prev wk units', 'Trend %',
                  'Branch', 'Warehouse', 'Online', 'Total stock', 'Weeks cover', 'On order', 'Action'];
    const cell = v => {
      if (v == null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.join(',')].concat(list.map(p => [
      p.priority, STATUS[p.status].short, p.name, p.code, p.category, p.units, p.value, p.prevUnits,
      p.trend != null && isFinite(p.trend) ? Math.round(p.trend) : '',
      p.branch, p.warehouse, p.online, p.total, p.cover != null ? p.cover.toFixed(1) : '', p.onOrder, p.action
    ].map(cell).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sales-analysis-' + pill.key + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  // Expose for testing / power users
  window.SalesAnalysis = { loadGrid, detectColumns, findHeaderRow, num };
})();
