/* ============================================================
   SALES ANALYSIS FOR MERCHANDISERS | sales-analysis.js
   Reads weekly sales reports (Excel / CSV / Google-Sheets or Excel
   web-page exports / PDF / image) entirely in the browser.

   Ground rule: the user's data is never changed. Every figure shown
   for a product is the cell text exactly as it appears in the file,
   blanks stay blank, and nothing is estimated or filled in. Parsed
   numbers are used only behind the scenes to sort, filter, colour
   and flag. Anything the tool works out itself (trend %, status,
   action, a cover figure when the file has none) is labelled as such.
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
    topTitle:   $('saTopTitle'),
    config:     $('saConfig'),
    configHint: $('saConfigHint'),
    map:        $('saMap'),
    pills:      $('saPills'),
    search:     $('saSearch'),
    sort:       $('saSort'),
    table:      $('saTable'),
    head:       $('saHead'),
    body:       $('saBody'),
    empty:      $('saEmpty'),
    breakdowns: $('saBreakdowns'),
    bdGrid:     $('saBdGrid'),
    origWrap:   $('saOriginalWrap'),
    sheets:     $('saSheets'),
    origHint:   $('saOriginalHint'),
    th: {
      reorderWks: $('saReorderWks'),
      watchWks:   $('saWatchWks'),
      overWks:    $('saOverWks'),
      lowLoc:     $('saLowLoc'),
      goodLoc:    $('saGoodLoc'),
      trendPct:   $('saTrendPct'),
      returnsPct: $('saReturnsPct')
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
        s.onerror = () => reject(new Error('Could not load a file reader. Check your connection and try again.'));
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

  // Formatters below are only ever used for figures the tool CALCULATES
  // (sums, shares). They never round away pence or decimals.
  const fmtGBP = v => v == null ? '—' :
    '£' + v.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
  const fmtNum = v => v == null ? '—' : v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const fmtPct = v => (v > 0 ? '+' : '') + Math.round(v) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BLANK = '<span class="sa-blank">blank</span>';

  // "£1,234.50", "1 234", "(12)", "12%", "-", "" → number | null (never guesses)
  function num(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s || /^[-–—]+$/.test(s)) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[£$€,\s%]/g, '').replace(/units?$/i, '');
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
  const isBlankRow = r => !r || !r.some(c => String(c ?? '').trim() !== '');

  /* ───────────────────────── Fields ───────────────────────── */

  const FIELDS = [
    { key: 'name',           label: 'Product name / description' },
    { key: 'code',           label: 'SKU / item number' },
    { key: 'category',       label: 'Category / sub group' },
    { key: 'price',          label: 'Sell price' },
    { key: 'units',          label: 'Units sold (total, last week)' },
    { key: 'value',          label: 'Sales £ (total, last week)' },
    { key: 'prevUnits',      label: 'Units sold (week before)' },
    { key: 'prevValue',      label: 'Sales £ (week before)' },
    { key: 'retailUnits',    label: 'Retail / branch units sold' },
    { key: 'retailValue',    label: 'Retail / branch sales £' },
    { key: 'onlineUnits',    label: 'Online units (orders)' },
    { key: 'onlineValue',    label: 'Online sales £ (orders)' },
    { key: 'stock',          label: 'Stock (total / retail)' },
    { key: 'branch',         label: 'Branch stock' },
    { key: 'warehouse',      label: 'Warehouse stock' },
    { key: 'online',         label: 'Online stock' },
    { key: 'branchCover',    label: 'Branch cover (weeks)' },
    { key: 'warehouseCover', label: 'Warehouse cover (weeks)' },
    { key: 'onlineCover',    label: 'Online cover (weeks)' },
    { key: 'totalCover',     label: 'Total cover (weeks)' },
    { key: 'onOrder',        label: 'On order' },
    { key: 'returns',        label: 'Returns rate' },
    { key: 'distribution',   label: 'Distribution / grade' }
  ];
  const NUMERIC = new Set(['price', 'units', 'value', 'prevUnits', 'prevValue', 'retailUnits', 'retailValue',
    'onlineUnits', 'onlineValue', 'stock', 'branch', 'warehouse', 'online', 'branchCover', 'warehouseCover',
    'onlineCover', 'totalCover', 'onOrder', 'returns']);

  const RX = {
    code:      /(code|sku|\bref\b|reference|barcode|\bean\b|\bupc\b|\bplu\b|article|style ?(no|num|number)\b|item ?(no|num|number)\b|^id$|\bid\b)/,
    nameStrong:/(description|^desc\b|product ?name|^product$|item ?name|^item$|^name$|style ?name|^title$)/,
    name:      /\b(product|description|desc|item|name|title|style)\b/,
    category:  /\b(category|cat|dept|department|division|class|range|sub ?group|group|sub ?cat)\b/,
    price:     /(price|\brrp\b|\bsp\b)/,
    rank:      /\brank(ing)?\b/,
    cover:     /(cover|\bwoc\b|weeks? ?(of )?stock|\bwks\b)/,
    returns:   /return/,
    distrib:   /(distribution|\bgrade\b|cluster|store ?grade)/,
    stock:     /\b(stock|soh|on ?hand|inventory|available|avail|holding)\b/,
    branchLoc: /\b(branch|branches|store|stores|shop|shops)\b/,
    retail:    /\b(retail|branch|branches|store|stores|shop|shops)\b/,
    warehouse: /(warehouse|w\/h|\bwh\b|\bdc\b|depot|central)/,
    online:    /(online|\bweb\b|website|e-?com|digital|dotcom|\.com)/,
    onOrder:   /(on ?order|intake|\bdue\b|in ?transit|\bpo\b|open ?orders?|outstanding)/,
    valueMark: /(£|\$|€|\bvalue\b|\bv\b|\bv\(|revenue|turnover|takings|amount|\bnet\b|\bgross\b|\bsales\b|£k)/,
    unitsMark: /(\(u\)|\bu\b|units?|\bqty\b|quantity|volume|\bsold\b|\bpcs\b|pieces|orders? taken|\borders\b)/,
    prevStrong:/(prev|prior|previous|week ?before|2 ?w(ee)?ks?|wk ?-? ?2|w ?-? ?2|lw ?-? ?1|last ?year|\bly\b|lwly)/,
    lastWeek:  /(last ?week|\blw\b)/,
    thisWeek:  /(this ?week|\btw\b|\bty\b|current|latest|wk ?0)/,
    skipRow:   /^(grand )?total\b|^sub ?total\b|^totals?$|^all products$/i,
    attrHead:  /(type|colou?r|size|category|group|department|range|material|theme|finish|collection|channel)\s*$/
  };

  // How "header-like" a row is (used to find header rows)
  function headerScore(row) {
    const tests = [RX.code, RX.name, RX.category, RX.price, RX.cover, RX.stock, RX.retail, RX.warehouse,
                   RX.online, RX.onOrder, RX.valueMark, RX.unitsMark, RX.rank, RX.returns];
    let s = 0;
    row.forEach(c => {
      const h = norm(c);
      if (!h || num(h) != null) return;
      if (tests.some(t => t.test(h))) s++;
    });
    return s;
  }
  function findHeaderRow(rows) {
    let best = -1, bestScore = 1;
    const limit = Math.min(rows.length, 30);
    for (let i = 0; i < limit; i++) {
      const sc = headerScore(rows[i] || []);
      if (sc > bestScore) { best = i; bestScore = sc; }
    }
    return best;
  }

  function textyColumn(rows, col) {
    let t = 0, seen = 0;
    for (const r of rows.slice(0, 40)) {
      const v = r[col];
      if (v == null || String(v).trim() === '') continue;
      seen++;
      if (num(v) == null) t++;
    }
    return seen > 0 && t / seen > 0.6;
  }
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
  function weekNumber(h) {
    const m = h.match(/w(?:ee)?k\s*-?\s*(\d{1,2})\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Group-aware column detection. `heads` are the header-row labels,
  // `groups` the merged labels above them (e.g. "Retail", "Online").
  function detectColumns(heads, groups, data) {
    const H = heads.map(norm), G = groups.map(norm);
    const map = { ranks: [] };
    const used = new Set();
    const take = (key, i) => {
      if (i == null || i < 0 || used.has(i) || map[key] != null) return false;
      map[key] = i; used.add(i); return true;
    };
    const cols = H.map((h, i) => ({ i, h, g: G[i] || '', both: ((G[i] || '') + ' ' + h).trim() }))
      .filter(c => c.h);

    // Combined "£x / n units" cells (from screenshots of the reference layout)
    cols.forEach(c => {
      if (map.combined == null && looksCombined(data, c.i)) { map.combined = c.i; used.add(c.i); }
    });

    // Identity columns
    cols.forEach(c => { if (!used.has(c.i) && RX.rank.test(c.h)) { map.ranks.push(c.i); used.add(c.i); } });
    for (const c of cols) if (!used.has(c.i) && RX.code.test(c.h)) { take('code', c.i); break; }
    for (const c of cols) if (!used.has(c.i) && RX.nameStrong.test(c.h) && textyColumn(data, c.i)) { take('name', c.i); break; }
    if (map.name == null) for (const c of cols) if (!used.has(c.i) && RX.name.test(c.h) && textyColumn(data, c.i)) { take('name', c.i); break; }
    for (const c of cols) if (!used.has(c.i) && RX.category.test(c.h) && textyColumn(data, c.i)) { take('category', c.i); break; }
    for (const c of cols) if (!used.has(c.i) && RX.price.test(c.h)) { take('price', c.i); break; }
    for (const c of cols) if (!used.has(c.i) && RX.distrib.test(c.h)) { take('distribution', c.i); break; }

    // Cover (weeks) columns: the file's own figures
    cols.forEach(c => {
      if (used.has(c.i) || !RX.cover.test(c.h)) return;
      if (RX.branchLoc.test(c.h)) take('branchCover', c.i);
      else if (RX.warehouse.test(c.h)) take('warehouseCover', c.i);
      else if (RX.online.test(c.h) || (RX.online.test(c.g) && !/total/.test(c.h))) take('onlineCover', c.i);
      else take('totalCover', c.i);
    });
    cols.forEach(c => { if (!used.has(c.i) && RX.returns.test(c.h)) take('returns', c.i); });
    cols.forEach(c => { if (!used.has(c.i) && RX.onOrder.test(c.h)) take('onOrder', c.i); });

    // Stock (units) columns
    cols.forEach(c => {
      if (used.has(c.i) || !RX.stock.test(c.h)) return;
      if (RX.online.test(c.h) || RX.online.test(c.g)) take('online', c.i);
      else if (RX.warehouse.test(c.h)) take('warehouse', c.i);
      else if (RX.branchLoc.test(c.h)) take('branch', c.i);
      else take('stock', c.i);
    });
    // Bare location headings ("Branch", "Warehouse", "Online") with numbers = stock
    cols.forEach(c => {
      if (used.has(c.i) || textyColumn(data, c.i)) return;
      if (RX.unitsMark.test(c.h) || RX.valueMark.test(c.h)) return;
      if (RX.warehouse.test(c.h)) take('warehouse', c.i);
      else if (RX.online.test(c.h)) take('online', c.i);
      else if (RX.branchLoc.test(c.h)) take('branch', c.i);
    });

    // Sales columns: work out kind (units / £), channel and week
    const buckets = {};
    cols.forEach(c => {
      if (used.has(c.i) || textyColumn(data, c.i)) return;
      const kind = RX.valueMark.test(c.h) ? 'value' : RX.unitsMark.test(c.h) ? 'units' : null;
      if (!kind) return;
      const channel = (RX.online.test(c.h) || RX.online.test(c.g)) ? 'online'
                    : (RX.retail.test(c.h) || RX.retail.test(c.g)) ? 'retail' : 'total';
      (buckets[channel + ':' + kind] = buckets[channel + ':' + kind] || []).push(c.i);
    });
    const pickCurrentPrev = list => {
      if (!list || !list.length) return [null, null];
      if (list.length === 1) return [list[0], RX.prevStrong.test(H[list[0]]) ? null : null];
      const anyThis = list.some(i => RX.thisWeek.test(H[i]));
      const prevness = i => {
        const h = H[i] + ' ' + (G[i] || '');
        let p = 0;
        if (RX.prevStrong.test(h)) p += 2;
        if (RX.lastWeek.test(h) && anyThis) p += 1;
        if (RX.thisWeek.test(h)) p -= 1;
        return p;
      };
      const sorted = list.slice().sort((a, b) => {
        const d = prevness(a) - prevness(b);
        if (d) return d;
        const wa = weekNumber(H[a]), wb = weekNumber(H[b]);
        if (wa != null && wb != null && wa !== wb) return wb - wa;
        return b - a;
      });
      return [sorted[0], sorted[1]];
    };
    const [u, pu] = pickCurrentPrev(buckets['total:units']);
    const [v, pv] = pickCurrentPrev(buckets['total:value']);
    take('units', u); take('prevUnits', pu);
    take('value', v); take('prevValue', pv);
    take('retailUnits', pickCurrentPrev(buckets['retail:units'])[0]);
    take('retailValue', pickCurrentPrev(buckets['retail:value'])[0]);
    take('onlineUnits', pickCurrentPrev(buckets['online:units'])[0]);
    take('onlineValue', pickCurrentPrev(buckets['online:value'])[0]);

    // Last resort for the name: first remaining text column
    if (map.name == null) for (const c of cols) {
      if (!used.has(c.i) && !/^(action|status|notes?|comments?|priority)$/.test(c.h) && textyColumn(data, c.i)) { take('name', c.i); break; }
    }
    return map;
  }

  /* ───────────────────────── Readers → tables ───────────────────────── */
  // Every reader returns [{ name, rows, text }] where `rows` holds values for
  // maths and `text` holds the exact cell text for display.

  async function readSpreadsheet(file) {
    await loadScript(LIB.xlsx);
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map(sn => {
      const ws = wb.Sheets[sn];
      const opts = { header: 1, defval: '', blankrows: true };
      const rows = window.XLSX.utils.sheet_to_json(ws, { ...opts, raw: true });
      const text = window.XLSX.utils.sheet_to_json(ws, { ...opts, raw: false });
      // Merged header cells (e.g. "Retail" over several columns) only hold
      // their text in the first cell; record the span so every column under
      // it knows its group. The cells themselves are not modified.
      const spans = [];
      (ws['!merges'] || []).forEach(m => {
        if (m.s.r === m.e.r && m.e.c > m.s.c) spans.push({ r: m.s.r, c0: m.s.c, c1: m.e.c });
      });
      // sheet_to_json starts at the sheet's first used row/col; offset spans to match
      const ref = ws['!ref'] ? window.XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 } };
      spans.forEach(s => { s.r -= ref.s.r; s.c0 -= ref.s.c; s.c1 -= ref.s.c; });
      return { name: sn, file: file.name, rows, text, spans, firstRow: ref.s.r + 1,
               empty: !rows.some(r => !isBlankRow(r)) };
    });
  }

  // Google Sheets "Download → Web page" gives a .zip of one .html per sheet
  async function readZip(file) {
    await loadScript(LIB.xlsx);
    const zip = window.XLSX.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const entries = zip.FileIndex.map((e, i) => ({ e, path: zip.FullPaths[i] }))
      .filter(x => x.e.type === 2 && x.e.content && x.e.content.length)
      .filter(x => /\.(html?|csv|tsv|xlsx|xls|xlsm|ods)$/i.test(x.path) && !/(^|\/)(resources|__macosx)\//i.test(x.path))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    if (!entries.length) throw new Error('That zip has no spreadsheet or web-page files inside.');
    const out = [];
    for (const x of entries) {
      const base = x.path.split('/').pop();
      const inner = new File([new Uint8Array(x.e.content)], base, { type: /html?$/i.test(base) ? 'text/html' : '' });
      (await readFile(inner)).forEach(t => { t.file = file.name; out.push(t); });
    }
    return out;
  }

  async function readCsv(file) {
    await loadScript(LIB.xlsx);
    const wb = window.XLSX.read(await file.text(), { type: 'string', raw: true });
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, rawNumbers: false, defval: '', blankrows: true });
    return [{ name: file.name, rows, text: rows, spans: [], firstRow: 1 }];
  }

  // HTML tables (Google Sheets "Web page" export, Excel "Save as web page", etc.)
  async function readHtml(file) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    const tables = [...doc.querySelectorAll('table')];
    if (!tables.length) throw new Error('No table found in that web page file.');
    return tables.map((tbl, ti) => {
      const grid = [];
      const spans = [];
      const occupied = [];
      let r = 0;
      for (const tr of tbl.rows) {
        const cells = [...tr.cells].filter(c =>
          !/row-header|row-headers-background|freezebar/.test(c.className || ''));   // Google's row numbers
        // Google's A, B, C… column-letter row
        if (cells.length && cells.every(c => /column-headers-background/.test(c.className || ''))) continue;
        grid[r] = grid[r] || [];
        let c = 0;
        for (const cell of cells) {
          while (occupied[r] && occupied[r][c]) c++;
          const txt = (cell.innerText != null ? cell.innerText : cell.textContent).replace(/ /g, ' ').trim();
          const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
          const rs = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10));
          grid[r][c] = txt;
          for (let k = 1; k < cs; k++) grid[r][c + k] = '';
          if (cs > 1 && rs === 1) spans.push({ r, c0: c, c1: c + cs - 1 });
          for (let y = 1; y < rs; y++) {
            occupied[r + y] = occupied[r + y] || [];
            for (let k = 0; k < cs; k++) occupied[r + y][c + k] = true;
          }
          c += cs;
        }
        r++;
      }
      const rows = grid.map(row => Array.from({ length: row ? row.length : 0 }, (_, i) => (row && row[i] != null ? row[i] : '')));
      const base = file.name.replace(/^[0-9a-f]{8}-/, '').replace(/\.html?$/i, '');
      const name = tables.length > 1 ? base + ' (table ' + (ti + 1) + ')' : base;
      return { name, file: file.name, rows, text: rows, spans, firstRow: 1, empty: !rows.some(r => !isBlankRow(r)) };
    });
  }

  // Positioned text (PDF items / OCR words) → grid, snapping text to header columns
  function gridFromPositioned(lines) {
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
    const grid = asCells.slice(0, hi).map(c => c.map(x => x.str));
    grid.push(header.map(c => c.str));
    for (let i = hi + 1; i < asCells.length; i++) {
      const row = new Array(header.length).fill('');
      asCells[i].forEach(c => {
        const cx = (c.x0 + c.x1) / 2;
        let k = 0, d = Infinity;
        centres.forEach((hc, j) => {
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
    const all = [];
    let yOffset = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4];
        all.push({ x0: x, x1: x + (it.width || it.str.length * 5), y: vp.height - it.transform[5] + yOffset, str: it.str.trim() });
      });
      yOffset += vp.height + 50;
    }
    if (!all.length) throw new Error('This PDF has no readable text (it may be a scan). Try uploading it as an image instead.');
    const rows = gridFromPositioned(groupIntoLines(all, 3));
    return [{ name: file.name, rows, text: rows, spans: [], firstRow: 1, autoRead: true }];
  }

  async function readImage(file) {
    setStatus('Loading text recognition… (first time can take a few seconds)', true);
    await loadScript(LIB.ocr);
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: m => { if (m.status === 'recognizing text') setStatus('Reading your image… ' + Math.round(m.progress * 100) + '%', true); }
    });
    try {
      const { data } = await worker.recognize(file);
      const items = [];
      (data.words || []).forEach(w => {
        if (!w.text || !w.text.trim() || w.confidence < 25) return;
        items.push({ x0: w.bbox.x0, x1: w.bbox.x1, y: (w.bbox.y0 + w.bbox.y1) / 2, str: w.text.trim(), h: w.bbox.y1 - w.bbox.y0 });
      });
      if (!items.length) throw new Error('No text could be read from that image. Try a sharper screenshot or the original spreadsheet.');
      const tol = Math.max(6, median(items.map(i => i.h)) * 0.6);
      const rows = gridFromPositioned(groupIntoLines(items, tol));
      return [{ name: file.name, rows, text: rows, spans: [], firstRow: 1, autoRead: true }];
    } finally {
      worker.terminate();
    }
  }

  async function readFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(ext)) return readSpreadsheet(file);
    if (ext === 'zip' || /zip/.test(file.type)) return readZip(file);
    if (['csv', 'tsv', 'txt'].includes(ext)) return readCsv(file);
    if (['html', 'htm'].includes(ext) || file.type === 'text/html') return readHtml(file);
    if (ext === 'pdf' || file.type === 'application/pdf') return readPdf(file);
    if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return readImage(file);
    throw new Error('“' + file.name + '” isn’t a supported file. Use Excel, CSV, a web-page (.html or .zip) export, PDF or an image.');
  }

  /* ───────────────────────── Table preparation ───────────────────────── */

  // Header row + merged group labels above it → one entry per column
  function prepareTable(t) {
    const rows = t.rows, text = t.text;
    const hi = findHeaderRow(rows.map((r, i) => (text[i] || r).map(String)));
    if (hi < 0) return null;
    const width = Math.max(...rows.slice(Math.max(0, hi - 1)).map(r => (r || []).length));
    const pad = r => Array.from({ length: width }, (_, i) => (r || [])[i] ?? '');
    const heads = pad(text[hi]).map(h => String(h).trim());
    const groups = new Array(width).fill('');
    // Group labels from merged cells in the row above
    (t.spans || []).filter(s => s.r === hi - 1).forEach(s => {
      const label = String((text[hi - 1] || [])[s.c0] ?? '').trim();
      for (let c = s.c0; c <= s.c1 && c < width; c++) groups[c] = label;
    });
    // …and plain single cells in that row sitting directly above a header
    if (hi > 0) pad(text[hi - 1]).forEach((g, c) => {
      g = String(g).trim();
      if (g && !groups[c] && heads[c] && num(g) == null) groups[c] = g;
    });
    const labels = heads.map((h, i) => groups[i] && h ? groups[i] + ' · ' + h : (h || (groups[i] ? groups[i] : '')));
    return {
      name: t.name,
      heads, groups, labels,
      data: rows.slice(hi + 1).map(pad),
      text: text.slice(hi + 1).map(r => pad(r).map(c => String(c ?? ''))),
      rowOffset: (t.firstRow || 1) + hi + 1,
      autoRead: !!t.autoRead
    };
  }

  // A product table has a SKU column, or product names with sales/stock and no repeated header blocks.
  function classify(pt) {
    const map = detectColumns(pt.heads, pt.groups, pt.data);
    const hasMeasure = ['units', 'value', 'retailUnits', 'onlineUnits', 'stock', 'branch', 'warehouse', 'online',
      'branchCover', 'warehouseCover', 'onlineCover', 'totalCover', 'combined'].some(k => map[k] != null);
    const firstHead = norm(pt.heads.find(h => h) || '');
    const repeatedHeaders = pt.text.filter(r => headerScore(r) >= 2).length;
    const looksAttribute = map.code == null && (RX.attrHead.test(firstHead) || repeatedHeaders > 0);
    const kind = looksAttribute ? 'breakdown' : ((map.code != null || map.name != null) && hasMeasure ? 'products' : 'breakdown');
    return { map, kind };
  }

  /* ───────────────────────── Products ───────────────────────── */

  function buildProducts(pt, map) {
    const out = [];
    const skipped = { totals: 0, headers: 0, notes: 0 };
    let totalRow = null;
    const headerSig = pt.heads.map(norm).join('|');
    pt.data.forEach((r, idx) => {
      const tr = pt.text[idx];
      const filled = tr.filter(c => c.trim() !== '').length;
      if (!filled) return;
      if (tr.map(norm).join('|') === headerSig) { skipped.headers++; return; }
      const txt = k => map[k] != null ? tr[map[k]].trim() : undefined;
      const name = txt('name') || '';
      const code = txt('code') || '';
      const firstText = (tr.find(c => c.trim() !== '') || '').trim();
      if (RX.skipRow.test(name) || RX.skipRow.test(code) || RX.skipRow.test(firstText)) {
        skipped.totals++;
        if (!totalRow) totalRow = { idx, text: tr };
        return;
      }
      if (!name && !code) { skipped.notes++; return; }
      if (filled === 1) { skipped.notes++; return; }               // heading / note line

      const src = {};
      const val = {};
      FIELDS.forEach(f => {
        src[f.key] = txt(f.key);
        // Work from the value as displayed (what the user sees in Excel: "3", "7%"),
        // not Excel's hidden underlying number (2.5, 0.07), so every flag and
        // colour agrees with the figure on screen. Fall back to the raw value
        // only if the displayed text isn't a number.
        if (NUMERIC.has(f.key)) val[f.key] = map[f.key] != null ? (num(tr[map[f.key]]) ?? num(r[map[f.key]])) : undefined;
      });
      if (map.combined != null) {
        const c = tr[map.combined];
        const mv = c.match(/[£$€]\s?[\d,]+(?:\.\d+)?/);
        const mu = c.match(/([\d,]+(?:\.\d+)?)\s*units?/i);
        if (src.value === undefined) { src.value = mv ? mv[0].replace(/\s/g, '') : ''; val.value = mv ? num(mv[0]) : null; }
        if (src.units === undefined) { src.units = mu ? mu[1] : ''; val.units = mu ? num(mu[1]) : null; }
      }
      out.push({ idx, cells: tr, src, ...val, name, code, category: src.category || '' });
    });
    return { products: out, skipped, totalRow };
  }

  /* ───────────────────────── Analysis ───────────────────────── */

  const STATUS = {
    act:    { label: 'Act now: reorder',            short: 'Act now',     colour: 'var(--red)', pri: 'act' },
    watch:  { label: 'Watch',                       short: 'Watch',       colour: '#f7b955',    pri: 'watch' },
    ok:     { label: 'Healthy',                     short: 'Healthy',     colour: '#5fd884',    pri: 'ok' },
    over:   { label: 'Overstocked',                 short: 'Overstock',   colour: '#4c8dff',    pri: 'over' },
    idle:   { label: 'No sales last week',          short: 'No sales',    colour: '#8a8a92',    pri: 'idle' },
    nodata: { label: 'Sales figure blank in file',  short: 'Sales blank', colour: '#55555c',    pri: 'idle' },
    check:  { label: 'Check the figures: negative values in file', short: 'Check data', colour: '#c58bff', pri: 'check' }
  };
  const STATUS_ORDER = ['act', 'watch', 'check', 'ok', 'over', 'idle', 'nodata'];
  const NEG_KEYS = ['units', 'retailUnits', 'onlineUnits', 'stock', 'branch', 'warehouse', 'online',
                    'branchCover', 'warehouseCover', 'onlineCover', 'totalCover'];

  function thresholds() {
    const v = (el, d) => { const n = parseFloat(el.value); return isFinite(n) && n >= 0 ? n : d; };
    return {
      reorder: v(els.th.reorderWks, 2),
      watch:   Math.max(v(els.th.watchWks, 4), v(els.th.reorderWks, 2)),
      over:    v(els.th.overWks, 12),
      lowLoc:  v(els.th.lowLoc, 5),
      goodLoc: Math.max(v(els.th.goodLoc, 9), v(els.th.lowLoc, 5) + 1),
      trend:   v(els.th.trendPct, 10),
      returns: v(els.th.returnsPct, 10)
    };
  }

  const sumKnown = (...xs) => { const k = xs.filter(x => x != null); return k.length ? k.reduce((a, b) => a + b, 0) : null; };

  function analyse(products, has) {
    const T = thresholds();
    const locCoverMode = has.branchCover || has.warehouseCover || has.onlineCover;

    products.forEach(p => {
      // Sales used for ranking only (never displayed as a new figure)
      p.rankUnits = p.units != null ? p.units : sumKnown(p.retailUnits, p.onlineUnits);
      p.rankValue = p.value != null ? p.value : sumKnown(p.retailValue, p.onlineValue);

      // Cover: the file's own Total Cover when it has one, otherwise calculated
      if (has.totalCover) {
        p.cover = p.totalCover; p.coverCalc = false; p.stockExcludes = [];
      } else {
        const locs = [['branch', p.branch], ['warehouse', p.warehouse], ['online', p.online]].filter(([, v]) => v !== undefined);
        const known = locs.filter(([, v]) => v != null);
        p.stockExcludes = p.stock !== undefined ? [] : locs.filter(([, v]) => v == null).map(([k]) => k);
        const total = p.stock !== undefined ? p.stock : (known.length ? known.reduce((a, [, v]) => a + v, 0) : null);
        p.cover = (total != null && p.rankUnits > 0) ? total / p.rankUnits : null;
        p.coverCalc = true;
        p.totalStockCalc = total;
      }
      p.coverInclOrder = (p.coverCalc && p.cover != null && p.onOrder) ? (p.totalStockCalc + p.onOrder) / p.rankUnits : p.cover;

      if (p.prevUnits != null && p.units != null) {
        p.trend = p.prevUnits > 0 ? (p.units - p.prevUnits) / p.prevUnits * 100 : (p.units > 0 ? Infinity : 0);
      } else if (p.prevValue != null && p.value != null) {
        p.trend = p.prevValue > 0 ? (p.value - p.prevValue) / p.prevValue * 100 : (p.value > 0 ? Infinity : 0);
      } else p.trend = null;
    });

    const sellers = products.filter(p => (p.rankUnits || 0) > 0 || (p.rankValue || 0) > 0);
    // Per-store-count detection (only when we're calculating cover from stock units)
    const withCover = sellers.filter(p => p.cover != null && p.coverCalc);
    const relative = !locCoverMode && !has.totalCover && withCover.length >= 4 &&
      withCover.filter(p => p.cover < T.reorder).length / withCover.length > 0.8;

    const salesKey = p => (p.rankValue != null ? p.rankValue : (p.rankUnits || 0));
    const ranked = products.slice().sort((a, b) => salesKey(b) - salesKey(a));
    const n = ranked.length;
    ranked.forEach((p, i) => { p.salesPct = n > 1 ? i / (n - 1) : 0; });
    const medianUnits = median(sellers.map(p => p.rankUnits || 0));
    const pressureRank = new Map();
    if (relative) {
      const pr = withCover.slice().sort((a, b) => a.cover - b.cover);
      pr.forEach((p, i) => pressureRank.set(p, pr.length > 1 ? i / (pr.length - 1) : 0));
    }

    products.forEach(p => {
      const unitsBlank = p.rankUnits == null && p.rankValue == null;
      const selling = (p.rankUnits || 0) > 0 || (p.rankUnits == null && (p.rankValue || 0) > 0);
      const locKeys = locCoverMode ? ['branchCover', 'warehouseCover', 'onlineCover'] : ['branch', 'warehouse', 'online'];
      const locs = locKeys.map(k => [k, p[k]]).filter(([, v]) => v !== undefined);
      const zeroLocs = locs.filter(([, v]) => v === 0).map(([k]) => k.replace('Cover', ''));
      const lowLocs = locs.filter(([, v]) => v != null && v <= T.lowLoc).map(([k]) => k.replace('Cover', ''));

      p.flags = new Set();
      if (selling && (zeroLocs.length || p.stock === 0 || p.totalCover === 0)) p.flags.add('outOfStock');
      if (selling && (p.online === 0 || p.onlineCover === 0)) p.flags.add('onlineGap');
      if (p.trend != null && p.trend >= T.trend) p.flags.add('improving');
      if (p.trend != null && p.trend <= -T.trend) p.flags.add('declining');
      if (selling && p.salesPct <= 0.2) p.flags.add('highSales');
      if (!unitsBlank && (p.salesPct >= 0.8 || !selling)) p.flags.add('lowSales');
      if (p.returns != null && p.returns >= T.returns) p.flags.add('highReturns');

      let status;
      const cover = p.coverInclOrder;
      p.negatives = NEG_KEYS.filter(k => p[k] != null && p[k] < 0);
      if (p.negatives.length) status = 'check';
      else if (unitsBlank) status = 'nodata';
      else if (!selling) status = 'idle';
      else if (locCoverMode) {
        const whLow = p.warehouseCover != null && p.warehouseCover <= T.lowLoc;
        const sellLow = (p.branchCover != null && p.branchCover <= T.lowLoc) || (p.onlineCover != null && p.onlineCover <= T.lowLoc);
        const strong = p.salesPct <= 0.5;
        if ((whLow && sellLow && strong) || (cover != null && cover < T.reorder) || (zeroLocs.length && p.salesPct <= 0.25)) status = 'act';
        else if (lowLocs.length || (cover != null && cover < T.watch)) status = 'watch';
        else if (cover != null && cover > T.over) status = 'over';
        else status = 'ok';
      } else if (relative) {
        const pr = pressureRank.get(p);
        const strong = p.salesPct <= 0.5;
        if ((pr != null && pr <= 0.3 && strong) || (zeroLocs.length && strong) || (lowLocs.length >= 2 && strong)) status = 'act';
        else if ((pr != null && pr <= 0.6) || zeroLocs.length || lowLocs.length) status = 'watch';
        else status = 'ok';
      } else if (cover == null) {
        status = zeroLocs.length ? ((p.rankUnits || 0) >= medianUnits ? 'act' : 'watch') : 'watch';
      } else if (cover < T.reorder || p.totalStockCalc === 0) status = 'act';
      else if (zeroLocs.length && (p.rankUnits || 0) >= medianUnits) status = 'act';
      else if (cover < T.watch || zeroLocs.length) status = 'watch';
      else if (cover > T.over) status = 'over';
      else status = 'ok';
      p.status = status;

      if (status !== 'check' && selling && (status === 'act' || (status === 'watch' && (lowLocs.length || (cover != null && cover < T.watch))) || p.flags.has('outOfStock'))) p.flags.add('runningOut');
      if (status === 'over') p.flags.add('overstock');

      const velocity = salesKey(p) || 0;
      const coverForScore = relative ? (pressureRank.get(p) ?? 1) * 4
        : locCoverMode ? Math.min(...locs.map(([, v]) => v).filter(v => v != null), cover ?? 99, 99)
        : (cover != null ? cover : 2);
      p.score = velocity / Math.max(coverForScore, 0.15) + zeroLocs.length * velocity * 0.25;

      const actions = [];
      if (status === 'act') actions.push('Reorder');
      else if (status === 'watch') actions.push('Watch');
      else if (status === 'over') actions.push(p.trend != null && p.trend < 0 ? 'Markdown / promote' : 'Hold orders');
      else if (status === 'idle') actions.push('Review: no sales');
      else if (status === 'nodata') actions.push('Check file: sales blank');
      else if (status === 'check') actions.push('Check file: negative ' + p.negatives.map(k => (p.sheet.pt.labels[p.sheet.map[k]] || k)).join(', '));
      else actions.push('On track');
      const onlineEmpty = p.onlineCover === 0 || p.online === 0;
      const retailHas = (p.branchCover || 0) > 0 || (p.branch || 0) > 0 || (p.warehouse || 0) > 0 || (p.warehouseCover || 0) > 0 || (p.stock || 0) > 0;
      if (status !== 'check' && selling && onlineEmpty && retailHas) actions.push('fill online');
      if (selling && locCoverMode && p.branchCover != null && p.branchCover <= T.lowLoc && (p.warehouseCover || 0) >= T.goodLoc) actions.push('send to branch');
      if (selling && !locCoverMode && p.branch === 0 && (p.warehouse || 0) > 0) actions.push('send to branch');
      if (selling && (p.warehouse === 0 || p.warehouseCover === 0) && status !== 'act') actions.push('warehouse empty');
      if (p.flags.has('highReturns')) actions.push('check returns');
      p.action = actions[0] + (actions.length > 1 ? ', ' + actions.slice(1).join(', ') : '');
    });

    return { products, relative, locCoverMode, T, has };
  }

  /* ───────────────────────── State ───────────────────────── */

  const state = {
    sheets: [], edit: 0, analysis: null, skipped: null,
    breakdowns: [], filter: 'all', sort: 'priority', query: '', open: new Set()
  };

  const PILLS = [
    { key: 'all',         label: 'All products',       dot: null,          test: () => true },
    { key: 'act',         label: 'Reorder now',        dot: 'var(--red)',  test: p => p.status === 'act' },
    { key: 'runningOut',  label: 'Running out',        dot: '#ff6b84',     test: p => p.flags.has('runningOut') },
    { key: 'outOfStock',  label: 'Sold out somewhere', dot: '#ff6b84',     test: p => p.flags.has('outOfStock') },
    { key: 'highSales',   label: 'High sales',         dot: '#4c8dff',     test: p => p.flags.has('highSales') },
    { key: 'lowSales',    label: 'Low sales',          dot: '#8a8a92',     test: p => p.flags.has('lowSales') },
    { key: 'improving',   label: 'Improving',          dot: '#5fd884',     test: p => p.flags.has('improving'), needs: 'trend' },
    { key: 'declining',   label: 'Declining',          dot: '#f7b955',     test: p => p.flags.has('declining'), needs: 'trend' },
    { key: 'onlineGap',   label: 'Online gaps',        dot: '#f7b955',     test: p => p.flags.has('onlineGap'), needs: 'onlineAny' },
    { key: 'highReturns', label: 'High returns',       dot: '#c58bff',     test: p => p.flags.has('highReturns'), needs: 'returns' },
    { key: 'overstock',   label: 'Overstocked',        dot: '#4c8dff',     test: p => p.flags.has('overstock') },
    { key: 'watch',       label: 'Watch',              dot: '#f7b955',     test: p => p.status === 'watch' },
    { key: 'ok',          label: 'Healthy',            dot: '#5fd884',     test: p => p.status === 'ok' }
  ];

  function setStatus(msg, busy, isError) {
    if (!msg) { els.status.hidden = true; return; }
    els.status.hidden = false;
    els.status.classList.toggle('is-error', !!isError);
    els.status.innerHTML = (busy ? '<span class="sa-spin" aria-hidden="true"></span>' : '') + '<span>' + msg + '</span>';
  }

  function runAnalysis() {
    const P = [];
    state.skipped = { totals: 0, headers: 0, notes: 0 };
    state.sheets.forEach((sh, si) => {
      const built = buildProducts(sh.pt, sh.map);
      sh.totalRow = built.totalRow;
      sh.count = built.products.length;
      Object.keys(state.skipped).forEach(k => { state.skipped[k] += built.skipped[k]; });
      built.products.forEach(p => { p.sheet = sh; p.uid = si * 1e6 + p.idx; P.push(p); });
    });
    if (!P.length) throw new Error('Couldn’t find any product rows. Open “Columns & thresholds” and pick the product name and SKU columns.');
    const has = {};
    const any = k => state.sheets.some(sh => sh.map[k] != null);
    FIELDS.forEach(f => { has[f.key] = any(f.key) || ((f.key === 'units' || f.key === 'value') && any('combined')); });
    has.trend = P.some(p => p.prevUnits != null || p.prevValue != null);
    has.onlineAny = has.online || has.onlineCover;
    has.channels = has.retailUnits || has.onlineUnits || has.retailValue || has.onlineValue;
    has.anyValue = has.value || has.retailValue || has.onlineValue;
    has.ranks = state.sheets.some(sh => (sh.map.ranks || []).length);
    has.multiSheet = state.sheets.length > 1;
    state.analysis = analyse(P, has);
  }

  /* ───────────────────────── Rendering helpers ───────────────────────── */

  const orig = (p, k) => { const t = p.src[k]; return t === undefined ? '' : t === '' ? BLANK : esc(t); };
  const MONEY = new Set(['value', 'prevValue', 'retailValue', 'onlineValue']);
  // Money cells: if the file's header marks the column as £ but the cell is a
  // bare number, show a £ sign in front. The digits themselves are untouched.
  const money = (p, k) => {
    const t = p.src[k];
    if (t === undefined) return '';
    if (t === '') return BLANK;
    return /[£$€]/.test(t) || num(t) == null ? esc(t) : '<span class="sa-cur">£</span>' + esc(t);
  };

  // Location chip: a cover figure (weeks) or stock units, shown exactly as written
  function locChip(p, key, A) {
    if (p[key] === undefined) return '';
    const text = p.src[key];
    if (text === '' || text == null) return '<span class="sa-chip sa-chip--blank">blank</span>';
    const v = p[key];
    if (v == null) return `<span class="sa-chip sa-chip--text">${esc(text)}</span>`;
    const T = A.T;
    let cls;
    if (/Cover$/.test(key) || A.relative || !(p.rankUnits > 0)) {
      cls = v <= T.lowLoc ? 'red' : v >= T.goodLoc ? 'green' : 'amber';
    } else {
      const wks = v / p.rankUnits;
      cls = v === 0 || wks < 0.5 ? 'red' : wks < T.reorder ? 'amber' : 'green';
    }
    return `<span class="sa-chip sa-chip--${cls}">${esc(text)}</span>`;
  }
  function trendChip(p) {
    if (p.trend == null) return '<span class="sa-trend sa-trend--flat">—</span>';
    if (!isFinite(p.trend)) return '<span class="sa-trend sa-trend--new">New</span>';
    const t = thresholds().trend;
    const cls = p.trend >= t ? 'up' : p.trend <= -t ? 'down' : 'flat';
    return `<span class="sa-trend sa-trend--${cls}">${cls === 'up' ? '▲' : cls === 'down' ? '▼' : '•'} ${fmtPct(p.trend)}</span>`;
  }
  function coverCell(p, A) {
    const T = A.T;
    if (!p.coverCalc) {                               // the file's own Total Cover
      const text = p.src.totalCover;
      if (text === '' || text == null) return `<span class="sa-cover">${BLANK}</span>`;
      const c = p.totalCover;
      const cls = c == null ? 'grey' : c < T.reorder ? 'red' : c < T.watch ? 'amber' : c > T.over ? 'blue' : 'green';
      return `<span class="sa-cover sa-cover--${cls}"><span class="sa-cover__num">${esc(text)}</span><span class="sa-cover__unit">wks</span></span>`;
    }
    if (p.cover == null) return '<span class="sa-cover sa-cover--grey"><span class="sa-cover__num">—</span></span>';
    const c = p.cover;
    const cls = c < T.reorder ? 'red' : c < T.watch ? 'amber' : c > T.over ? 'blue' : 'green';
    const txt = c < 1 ? (c * 7 < 1 ? '<1' : Math.round(c * 7)) : c < 10 ? c.toFixed(1) : Math.round(c);
    const excl = p.stockExcludes.length ? `<span class="sa-cover__note">excl. ${p.stockExcludes.map(k => k + ' (' + (p.src[k] === '' ? 'blank' : esc(p.src[k])) + ')').join(', ')}</span>` : '';
    return `<span class="sa-cover sa-cover--${A.relative ? 'grey' : cls}" title="Calculated: stock ÷ units sold"><span class="sa-cover__num">${txt}</span><span class="sa-cover__unit">${c < 1 ? 'days' : 'wks'}</span><span class="sa-cover__note">calculated</span>${excl}</span>`;
  }
  function soldCell(p, A, maxVal) {
    const has = A.has;
    const lines = [];
    if (has.value) lines.push(`<div class="sa-sold__val">${money(p, 'value')}</div>`);
    if (has.units) lines.push(`<div class="${has.value ? 'sa-sold__units' : 'sa-sold__val'}">${p.src.units === '' ? 'units ' + BLANK : esc(p.src.units) + ' units'}</div>`);
    if (!has.value && !has.units && has.channels) {
      const bits = [];
      if (has.retailValue || has.retailUnits) bits.push(`<div class="sa-sold__val">${has.retailValue ? money(p, 'retailValue') : orig(p, 'retailUnits') + ' units'} <small>retail</small></div>`);
      if (has.onlineValue || has.onlineUnits) bits.push(`<div class="sa-sold__units">${has.onlineValue ? money(p, 'onlineValue') : orig(p, 'onlineUnits') + ' units'} online</div>`);
      lines.push(bits.join(''));
    }
    const v = p.rankValue ?? p.rankUnits ?? 0;
    lines.push(`<div class="sa-sold__bar"><i style="width:${Math.max(2, v / maxVal * 100)}%"></i></div>`);
    if (has.channels && (has.retailUnits || has.onlineUnits)) {
      const r = p.retailUnits, o = p.onlineUnits;
      const tot = (r || 0) + (o || 0);
      const rp = tot ? (r || 0) / tot * 100 : 0;
      lines.push(`<div class="sa-chan" title="Retail vs online units (from your file)">
        <div class="sa-chan__bar"><i class="sa-chan__r" style="width:${rp}%"></i><i class="sa-chan__o" style="width:${tot ? 100 - rp : 0}%"></i></div>
        <div class="sa-chan__txt"><span><b class="sa-dot sa-dot--r"></b>Retail ${orig(p, 'retailUnits') || '—'}</span><span><b class="sa-dot sa-dot--o"></b>Online ${orig(p, 'onlineUnits') || '—'}</span></div>
      </div>`);
    }
    return lines.join('');
  }
  function productCell(p, A) {
    const m = p.sheet.map, labels = p.sheet.pt.labels;
    const meta = [];
    if (A.has.category && p.src.category !== undefined) meta.push(p.src.category === '' ? 'Group ' + BLANK : esc(p.src.category));
    if (A.has.price) meta.push(p.src.price === '' ? 'Price ' + BLANK : esc(/[£$€]/.test(p.src.price) ? p.src.price : '£' + p.src.price) + ' each');
    if (A.has.distribution) meta.push('Dist. ' + (p.src.distribution === '' ? BLANK : esc(p.src.distribution)));
    const ranks = (m.ranks || []).map(i => {
      const t = p.cells[i].trim();
      return `<span class="sa-rank" title="${esc(labels[i])}">${esc(labels[i].replace(/\s*rank(ing)?\s*/i, '') || 'Rank')} #${t === '' ? '–' : esc(t)}</span>`;
    }).join('');
    return `<div class="sa-prod__name">${p.name ? esc(p.name) : BLANK}</div>
      <div class="sa-prod__code">${m.code != null ? (p.code ? esc(p.code) : 'SKU ' + BLANK) : ''}${A.has.multiSheet ? `<span class="sa-sheettag">${esc(p.sheet.name)}</span>` : ''}</div>
      ${meta.length ? `<div class="sa-prod__meta">${meta.join('<i>·</i>')}</div>` : ''}
      ${ranks ? `<div class="sa-prod__ranks">${ranks}</div>` : ''}`;
  }

  /* ───────────────────────── Product images from next.co.uk ─────────────────────────
     Images load straight into the visitor's browser from Next's image server,
     addressed by the item number (no scraping, no server). Next's URL scheme
     isn't published, so several known patterns are tried in turn; whichever
     works is remembered and tried first for the next product. Only the item
     number is sent; nothing else from the file leaves the browser. */
  let IMG_TEMPLATES = [
    c => `https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/${c}s.jpg`,
    c => `https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/search/lge/${c}.jpg`,
    c => `https://xcdn.next.co.uk/common/items/default/default/itemimages/altitemshot/315x472/${c}s.jpg`,
    c => `https://xcdn.next.co.uk/Common/Items/Default/Default/ItemImages/AltItemShot/315x472/${c}s.jpg`,
    c => `https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/${c}.jpg`
  ];
  const nextUrl = c => `https://www.next.co.uk/search?w=${encodeURIComponent(c)}`;
  const imgCode = code => String(code || '').toUpperCase().replace(/[\s\-\/.]/g, '');
  const imgState = new Map();          // code → { url } | { failed: true }
  let imgPreferred = 0;
  try { imgPreferred = parseInt(localStorage.getItem('saImgTpl') || '0', 10) || 0; } catch (e) {}
  let imagesOn = true;
  try { imagesOn = localStorage.getItem('saImages') !== 'off'; } catch (e) {}
  const imgOrder = () => [imgPreferred].concat(IMG_TEMPLATES.map((_, i) => i).filter(i => i !== imgPreferred))
    .filter(i => i < IMG_TEMPLATES.length);

  function thumb(p) {
    const code = imgCode(p.code);
    const label = esc(p.name || p.code || '');
    if (!code || !/^[A-Z0-9]{4,10}$/.test(code)) return `<span class="sa-thumb sa-thumb--none" title="No item number to look up">—</span>`;
    const st = imgState.get(code);
    const link = inner => `<a class="sa-thumb" href="${nextUrl(code)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(code)} on next.co.uk">${inner}</a>`;
    if (st && st.failed) return link(`<span class="sa-thumb__ph">No image<br><small>View on Next</small></span>`);
    const first = imgOrder()[0];
    const src = st && st.url ? st.url : IMG_TEMPLATES[first](code);
    return link(`<img class="sa-thumb__img" src="${esc(src)}" alt="${label}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-code="${esc(code)}" data-tpl="${st && st.url ? -1 : first}" data-tried="${st && st.url ? '' : first}">` +
      `<span class="sa-thumb__big" aria-hidden="true"><img src="" alt="" data-big></span>`);
  }
  // One listener for every thumbnail: on error try the next URL pattern; on success remember it
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('sa-thumb__img')) return;
    const code = img.dataset.code;
    // Each image keeps its own list of patterns tried, so another image
    // learning the working pattern mid-way can't make this one skip it.
    const tried = img.dataset.tried ? img.dataset.tried.split(',').map(Number) : [];
    const known = (imgState.get(code) || {}).url;
    const next = imgOrder().find(i => !tried.includes(i));
    if (known && img.src !== known) {
      img.dataset.tpl = -1; img.src = known;
    } else if (next != null) {
      tried.push(next);
      img.dataset.tried = tried.join(',');
      img.dataset.tpl = next;
      img.src = IMG_TEMPLATES[next](code);
    } else {
      imgState.set(code, { failed: true });
      const a = img.closest('.sa-thumb');
      if (a) a.innerHTML = '<span class="sa-thumb__ph">No image<br><small>View on Next</small></span>';
    }
  }, true);
  document.addEventListener('load', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('sa-thumb__img')) return;
    const code = img.dataset.code;
    const tpl = parseInt(img.dataset.tpl, 10);
    imgState.set(code, { url: img.currentSrc || img.src });
    if (tpl >= 0 && tpl !== imgPreferred) { imgPreferred = tpl; try { localStorage.setItem('saImgTpl', String(tpl)); } catch (err) {} }
    const big = img.parentElement.querySelector('img[data-big]');
    if (big) big.src = img.currentSrc || img.src;
    img.parentElement.classList.add('is-loaded');
  }, true);

  // Table columns, built from whatever the file contains
  function columns(A) {
    const h = A.has, cov = A.locCoverMode;
    const cols = [
      { cls: 'sa-col-pri', th: 'Priority', td: p => `<span class="sa-pri sa-pri--${STATUS[p.status].pri}">${p.priority}</span>`, area: 'pri' },
      ...(imagesOn && h.code ? [{ cls: 'sa-col-img', th: 'Image', td: p => thumb(p), area: 'img' }] : []),
      { cls: 'sa-col-prod', th: 'Product', td: p => productCell(p, A), area: 'prod' },
      { cls: 'sa-col-sold', th: h.value || h.units ? 'Last week sold' : 'Sold', td: (p, mx) => soldCell(p, A, mx), area: 'sold' }
    ];
    if (h.trend) cols.push({ cls: 'sa-col-trend', th: 'vs prev wk', td: p => trendChip(p), m: 'Trend' });
    const locs = cov ? [['branchCover', 'Branch cover'], ['warehouseCover', 'Warehouse cover'], ['onlineCover', 'Online cover']]
                     : [['branch', 'Branch'], ['warehouse', 'Warehouse'], ['online', 'Online']];
    locs.forEach(([k, t]) => { if (h[k]) cols.push({ cls: 'sa-col-loc', th: t + (cov ? ' <small>wks</small>' : ''), td: p => locChip(p, k, A), m: t.replace(' cover', '') + (cov ? ' cov.' : '') }); });
    if (h.stock || (cov && h.online)) {
      cols.push({ cls: 'sa-col-stock', th: 'Stock <small>units</small>', m: 'Stock', td: p => {
        const bits = [];
        if (h.stock) bits.push(`<div><span class="sa-mini">${cov || h.online ? 'Retail' : 'Total'}</span> ${orig(p, 'stock')}</div>`);
        if (cov && h.online) bits.push(`<div><span class="sa-mini">Online</span> ${orig(p, 'online')}</div>`);
        if (!cov && !h.online && h.branch) return '';
        return `<div class="sa-stock">${bits.join('')}</div>`;
      } });
    }
    if (h.totalCover || h.stock || h.branch || h.warehouse || h.online) cols.push({ cls: 'sa-col-cover', th: h.totalCover ? 'Total cover' : 'Cover', td: p => coverCell(p, A), m: 'Cover' });
    if (h.returns) cols.push({ cls: 'sa-col-ret', th: 'Returns', m: 'Returns', td: p => {
      const t = p.src.returns;
      if (t === '' || t == null) return BLANK;
      return `<span class="sa-ret ${p.flags.has('highReturns') ? 'is-high' : ''}">${esc(t)}</span>`;
    } });
    if (h.onOrder) cols.push({ cls: 'sa-col-order', th: 'On order', td: p => orig(p, 'onOrder'), m: 'On order' });
    cols.push({ cls: 'sa-col-action', th: 'Action', area: 'act', td: p => {
      const tags = [];
      if (p.flags.has('highSales')) tags.push('Top seller');
      if (p.flags.has('improving')) tags.push('Rising');
      if (p.flags.has('declining')) tags.push('Slowing');
      return `<div class="sa-action">${esc(p.action)}</div>${tags.length ? `<div class="sa-action__tags">${tags.map(x => `<span class="sa-tag">${esc(x)}</span>`).join('')}</div>` : ''}`;
    } });
    return cols;
  }

  // Every column of the row, exactly as in the file
  function detailRow(p, span) {
    const items = p.sheet.pt.labels.map((l, i) => {
      if (!l && !p.cells[i].trim()) return '';
      return `<div class="sa-detail__item"><span>${l ? esc(l) : 'Column ' + (i + 1)}</span><b>${p.cells[i].trim() === '' ? BLANK : esc(p.cells[i])}</b></div>`;
    }).join('');
    return `<tr class="sa-detail"><td colspan="${span}"><div class="sa-detail__head">Every column for this product, exactly as in your file <span>(${esc(p.sheet.name)}, row ${p.idx + p.sheet.pt.rowOffset})</span></div><div class="sa-detail__grid">${items}</div></td></tr>`;
  }

  /* ───────────────────────── Render ───────────────────────── */

  function render() {
    const A = state.analysis;
    if (!A) return;
    renderKpis(A);
    renderInsights(A);
    renderMix(A);
    renderPills(A);
    renderTable(A);
    renderOriginal();
  }

  // A figure from the file's own Total row, if it has one
  const totalFromFile = (k, additive) => {
    const vals = state.sheets.map(sh => {
      const i = sh.map[k];
      if (!sh.totalRow || i == null) return null;
      const t = sh.totalRow.text[i].trim();
      return t === '' ? null : t;
    });
    if (vals.some(v => v == null)) return null;
    if (vals.length === 1) return vals[0];
    if (!additive || vals.some(v => num(v) == null)) return null;   // can't add cover / % figures
    return fmtNum(vals.reduce((a, v) => a + num(v), 0));
  };

  function renderKpis(A) {
    const P = A.products, h = A.has;
    const tile = (lbl, val, sub, cls) => `<div class="sa-kpi ${cls || ''}"><div class="sa-kpi__label">${lbl}</div><div class="sa-kpi__value">${val}</div>${sub ? `<div class="sa-kpi__delta">${sub}</div>` : ''}</div>`;
    const fromTotal = `<span class="sa-src">${state.sheets.length > 1 ? 'sum of your sheets’ Total rows' : 'from your Total row'}</span>`;
    const calcSum = '<span class="sa-src">sum of product rows</span>';
    const tiles = [];
    const sumOf = k => sumKnown(...P.map(p => p[k]));
    const showTotal = (k, lbl, money) => {
      const t = totalFromFile(k, true);
      if (t != null) tiles.push(tile(lbl, esc(money && !/[£$€]/.test(t) ? '£' + t : t), fromTotal));
      else if (h[k]) { const s = sumOf(k); if (s != null) tiles.push(tile(lbl, money ? fmtGBP(s) : fmtNum(s), calcSum)); }
    };
    if (h.value) showTotal('value', 'Sales last week', true);
    else if (h.retailValue || h.onlineValue) { showTotal('retailValue', 'Retail sales', true); showTotal('onlineValue', 'Online sales', true); }
    if (h.units) showTotal('units', 'Units sold', false);
    if (h.retailUnits && h.onlineUnits) {
      // Prefer the file's own Total row figures; otherwise sum the product rows
      const rt = totalFromFile('retailUnits', true), ot = totalFromFile('onlineUnits', true);
      const fromFile = rt != null && ot != null && num(rt) != null && num(ot) != null;
      const r = fromFile ? num(rt) : (sumOf('retailUnits') || 0), o = fromFile ? num(ot) : (sumOf('onlineUnits') || 0);
      if (r + o > 0) tiles.push(tile('Online share of units', Math.round(o / (r + o) * 100) + '%',
        fromFile ? `${esc(ot)} online · ${esc(rt)} retail <span class="sa-src">(Total row)</span>` : `${fmtNum(o)} online · ${fmtNum(r)} retail`));
    }
    tiles.push(tile('Products', P.length, `${P.filter(p => (p.rankUnits || 0) > 0).length} sold at least one`));
    const act = P.filter(p => p.status === 'act').length;
    tiles.push(tile('Reorder now', act, `${P.filter(p => p.status === 'watch').length} more to watch`, act ? 'sa-kpi--alert' : ''));
    const out = P.filter(p => p.flags.has('outOfStock')).length;
    tiles.push(tile('Sold out somewhere', out, `${P.filter(p => p.flags.has('onlineGap')).length} with online gaps`, out ? 'sa-kpi--warn' : ''));
    if (h.totalCover) {
      const t = totalFromFile('totalCover');
      if (t != null) tiles.push(tile('Total cover', esc(t) + ' <small>wks</small>', fromTotal));
    } else if (h.stock || h.branch || h.warehouse || h.online) {
      const covers = P.filter(p => p.cover != null && isFinite(p.cover) && p.totalStockCalc != null);
      const tu = covers.reduce((s, p) => s + p.rankUnits, 0);
      const avg = tu ? covers.reduce((s, p) => s + p.totalStockCalc, 0) / tu : null;
      tiles.push(tile('Avg weeks cover', avg == null ? '—' : avg < 10 ? avg.toFixed(1) : Math.round(avg), A.relative ? 'stock looks per-store' : 'calculated'));
    }
    if (h.returns) {
      const t = totalFromFile('returns');
      if (t != null) tiles.push(tile('Returns rate', esc(t), fromTotal));
    }
    els.kpis.innerHTML = tiles.join('');
  }

  function buildInsights(A) {
    const P = A.products, h = A.has;
    const out = [];
    const valOf = p => (p.rankValue != null ? p.rankValue : (p.rankUnits || 0));
    const shown = p => h.value ? money(p, 'value') : h.units ? esc(p.src.units) + ' units'
      : h.retailValue ? money(p, 'retailValue') + ' retail' : esc(p.src.retailUnits || '') + ' units';
    const byVal = P.slice().sort((a, b) => valOf(b) - valOf(a));
    const total = P.reduce((s, p) => s + valOf(p), 0);

    const act = P.filter(p => p.status === 'act').sort((a, b) => b.score - a.score);
    if (act.length) {
      const atRisk = act.reduce((s, p) => s + valOf(p), 0);
      const money = h.anyValue;
      out.push({ tone: 'red', icon: '!', html:
        `<b>${act.length} line${act.length > 1 ? 's' : ''} need reordering now</b>, together ${money ? fmtGBP(atRisk) : fmtNum(atRisk) + ' units'} of last week&rsquo;s sales. Start with <b>${esc(act[0].name || act[0].code)}</b>${act[1] ? ' and <b>' + esc(act[1].name || act[1].code) + '</b>' : ''}.` });
    }
    if (byVal[0] && total > 0) {
      const top = byVal[0];
      const top5 = byVal.slice(0, 5).reduce((s, p) => s + valOf(p), 0);
      out.push({ tone: 'blue', icon: '★', html:
        `Best seller: <b>${esc(top.name || top.code)}</b>${top.code && top.name ? ' (' + esc(top.code) + ')' : ''} at ${shown(top)}, ${Math.round(valOf(top) / total * 100)}% of the week.` +
        (P.length > 6 ? ` The top 5 lines made <b>${Math.round(top5 / total * 100)}%</b> of sales.` : '') });
    }
    if (h.retailUnits && h.onlineUnits) {
      const r = P.reduce((s, p) => s + (p.retailUnits || 0), 0), o = P.reduce((s, p) => s + (p.onlineUnits || 0), 0);
      if (r + o > 0) {
        const onlineLed = P.filter(p => (p.onlineUnits || 0) > (p.retailUnits || 0) * 2 && (p.onlineUnits || 0) >= 10).sort((a, b) => b.onlineUnits - a.onlineUnits);
        out.push({ tone: 'blue', icon: '⇄', html:
          `Online took <b>${Math.round(o / (r + o) * 100)}%</b> of units (${fmtNum(o)} online vs ${fmtNum(r)} retail).` +
          (onlineLed[0] ? ` Most online-led: <b>${esc(onlineLed[0].name)}</b> (${esc(onlineLed[0].src.onlineUnits)} online vs ${p0(onlineLed[0].src.retailUnits)} retail).` : '') });
      }
    }
    if (h.trend) {
      const prevTotal = P.reduce((s, p) => s + (p.prevUnits != null ? p.prevUnits : 0), 0);
      const currTotal = P.reduce((s, p) => s + (p.prevUnits != null ? (p.units || 0) : 0), 0);
      if (prevTotal > 0) {
        const d = (currTotal - prevTotal) / prevTotal * 100;
        out.push({ tone: d >= 0 ? 'green' : 'red', icon: d >= 0 ? '▲' : '▼', html:
          `Units are <b>${d >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(d))}%</b> on the week before (${fmtNum(currTotal)} vs ${fmtNum(prevTotal)}).` });
      }
      const movers = P.filter(p => p.trend != null && isFinite(p.trend) && (p.units || 0) + (p.prevUnits || 0) >= 5);
      const riser = movers.slice().sort((a, b) => b.trend - a.trend)[0];
      const faller = movers.slice().sort((a, b) => a.trend - b.trend)[0];
      if (riser && riser.trend >= A.T.trend) out.push({ tone: 'green', icon: '↗', html:
        `Biggest riser: <b>${esc(riser.name)}</b>, <b>${fmtPct(riser.trend)}</b> (${esc(riser.src.prevUnits)} → ${esc(riser.src.units)} units).` });
      if (faller && faller.trend <= -A.T.trend) out.push({ tone: 'amber', icon: '↘', html:
        `Slowing down: <b>${esc(faller.name)}</b>, <b>${fmtPct(faller.trend)}</b> week on week.` });
    }
    const online = P.filter(p => p.flags.has('onlineGap'));
    if (online.length) out.push({ tone: 'amber', icon: '⟳', html:
      `<b>${online.length} selling line${online.length > 1 ? 's have' : ' has'} zero online ${A.locCoverMode ? 'cover' : 'stock'}</b>${online.length <= 3 ? ' (' + online.map(p => esc(p.name)).join(', ') + ')' : ''}. Move stock across to protect web sales.` });
    const wh = P.filter(p => (p.warehouse === 0 || p.warehouseCover === 0) && (p.rankUnits || 0) > 0);
    if (wh.length) out.push({ tone: 'red', icon: '0', html:
      `<b>${wh.length} selling line${wh.length > 1 ? 's have' : ' has'} nothing left in the warehouse</b>, so branches and online can&rsquo;t be topped up.` });
    const ret = P.filter(p => p.flags.has('highReturns')).sort((a, b) => b.returns - a.returns);
    if (ret.length) out.push({ tone: 'amber', icon: '↩', html:
      `<b>${ret.length} line${ret.length > 1 ? 's' : ''} with returns at ${A.T.returns}%+</b>. Highest: <b>${esc(ret[0].name)}</b> at ${esc(ret[0].src.returns)}.` });
    const over = P.filter(p => p.status === 'over');
    if (over.length) out.push({ tone: 'blue', icon: '≡', html:
      `<b>${over.length} overstocked line${over.length > 1 ? 's' : ''}</b> with more than ${A.T.over} weeks of cover. Hold orders or plan a promotion.` });
    const idle = P.filter(p => p.status === 'idle');
    if (idle.length) out.push({ tone: 'grey', icon: '–', html: `<b>${idle.length} line${idle.length > 1 ? 's' : ''} sold nothing</b> last week.` });
    const neg = P.filter(p => p.status === 'check');
    if (neg.length) out.push({ tone: 'grey', icon: '±', html: `<b>${neg.length} line${neg.length > 1 ? 's have' : ' has'} negative stock or cover</b> in your file (${neg.slice(0, 3).map(p => esc(p.name || p.code)).join(', ')}${neg.length > 3 ? '…' : ''}). Worth checking the figures before acting on ${neg.length > 1 ? 'them' : 'it'}.` });
    const blanks = P.filter(p => p.status === 'nodata');
    if (blanks.length) out.push({ tone: 'grey', icon: '?', html: `<b>${blanks.length} line${blanks.length > 1 ? 's have' : ' has'} a blank sales figure</b> in your file, so ${blanks.length > 1 ? 'they' : 'it'} can&rsquo;t be assessed.` });
    if (A.relative) out.push({ tone: 'grey', icon: 'i', html: 'Your stock figures look like per-store or average counts, so lines are ranked against each other instead of by weeks of cover.' });
    if (!h.trend) out.push({ tone: 'grey', icon: 'i', html: 'Your file has no week-before column, so <b>Improving</b> and <b>Declining</b> are switched off.' });
    if (!out.length) out.push({ tone: 'green', icon: '✓', html: 'Nothing urgent this week: stock and sales look balanced.' });
    return out;
  }
  const p0 = t => (t === '' || t == null) ? 'blank' : esc(t);

  function renderInsights(A) {
    els.insights.innerHTML = buildInsights(A).map(i =>
      `<li class="sa-insight sa-insight--${i.tone}"><span class="sa-insight__icon" aria-hidden="true">${i.icon}</span><span>${i.html}</span></li>`).join('');
  }

  function renderMix(A) {
    const P = A.products, h = A.has;
    const counts = STATUS_ORDER.map(k => [k, P.filter(p => p.status === k).length]).filter(([, c]) => c);
    els.mixBar.innerHTML = counts.map(([k, c]) => `<span style="flex-grow:${c};background:${STATUS[k].colour}" title="${STATUS[k].label}: ${c}"></span>`).join('');
    els.mixLegend.innerHTML = counts.map(([k, c]) => `<li><i style="background:${STATUS[k].colour}"></i>${STATUS[k].short}<b>${c}</b></li>`).join('');
    const valOf = p => (p.rankValue != null ? p.rankValue : (p.rankUnits || 0));
    const top = P.slice().sort((a, b) => valOf(b) - valOf(a)).slice(0, 5);
    const max = top.length ? valOf(top[0]) || 1 : 1;
    const shownKey = h.value ? 'value' : h.units ? 'units' : h.retailValue ? 'retailValue' : 'retailUnits';
    els.topTitle.textContent = 'Top sellers by ' + (h.value ? '£' : h.units ? 'units' : h.retailValue ? 'retail £' : 'retail units');
    els.top.innerHTML = top.map(p => `<li><span class="sa-top__name">${esc(p.name || p.code)}</span><span class="sa-top__val">${MONEY.has(shownKey) ? money(p, shownKey) : orig(p, shownKey)}</span><span class="sa-top__bar"><i style="width:${Math.max(4, valOf(p) / max * 100)}%"></i></span></li>`).join('');
  }

  function renderPills(A) {
    const P = A.products;
    els.pills.innerHTML = PILLS.map(pl => {
      const missing = pl.needs && !A.has[pl.needs];
      if (missing && pl.needs !== 'trend') return '';
      const count = missing ? 0 : P.filter(pl.test).length;
      if (pl.key !== 'all' && !missing && count === 0 && !['act', 'runningOut'].includes(pl.key)) return '';
      const title = missing ? 'Your file has no week-before column' : '';
      return `<button type="button" class="sa-pill ${state.filter === pl.key ? 'is-active' : ''}" data-key="${pl.key}" role="tab" aria-selected="${state.filter === pl.key}" ${missing ? 'disabled' : ''} ${title ? `title="${title}"` : ''}>` +
        (pl.dot ? `<i style="background:${pl.dot}"></i>` : '') + pl.label + `<span class="sa-pill__count">${missing ? '–' : count}</span></button>`;
    }).join('');
  }

  function sorted(list) {
    const valOf = p => p.rankValue ?? p.rankUnits ?? 0;
    const by = {
      priority:  (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.score - a.score,
      value:     (a, b) => valOf(b) - valOf(a),
      valueAsc:  (a, b) => valOf(a) - valOf(b),
      units:     (a, b) => (b.rankUnits || 0) - (a.rankUnits || 0),
      cover:     (a, b) => (a.cover ?? Infinity) - (b.cover ?? Infinity),
      coverDesc: (a, b) => (b.cover ?? -Infinity) - (a.cover ?? -Infinity),
      trendUp:   (a, b) => (b.trend ?? -Infinity) - (a.trend ?? -Infinity),
      trendDown: (a, b) => (a.trend ?? Infinity) - (b.trend ?? Infinity),
      returns:   (a, b) => (b.returns ?? -1) - (a.returns ?? -1),
      file:      (a, b) => a.uid - b.uid
    }[state.sort] || (() => 0);
    return list.slice().sort(by);
  }

  function currentList(A) {
    const pill = PILLS.find(p => p.key === state.filter) || PILLS[0];
    const q = state.query.trim().toLowerCase();
    let list = A.products.filter(pill.test);
    if (q) list = list.filter(p => p.cells.join(' ').toLowerCase().includes(q));
    return { list: sorted(list), pill };
  }

  function renderTable(A) {
    const { list } = currentList(A);
    A.products.slice().sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.score - a.score)
      .forEach((p, i) => { p.priority = i + 1; });
    const cols = columns(A);
    const span = cols.length;
    els.head.innerHTML = '<tr>' + cols.map(c => `<th class="${c.cls}">${c.th}</th>`).join('') + '</tr>';
    const maxVal = Math.max(1, ...A.products.map(p => p.rankValue ?? p.rankUnits ?? 0));
    const grouped = state.sort === 'priority';
    const groupCounts = {};
    list.forEach(p => { groupCounts[p.status] = (groupCounts[p.status] || 0) + 1; });
    let html = '', last = null;
    list.forEach(p => {
      if (grouped && p.status !== last) {
        last = p.status;
        html += `<tr class="sa-group"><td colspan="${span}"><span class="sa-group__dot" style="background:${STATUS[p.status].colour}"></span>${STATUS[p.status].label}<span class="sa-group__count">${groupCounts[p.status]}</span></td></tr>`;
      }
      const open = state.open.has(p.uid);
      const strip = cols.filter(c => c.m).map(c => `<span class="sa-mstat">${c.m} ${c.td(p, maxVal)}</span>`).join('');
      html += `<tr class="sa-row ${open ? 'is-open' : ''}" data-uid="${p.uid}" tabindex="0" aria-expanded="${open}">` +
        cols.map(c => `<td class="${c.cls}${c.area ? ' sa-a-' + c.area : ' sa-m-hide'}">${c.td(p, maxVal)}</td>`).join('') +
        `<td class="sa-mobile-strip">${strip}</td></tr>`;
      if (open) html += detailRow(p, span);
    });
    els.body.innerHTML = html;
    els.empty.hidden = list.length > 0;
    stickyHead.rebuild();
  }

  /* ───────────────────────── Pinned column headings ─────────────────────────
     The table can scroll sideways, which stops CSS position:sticky working on
     its header. Instead a copy of the header row is pinned just under the
     filter bar while the table is on screen, with the same column widths,
     following any sideways scroll. */
  const stickyHead = (() => {
    const wrap = els.table.parentElement;
    const box = document.createElement('div');
    box.className = 'sa-stickyhead';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<table class="sa-table"><thead></thead></table>';
    // Lives on the page itself: the results panel's entrance animation leaves
    // a transform behind, which would break position:fixed inside it.
    document.querySelector('.sa-page').appendChild(box);
    const table = box.querySelector('table'), head = table.querySelector('thead');
    const controls = document.querySelector('.sa-controls');
    const mobile = window.matchMedia('(max-width: 760px)');
    let queued = false;

    function sync() {
      queued = false;
      if (mobile.matches || els.results.hidden || !els.head.firstElementChild) { box.classList.remove('is-on'); return; }
      const top = Math.max(controls.getBoundingClientRect().bottom, 0);
      const th = els.head.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const on = th.top < top && wr.bottom > top + th.height + 24;
      box.classList.toggle('is-on', on);
      if (!on) return;
      box.style.top = top + 'px';
      box.style.left = wr.left + 'px';
      box.style.width = wr.width + 'px';
      table.style.width = els.table.offsetWidth + 'px';
      const src = els.head.querySelectorAll('th'), dst = head.querySelectorAll('th');
      src.forEach((c, i) => { if (dst[i]) dst[i].style.width = dst[i].style.minWidth = c.getBoundingClientRect().width + 'px'; });
      table.style.transform = 'translateX(' + (-wrap.scrollLeft) + 'px)';
    }
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    wrap.addEventListener('scroll', queue, { passive: true });
    return { rebuild() { head.innerHTML = els.head.innerHTML; queue(); } };
  })();

  function renderOriginal() {
    const LIMIT = 3000;
    const used = new Set(state.analysis.products.map(p => p.uid));
    els.origWrap.innerHTML = state.sheets.map((sh, si) => {
      const pt = sh.pt;
      const head = '<thead>' +
        (pt.groups.some(g => g) ? '<tr><th class="sa-rownum"></th>' + pt.groups.map(g => `<th class="sa-grouphead">${esc(g)}</th>`).join('') + '</tr>' : '') +
        '<tr><th class="sa-rownum">Row</th>' + pt.heads.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead>';
      const body = '<tbody>' + pt.text.slice(0, LIMIT).map((r, i) => {
        if (isBlankRow(r)) return '';
        return `<tr${used.has(si * 1e6 + i) ? '' : ' class="is-skipped"'}><td class="sa-rownum">${i + pt.rowOffset}</td>` + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
      }).join('') + '</tbody>';
      return `${state.sheets.length > 1 ? `<h4 class="sa-original__sheet">${esc(sh.name)} <span>${sh.count} products</span></h4>` : ''}
        <div class="sa-original__scroll"><table class="sa-original__table">${head}${body}</table></div>`;
    }).join('');
    els.origHint.textContent = `${state.analysis.products.length} product rows from ${state.sheets.length} sheet${state.sheets.length > 1 ? 's' : ''} · every cell unchanged`;
  }

  /* ───────────────────────── Breakdown tables (e.g. by type / colour / size) ───────────────────────── */

  function splitBlocks(t) {
    const blocks = [];
    let cur = null;
    t.text.forEach((r, i) => {
      if (isBlankRow(r)) { cur = null; return; }
      if (!cur) { cur = { header: r, rows: [], start: i }; blocks.push(cur); }
      else cur.rows.push(r);
    });
    return blocks.filter(b => b.rows.length);
  }

  /* Icons beside breakdown labels: colour swatches for colours, size blocks
     for sizes, a symbol for product types (keyword match), else an initial. */
  const COLOURS = { gold: '#d4af37', natural: '#d8c3a5', white: '#f4f4f2', bronze: '#a26a37', brown: '#7b4a2a',
    pink: '#f29bb8', black: '#151515', orange: '#f08a24', cream: '#f3e6c8', silver: '#c0c4c8', green: '#4caf50',
    monochrome: 'linear-gradient(135deg,#111 50%,#eee 50%)', grey: '#8d8d92', gray: '#8d8d92', sage: '#9caf88',
    rust: '#b5512b', red: '#d0303a', blue: '#3a7bd5', beige: '#dcc9a3', clear: 'rgba(255,255,255,0.15)',
    navy: '#1f2f5c', purple: '#7d4fb5', yellow: '#f2c94c', multi: 'conic-gradient(#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6,#e74c3c)',
    teal: '#2a9d8f', copper: '#b87333', rose: '#e8a0a8', ivory: '#fffff0', khaki: '#c3b091', tan: '#d2b48c' };
  const TYPE_ICONS = [[/animal|dog|cat|bird|hare/, '🐾'], [/novelty|gift/, '✨'], [/sculpt|art|statue|bust/, '🗿'],
    [/game|puzzle/, '🎲'], [/letter|word|text|sign/, '🔤'], [/light|lamp|candle/, '💡'], [/flower|plant|floral/, '🌸'],
    [/christmas|xmas|festive/, '🎄'], [/halloween|pumpkin/, '🎃'], [/heart|love/, '❤️'], [/fruit|cherr|food/, '🍒'],
    [/vase|pot|jar/, '🏺'], [/frame|picture|photo/, '🖼️'], [/clock|time/, '🕰️'], [/book/, '📚'], [/shell|sea|beach/, '🐚']];
  function labelIcon(head, label) {
    const h = norm(head), l = norm(label);
    if (/colou?r/.test(h)) {
      const parts = l.split(/\s*[\/&+,]\s*|\s+and\s+/).map(w => {
        const key = Object.keys(COLOURS).find(c => w.includes(c));
        return key ? COLOURS[key] : null;
      }).filter(Boolean);
      if (parts.length) {
        const bg = parts.length > 1 && !parts.some(x => /gradient/.test(x))
          ? `linear-gradient(135deg, ${parts[0]} 50%, ${parts[1]} 50%)` : parts[0];
        return `<span class="sa-ico sa-ico--swatch" style="background:${bg}"></span>`;
      }
    }
    if (/size/.test(h)) {
      const sz = /extra ?large|xl/.test(l) ? 18 : /large/.test(l) ? 15 : /medium/.test(l) ? 12 : /mini/.test(l) ? 6 : /small/.test(l) ? 9 : 0;
      if (sz) return `<span class="sa-ico"><i class="sa-ico__size" style="width:${sz}px;height:${sz}px"></i></span>`;
    }
    const hit = TYPE_ICONS.find(([rx]) => rx.test(l));
    if (hit) return `<span class="sa-ico">${hit[1]}</span>`;
    return `<span class="sa-ico sa-ico--letter">${esc((label.trim()[0] || '?').toUpperCase())}</span>`;
  }

  function renderBreakdowns() {
    if (!state.breakdowns.length) { els.breakdowns.hidden = true; els.bdGrid.innerHTML = ''; return; }
    els.breakdowns.hidden = false;
    const cards = [];
    state.bdSort = state.bdSort || {};
    let cardNo = 0;
    state.breakdowns.forEach(t => {
      splitBlocks(t).forEach(b => {
        const cid = cardNo++;
        // Drop columns that are completely empty in this block (no data to show)
        const width = Math.max(b.header.length, ...b.rows.map(r => r.length));
        const keep = [];
        for (let c = 0; c < width; c++) {
          if (String(b.header[c] ?? '').trim() || b.rows.some(r => String(r[c] ?? '').trim())) keep.push(c);
        }
        const H = keep.map(c => String(b.header[c] ?? '').trim());
        const labelCol = keep[0];
        const attr = RX.attrHead.test(norm(H[0] || ''));
        const title = attr ? 'By ' + H[0].replace(/^product\s+/i, '').toLowerCase() : (t.name || 'Sheet');
        const isTotal = r => RX.skipRow.test(String(r[labelCol] ?? '').trim());
        // Main measure for the bars: first numeric column that isn't a % column
        const numericCol = keep.slice(1).find(c => {
          const vals = b.rows.filter(r => !isTotal(r)).map(r => String(r[c] ?? ''));
          return vals.some(v => num(v) != null) && !vals.some(v => /%/.test(v));
        });
        const vals = b.rows.filter(r => !isTotal(r)).map(r => num(r[numericCol]) || 0);
        const max = Math.max(1, ...vals);
        const changeCol = keep.find(c => /(wow|w\/w|week on week|vs|var|change|growth)/i.test(String(b.header[c] ?? '')) && b.rows.some(r => /%/.test(String(r[c] ?? ''))));
        // Headline: leader by main measure, biggest mover by first change column
        const body = b.rows.filter(r => !isTotal(r));
        const leader = numericCol != null ? body.slice().sort((x, y) => (num(y[numericCol]) || 0) - (num(x[numericCol]) || 0))[0] : null;
        const movers = changeCol != null ? body.filter(r => num(r[changeCol]) != null) : [];
        const up = movers.slice().sort((x, y) => num(y[changeCol]) - num(x[changeCol]))[0];
        const down = movers.slice().sort((x, y) => num(x[changeCol]) - num(y[changeCol]))[0];
        const lab = r => String(r[labelCol] ?? '').trim() || 'blank';
        const head = [];
        if (leader) head.push(`<b>${esc(lab(leader))}</b> leads on ${esc(String(b.header[numericCol]).trim())} (${esc(leader[numericCol])})`);
        if (up && num(up[changeCol]) > 0) head.push(`biggest rise <b class="sa-up">${esc(lab(up))} ${esc(up[changeCol])}</b>`);
        if (down && num(down[changeCol]) < 0) head.push(`biggest drop <b class="sa-down">${esc(lab(down))} ${esc(down[changeCol])}</b>`);

        // Sort options built from this table's own columns
        const isChange = c => /(wow|w\/w|vs|var|change|growth)/i.test(String(b.header[c] ?? '')) && b.rows.some(r => /%/.test(String(r[c] ?? '')));
        const isShare = c => !isChange(c) && /(pn|share|mix|% of|participation)/i.test(String(b.header[c] ?? '')) && b.rows.some(r => /%/.test(String(r[c] ?? '')));
        const short = c => String(b.header[c] ?? '').trim();
        const sorts = [{ id: 'file', label: 'File order' }];
        if (numericCol != null) sorts.push({ id: 'm-hi', label: 'Highest ' + short(numericCol), col: numericCol, dir: -1 }, { id: 'm-lo', label: 'Lowest ' + short(numericCol), col: numericCol, dir: 1 });
        keep.filter(isChange).forEach(c => sorts.push(
          { id: 'c' + c + '-hi', label: 'Highest ' + short(c), col: c, dir: -1 },
          { id: 'c' + c + '-lo', label: 'Lowest ' + short(c), col: c, dir: 1 }));
        const sh = keep.find(isShare);
        if (sh != null) sorts.push({ id: 's-hi', label: 'Biggest ' + short(sh), col: sh, dir: -1 });
        sorts.push({ id: 'az', label: 'A–Z' });
        const cur = sorts.find(x => x.id === state.bdSort[cid]) || sorts[0];
        const ordered = cur.id === 'file' ? b.rows.slice() : (() => {
          const tot = b.rows.filter(isTotal), rest = b.rows.filter(r => !isTotal(r));
          if (cur.id === 'az') rest.sort((x, y) => lab(x).localeCompare(lab(y)));
          else rest.sort((x, y) => {
            const a = num(x[cur.col]), bb = num(y[cur.col]);
            if (a == null && bb == null) return 0; if (a == null) return 1; if (bb == null) return -1;
            return (a - bb) * cur.dir;
          });
          return rest.concat(tot);
        })();
        const pills = `<div class="sa-bd__pills">${sorts.map(x => `<button type="button" class="sa-pill sa-pill--sm ${x === cur ? 'is-active' : ''}" data-card="${cid}" data-sort="${x.id}">${esc(x.label)}</button>`).join('')}</div>`;

        const rowsHtml = ordered.map(r => {
          const total = isTotal(r);
          return `<tr class="${total ? 'is-total' : ''}">` + keep.map((c, k) => {
            const t = String(r[c] ?? '');
            if (k === 0) return `<td class="sa-bd__label">${total || t.trim() === '' ? '' : labelIcon(H[0], t)}${t.trim() === '' ? BLANK : esc(t)}</td>`;
            let inner = t.trim() === '' ? '' : esc(t);
            let cls = '';
            if (/%/.test(t) && /(wow|w\/w|vs|var|change|growth)/i.test(String(b.header[c] ?? ''))) {
              const n = num(t);
              const k = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
              inner = `<span class="sa-trend sa-trend--${k}">${k === 'up' ? '▲' : k === 'down' ? '▼' : '•'} ${esc(t)}</span>`;
            } else if (/%/.test(t) && t.trim() !== '' && !total) {
              inner = `<span class="sa-bd__share"><i style="width:${Math.min(100, Math.max(0, num(t) || 0))}%"></i></span><span>${esc(t)}</span>`;
              cls = 'sa-bd__pct';
            }
            if (c === numericCol && !total && t.trim() !== '') {
              inner = `<span class="sa-bd__bar"><i style="width:${Math.max(2, (num(t) || 0) / max * 100)}%"></i></span><span class="sa-bd__num">${inner}</span>`;
              cls += ' sa-bd__measure';
            }
            return `<td class="${cls}">${inner}</td>`;
          }).join('') + '</tr>';
        }).join('');
        cards.push(`<article class="sa-panel sa-bd">
          <div class="sa-bd__top"><h3 class="sa-panel__title">${esc(title)}</h3><span class="sa-bd__src">${esc(t.name)}</span></div>
          ${head.length ? `<p class="sa-bd__head">${head.join(' · ')}</p>` : ''}
          ${pills}
          <div class="sa-bd__scroll"><table class="sa-table sa-bd__table"><thead><tr>${H.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
        </article>`);
      });
    });
    els.bdGrid.innerHTML = cards.join('');
  }

  els.bdGrid.addEventListener('click', e => {
    const b = e.target.closest('[data-card]');
    if (!b) return;
    state.bdSort[b.dataset.card] = b.dataset.sort;
    renderBreakdowns();
  });

  /* ───────────────────────── Column mapping UI ───────────────────────── */

  function renderMap() {
    const sh = state.sheets[state.edit] || state.sheets[0];
    const pt = sh.pt, map = sh.map;
    const opts = ['<option value="">— not in file —</option>']
      .concat(pt.labels.map((h, i) => `<option value="${i}">${esc(h || 'Column ' + (i + 1))}</option>`)).join('');
    const sheetPick = state.sheets.length > 1
      ? `<label class="sa-map__sheet">Sheet<select data-sheet>${state.sheets.map((x, i) => `<option value="${i}" ${i === state.edit ? 'selected' : ''}>${esc(x.name)} (${x.count} products)</option>`).join('')}</select></label>` : '';
    els.map.innerHTML = sheetPick + FIELDS.map(f => `<label>${f.label}<select data-field="${f.key}">${opts}</select></label>`).join('');
    els.map.querySelectorAll('select[data-field]').forEach(sel => {
      const i = map[sel.dataset.field];
      sel.value = i != null ? String(i) : '';
    });
    const used = new Set(Object.entries(map).filter(([k]) => k !== 'ranks').map(([, v]) => v).concat(map.ranks || []));
    const other = pt.labels.map((l, i) => [l, i]).filter(([l, i]) => l && !used.has(i));
    const ranks = (map.ranks || []).map(i => pt.labels[i]);
    const notes = [];
    if (ranks.length) notes.push('<b>Ranks</b> (shown under each product): ' + ranks.map(esc).join(', '));
    if (other.length) notes.push('<b>Also in this sheet</b> (shown when you open a product): ' + other.map(([l]) => esc(l)).join(', '));
    els.map.insertAdjacentHTML('beforeend', `<p class="sa-map__note">${notes.join('<br>') || 'Every column in this sheet is in use.'}</p>`);

    const problems = [];
    state.sheets.forEach(x => {
      const miss = [];
      if (x.map.name == null) miss.push('product name');
      if (x.map.code == null) miss.push('SKU');
      if (!['units', 'value', 'retailUnits', 'onlineUnits', 'retailValue', 'onlineValue', 'combined'].some(k => x.map[k] != null)) miss.push('sales');
      if (miss.length) problems.push((state.sheets.length > 1 ? x.name + ': ' : '') + 'no ' + miss.join(' / ') + ' column');
    });
    els.config.classList.toggle('has-warning', problems.length > 0);
    const cols = state.sheets.reduce((n, x) => n + x.pt.labels.filter(Boolean).length, 0);
    els.configHint.textContent = problems.length ? problems.join(' · ') + '. Pick it here'
      : `All ${cols} columns${state.sheets.length > 1 ? ' across ' + state.sheets.length + ' sheets' : ''} accounted for. Check the matches`;
    if (problems.length) els.config.open = true;
  }

  els.map.addEventListener('change', e => {
    const sel = e.target.closest('select');
    if (!sel) return;
    if (sel.hasAttribute('data-sheet')) { state.edit = parseInt(sel.value, 10); renderMap(); return; }
    const map = state.sheets[state.edit].map;
    const f = sel.dataset.field;
    const v = sel.value === '' ? null : parseInt(sel.value, 10);
    Object.keys(map).forEach(k => { if (k !== 'ranks' && k !== f && map[k] === v && v != null) delete map[k]; });
    if (v != null) map.ranks = (map.ranks || []).filter(i => i !== v);
    if (v == null) delete map[f]; else map[f] = v;
    if (f === 'units' || f === 'value') delete map.combined;
    try { runAnalysis(); renderMap(); render(); setStatus(''); }
    catch (err) { setStatus(esc(err.message), false, true); }
  });
  Object.values(els.th).forEach(inp => inp && inp.addEventListener('input', () => {
    inp.dataset.user = '1';
    if (!state.sheets.length) return;
    try { runAnalysis(); render(); } catch (err) { /* keep last good view */ }
  }));

  /* ───────────────────────── Loading ───────────────────────── */

  // Defaults that follow the file's own norms (from its Total row), unless the
  // user has typed their own: overstock at 1.5x the average cover, high
  // returns at 1.5x the average returns rate.
  function adaptThresholds() {
    let changed = false;
    const note = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const cover = num(totalFromFile('totalCover'));
    if (!els.th.overWks.dataset.user) {
      if (cover != null && cover > 0) {
        els.th.overWks.value = Math.max(8, Math.round(cover * 1.5));
        note('saOverNote', `(1.5× your file’s average cover of ${cover} wks)`);
      } else { els.th.overWks.value = 20; note('saOverNote', ''); }
      changed = true;
    }
    const ret = num(totalFromFile('returns'));
    if (!els.th.returnsPct.dataset.user) {
      if (ret != null && ret > 0) {
        els.th.returnsPct.value = Math.max(1, Math.round(ret * 1.5));
        note('saRetNote', `(1.5× your file’s average returns of ${ret}%)`);
      } else { els.th.returnsPct.value = 10; note('saRetNote', ''); }
      changed = true;
    }
    return changed;
  }

  function skippedNote() {
    const k = state.skipped || {};
    const bits = [];
    if (k.totals)  bits.push(k.totals + ' total row' + (k.totals > 1 ? 's' : ''));
    if (k.headers) bits.push(k.headers + ' repeated header' + (k.headers > 1 ? 's' : ''));
    if (k.notes)   bits.push(k.notes + ' heading/note line' + (k.notes > 1 ? 's' : ''));
    return bits.length ? 'not products: ' + bits.join(', ') : '';
  }

  function loadTables(tables, label, autoRead) {
    if (!tables.length) throw new Error('That file has no sheets with data in it.');
    const read = tables.map(t => {
      if (t.empty) return { t, role: 'empty' };
      const pt = prepareTable(t);
      if (!pt) return { t, role: 'other' };
      const c = classify(pt);
      return { t, pt, map: c.map, role: c.kind === 'products' ? 'products' : 'breakdown' };
    });
    // Every product sheet feeds one combined analysis; everything else is shown in full below
    state.sheets = read.filter(x => x.role === 'products').map(x => ({ name: x.t.name, file: x.t.file, pt: x.pt, map: x.map }));
    state.breakdowns = read.filter(x => x.role === 'breakdown' || x.role === 'other').map(x => x.t);
    state.edit = 0;
    state.filter = 'all';
    state.query = '';
    state.open = new Set();
    els.search.value = '';

    const hasProducts = state.sheets.length > 0;
    if (hasProducts) { runAnalysis(); if (adaptThresholds()) runAnalysis(); }
    else state.analysis = null;

    // What happened to every sheet, so nothing is silently skipped
    els.sheets.innerHTML = tables.length > 1 || read.some(x => x.role !== 'products') ? '<span class="sa-sheets__label">Sheets read</span>' + read.map(x => {
      const n = x.role === 'products' ? (state.sheets.find(s => s.pt === x.pt) || {}).count + ' products'
        : x.role === 'breakdown' ? 'shown as breakdown'
        : x.role === 'other' ? 'no table headings, shown in full below' : 'empty';
      return `<span class="sa-sheet sa-sheet--${x.role}" title="${esc(x.t.file || '')}">${esc(x.t.name)}<small>${n}</small></span>`;
    }).join('') : '';

    els.fileMeta.textContent = hasProducts
      ? [state.analysis.products.length + ' products' + (state.sheets.length > 1 ? ' from ' + state.sheets.length + ' sheets' : ''), skippedNote(),
         state.breakdowns.length ? splitCount() + ' other table' + (splitCount() > 1 ? 's' : '') : '',
         autoRead ? 'auto-read, check columns' : ''].filter(Boolean).join(' · ')
      : splitCount() + ' tables · no product-level sheet found (add the sheet with SKUs and descriptions for the full analysis)';
    els.fileName.textContent = label;
    els.results.classList.toggle('is-breakdown-only', !hasProducts);
    els.uploadWrap.classList.add('is-collapsed');
    els.results.hidden = false;
    setStatus('');
    if (hasProducts) { renderMap(); render(); }
    renderBreakdowns();
    els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const splitCount = () => state.breakdowns.reduce((s, t) => s + splitBlocks(t).length, 0);

  async function handleFiles(fileList) {
    const files = [...fileList].filter(Boolean);
    if (!files.length) return;
    setStatus('Reading ' + esc(files.map(f => f.name).join(', ')) + '…', true);
    try {
      const tables = [];
      let autoRead = false;
      for (const f of files) {
        const ts = await readFile(f);
        ts.forEach(t => { if (t.autoRead) autoRead = true; tables.push(t); });
      }
      const label = files.length === 1 ? files[0].name.replace(/^[0-9a-f]{8}-/, '') : files.length + ' files';
      loadTables(tables, label, autoRead);
    } catch (err) {
      console.error(err);
      setStatus(esc(err.message || 'Something went wrong reading that file.'), false, true);
    }
  }

  /* ───────────────────────── Sample data ───────────────────────── */

  function sampleTables() {
    const prod = [
      ['', '', '', '', '', '', '', 'Brand', '', 'Retail', '', 'Online', '', 'Retail', '', '', '', '', 'Online', '', ''],
      ['Brand Rank', 'Retail Rank', 'Online Rank', 'Item Number', 'Sub Group', 'Description', 'Sell Price', 'Last Week U', 'Last Week V(£)', 'Sold (u)', 'Sold (£)', 'Orders Taken (u)', 'Orders Taken (£)', 'Distribution', 'Total Stock', 'Branch Cover', 'Warehouse Cover', 'Total Cover', 'Returns Rate %', 'Total Stock', 'Cover'],
      ['1', '3', '1', 'Y35088', 'QE12', 'CO DANGLY SO3 BISCUT', '15', '829', '12628', '191', '2867', '687', '10504', 'ABCDE', '3766', '3', '17', '19', '7%', '1373', '1'],
      ['2', '2', '2', 'W66225', 'QE12', 'CO HARE ORNAMENT', '32', '241', '7885', '92', '2944', '158', '5250', 'ABC', '415', '3', '2', '4', '6%', '349', '1'],
      ['3', '5', '3', 'Y33706', 'QE12', 'OCT STAG BUST', '48', '128', '6164', '45', '2166', '91', '4392', 'ABC', '503', '7', '4', '10', '9%', '320', '2'],
      ['4', '15', '4', 'Y60913', 'QE12', 'NOV WHIPPET DOG', '12', '447', '5380', '114', '1372', '356', '4285', 'ABC', '570', '2', '3', '5', '6%', '468', '0'],
      ['5', '4', '7', 'F32543', 'QE12', 'CO LEOPARD GOLD', '20', '267', '5377', '122', '2440', '156', '3162', 'ABCD', '1825', '4', '10', '14', '7%', '945', '8'],
      ['6', '8', '5', 'AR6192', 'QE12', 'CO CHERRY GOLD LEOP', '16', '330', '5325', '107', '1714', '242', '3918', 'ABC', '1348', '2', '9', '12', '8%', '1748', '6'],
      ['7', '1', '40', 'E94868', 'QE12', 'CO HAMISH BRNZ LARGE', '40', '106', '4314', '86', '3463', '22', '924', 'ABCDE', '2164', '12', '14', '25', '8%', '999', '45'],
      ['8', '43', '6', 'Y33710', 'QE12', 'OCT BRNX CONNECT 4', '22', '189', '4177', '32', '704', '166', '3672', 'ABC', '414', '7', '6', '13', '5%', '252', '0'],
      ['9', '7', '9', 'E25316', 'QE12', 'CO LOOP GOLD TWIST', '22', '182', '4103', '80', '1766', '113', '2582', 'ABCD', '1560', '9', '9', '19', '10%', '951', '7'],
      ['10', '6', '11', 'G63832', 'QE12', 'NOV BOLD CHERRIES', '20', '201', '4064', '93', '1865', '117', '2390', 'ABCD', '647', '4', '3', '7', '8%', '471', '3'],
      ['11', '30', '25', 'W58102', 'QE12', 'MAY BERTIE AND SON', '14', '7', '98', '7', '98', '', '', 'AB', '58', '7', '', '7', '4%', '0', ''],
      ['12', '41', '36', 'A37503', 'QE12', 'CO GOLD FLOWER', '16', '1', '16', '', '', '1', '16', '', '5', '', '', '', '0%', '0', '0'],
      ['Total', '', '', '', '', '', '', '2928', '59830', '969', '21399', '2109', '41095', '', '13275', '5', '8', '13', '7%', '7876', '3']
    ];
    const bd = [
      ['', 'Product Type', 'LW TY £K', 'WoW %', 'LW LY £K', 'LW vs LY %'],
      ['', 'Animal', '92063', '9%', '44365.28', '108%'],
      ['', 'Novelty Object', '52362', '23%', '46549.91', '12%'],
      ['', 'Art Sculpture', '19864', '23%', '13533.57', '47%'],
      ['', 'Letters and Words', '2520', '-19%', '2498.85', '1%'],
      ['', 'Total', '177190', '14%', '112325.8', '58%']
    ];
    const spans = [{ r: 0, c0: 7, c1: 8 }, { r: 0, c0: 9, c1: 10 }, { r: 0, c0: 11, c1: 12 }, { r: 0, c0: 13, c1: 17 }, { r: 0, c0: 18, c1: 20 }];
    return [
      { name: 'Sample: product sheet', rows: prod, text: prod, spans, firstRow: 2 },
      { name: 'Sample: breakdowns', rows: bd, text: bd, spans: [], firstRow: 2 }
    ];
  }

  /* ───────────────────────── Events ───────────────────────── */

  els.file.addEventListener('change', () => handleFiles(els.file.files));
  ['dragenter', 'dragover'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove('is-over'); }));
  els.drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
  document.addEventListener('paste', e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) handleFiles([new File([item.getAsFile()], 'pasted-screenshot.png', { type: item.type })]);
  });
  els.sample.addEventListener('click', () => {
    try { loadTables(sampleTables(), 'Sample: weekly trade report', false); }
    catch (err) { setStatus(esc(err.message), false, true); }
  });
  els.newBtn.addEventListener('click', () => {
    els.results.hidden = true;
    els.uploadWrap.classList.remove('is-collapsed');
    els.file.value = '';
    state.analysis = null; state.sheets = [];
    setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  els.pills.addEventListener('click', e => {
    const b = e.target.closest('.sa-pill');
    if (!b || b.disabled) return;
    state.filter = b.dataset.key;
    // Filters that are about a ranking show that ranking straight away
    // Every filter shows its most relevant product first
    const autoSort = {
      all: 'priority', act: 'priority', watch: 'priority',
      runningOut: 'cover',          // least cover left first
      outOfStock: 'value',          // biggest sellers that are sold out first
      highSales: 'value', lowSales: 'valueAsc',
      improving: 'trendUp', declining: 'trendDown',
      onlineGap: 'value',           // most sales at risk online first
      highReturns: 'returns',
      overstock: 'coverDesc',       // most weeks of cover first
      ok: 'value'
    }[state.filter] || 'priority';
    state.sort = autoSort; els.sort.value = autoSort;
    renderPills(state.analysis);
    renderTable(state.analysis);
  });
  els.search.addEventListener('input', () => { state.query = els.search.value; renderTable(state.analysis); });
  const imgToggle = document.getElementById('saImgToggle');
  if (imgToggle) {
    imgToggle.checked = imagesOn;
    imgToggle.addEventListener('change', () => {
      imagesOn = imgToggle.checked;
      try { localStorage.setItem('saImages', imagesOn ? 'on' : 'off'); } catch (e) {}
      if (state.analysis) renderTable(state.analysis);
    });
  }
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; renderTable(state.analysis); });
  const toggleRow = row => {
    const i = parseInt(row.dataset.uid, 10);
    if (state.open.has(i)) state.open.delete(i); else state.open.add(i);
    renderTable(state.analysis);
  };
  els.body.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('tr.sa-row');
    if (row) toggleRow(row);
  });
  els.body.addEventListener('keydown', e => {
    const row = e.target.closest('tr.sa-row');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(row); }
  });

  els.exportBtn.addEventListener('click', () => {
    const A = state.analysis;
    if (!A) return;
    const { list, pill } = currentList(A);
    // Every column from every product sheet, exactly as written (matched by
    // column name across sheets), then the tool's own labelled columns.
    const uniq = labels => { const seen = {}; return labels.map((l, i) => { l = l || 'Column ' + (i + 1); seen[l] = (seen[l] || 0) + 1; return seen[l] > 1 ? l + ' (' + seen[l] + ')' : l; }); };
    const sheetLabels = new Map(state.sheets.map(sh => [sh, uniq(sh.pt.labels)]));
    const all = [];
    state.sheets.forEach(sh => sheetLabels.get(sh).forEach(l => { if (!all.includes(l)) all.push(l); }));
    const multi = state.sheets.length > 1;
    const cols = (multi ? ['Sheet'] : []).concat(all, ['Status (calculated)', 'Priority (calculated)', 'Trend % (calculated)', 'Cover (calculated)', 'Action (calculated)']);
    const cell = v => {
      if (v == null || (typeof v === 'number' && !isFinite(v))) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map(cell).join(',')].concat(list.map(p => {
      const labs = sheetLabels.get(p.sheet);
      const byLabel = {}; labs.forEach((l, i) => { byLabel[l] = p.cells[i]; });
      return (multi ? [p.sheet.name] : []).concat(all.map(l => l in byLabel ? byLabel[l] : ''),
        [STATUS[p.status].short, p.priority, p.trend != null && isFinite(p.trend) ? Math.round(p.trend) : '',
         p.coverCalc && p.cover != null ? p.cover.toFixed(1) : '', p.action]).map(cell).join(',');
    }));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sales-analysis-' + pill.key + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  window.SalesAnalysis = { handleFiles, loadTables, detectColumns, prepareTable, num,
    setImageTemplates(list) { IMG_TEMPLATES = list; imgState.clear(); imgPreferred = 0; } };
})();
