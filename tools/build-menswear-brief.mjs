#!/usr/bin/env node
/* ============================================================
   build-menswear-brief.mjs
   Builds menswear-brief-data.json for /menswear-brief, The Menswear
   Brief: runway, drops, trends and design news for men's fashion only.

   Same engine as build-news.mjs, with menswear sources across four
   buckets (runway, drops, trends, design): dedupes, sorts
   newest-first, grabs an image for each (feed media or og:image
   fallback), and writes ../menswear-brief-data.json.

   Run locally:  node tools/build-menswear-brief.mjs
   In CI:        daily GitHub Action (.github/workflows/news.yml)

   Dependency-free: Node 20+ built-ins only (global fetch).
   ============================================================ */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'menswear-brief-data.json')

// Google News search feeds: reliable and cover every publisher.
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:14d')}&hl=en-GB&gl=GB&ceid=GB:en`

// Menswear only: runway shows and collections, product drops and collabs,
// style trends, and the designers and business behind them.
const FEEDS = {
  runway: [
    { name: 'Menswear shows', url: GN('menswear runway OR "men\'s fashion week" OR "menswear collection" OR "menswear show"') },
    { name: 'Fashion weeks', url: GN('"Pitti Uomo" OR "Paris Men\'s Fashion Week" OR "Milan Men\'s Fashion Week" OR "London Fashion Week Men\'s" OR "New York Men\'s Day"') },
    { name: 'Collections', url: GN('menswear "spring/summer" OR "autumn/winter" OR "SS27" OR "AW27" collection men') },
  ],
  drops: [
    { name: 'Hypebeast', url: 'https://hypebeast.com/feed' },
    { name: 'Highsnobiety', url: 'https://www.highsnobiety.com/feed/' },
    { name: 'Drops & collabs', url: GN('menswear drop OR "capsule collection" OR collaboration OR "limited release" streetwear') },
    { name: 'Sneakers', url: GN('sneaker release OR "sneaker drop" OR "new colourway"') },
  ],
  trends: [
    { name: 'GQ', url: 'https://www.gq.com/feed/rss' },
    { name: 'Esquire', url: 'https://www.esquire.com/rss/all.xml/' },
    { name: 'Menswear trends', url: GN('"menswear trends" OR "men\'s style trends" OR "menswear trend" OR "how to wear" men') },
  ],
  design: [
    { name: 'Designers', url: GN('menswear designer OR "creative director" menswear OR "men\'s creative director" appointed') },
    { name: 'Menswear business', url: GN('menswear brand OR "men\'s fashion" business OR retail menswear') },
    { name: 'Business of Fashion', url: 'https://www.businessoffashion.com/feed/' },
  ],
}

// Feeds that also cover womenswear or general lifestyle: keep only stories
// that are clearly about men's fashion
const MENS = /\b(men|mens|men's|menswear|male|guy|guys|gentleman|gentlemen|suit|tailoring|streetwear|sneaker|sneakers|trainers|jacket|denim|boots?|watch|grooming|pitti|homme|uomo|nike|adidas|jordan|air max|new balance|asics|salomon|colou?rway|stone island|carhartt|arc'teryx|supreme|st[uü]ssy|palace)\b/i
const FILTERED = new Set(['Hypebeast', 'Highsnobiety', 'GQ', 'Esquire', 'Business of Fashion'])

const LIMITS = { runway: 12, drops: 9, trends: 9, design: 9 }
const UA = 'Mozilla/5.0 (compatible; JByrneNewsBot/1.0; +https://josephbyrne.org/menswear-brief)'

function timeout(ms) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return { signal: c.signal, done: () => clearTimeout(t) }
}

async function fetchText(url, ms = 15000) {
  const t = timeout(ms)
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: t.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally { t.done() }
}

// ---- tiny HTML-entity decoder ----
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ', '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8211': '–', '#8212': '—', '#38': '&', hellip: '…' }
function decodeEntities(s = '') {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code] != null ? ENTITIES[code] : m
  })
}

function stripTags(s = '') { return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() }
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim()
}
function attr(block, re) { const m = block.match(re); return m ? m[1] : '' }

function extractImage(block) {
  // media:content / media:thumbnail / enclosure / first <img> in description
  const raw =
    attr(block, /<media:content[^>]*\burl=["']([^"']+)["'][^>]*>/i) ||
    attr(block, /<media:thumbnail[^>]*\burl=["']([^"']+)["'][^>]*>/i) ||
    attr(block, /<enclosure[^>]*\burl=["']([^"']+)["'][^>]*type=["']image/i) ||
    attr(block, /<img[^>]*\bsrc=["']([^"']+)["']/i) ||
    ''
  // Decode entities (feeds often double-encode & as &amp; in the URL) so the
  // stored URL is clean and renders correctly once re-escaped in the attribute.
  return decodeEntities(raw).trim()
}

function parseFeed(xml, sourceName) {
  const items = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'))
    let link = tag(b, 'link')
    if (!link) link = attr(b, /<link[^>]*\bhref=["']([^"']+)["']/i) // Atom
    link = decodeEntities(link).trim()
    const dateRaw = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')
    const published = dateRaw ? new Date(dateRaw).toISOString() : null
    // Google News nests real source in <source>
    const gnSource = stripTags(tag(b, 'source'))
    const summary = stripTags(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')).slice(0, 180)
    const image = extractImage(b)
    if (!title || !link) continue
    // Google News titles end in " - Publisher": drop it, the publisher is shown separately
    const cleanTitle = gnSource && title.endsWith(' - ' + gnSource) ? title.slice(0, -(gnSource.length + 3)) : title
    items.push({ title: cleanTitle, url: link, source: gnSource || sourceName, published, image, summary })
  }
  return items
}

async function ogImage(url) {
  try {
    const html = await fetchText(url, 9000)
    const head = html.slice(0, 60000)
    const m =
      head.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    const img = m ? decodeEntities(m[1]) : ''
    // Google News redirect pages only offer Google's own logo, not the story's picture
    return /google|gstatic/i.test(img) ? '' : img
  } catch { return '' }
}

async function pool(items, worker, concurrency = 6) {
  const q = [...items]
  const runners = Array.from({ length: concurrency }, async () => {
    while (q.length) { const it = q.shift(); await worker(it) }
  })
  await Promise.all(runners)
}

function normKey(it) {
  return (it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
}

async function buildBucket(name, feeds, limit) {
  const results = await Promise.allSettled(feeds.map(f => fetchText(f.url).then(x => parseFeed(x, f.name))))
  let items = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...(FILTERED.has(feeds[i].name) ? r.value.filter(it => MENS.test(it.title + ' ' + (it.summary || ''))) : r.value))
    else console.warn(`[${name}] feed failed: ${feeds[i].name} — ${r.reason?.message || r.reason}`)
  })
  // dedupe by title, keep newest
  const seen = new Map()
  for (const it of items) {
    const k = normKey(it)
    if (!k) continue
    const prev = seen.get(k)
    if (!prev || (it.published && (!prev.published || it.published > prev.published))) seen.set(k, it)
  }
  items = [...seen.values()]
  items.sort((a, b) => (b.published || '').localeCompare(a.published || ''))
  items = items.slice(0, limit)
  // backfill images via og:image (best-effort)
  const missing = items.filter(it => !it.image)
  await pool(missing, async (it) => { it.image = await ogImage(it.url) }, 6)
  console.log(`[${name}] ${items.length} items, ${items.filter(i => i.image).length} with images`)
  return items
}

async function main() {
  const buckets = {}
  for (const [name, feeds] of Object.entries(FEEDS)) {
    try { buckets[name] = await buildBucket(name, feeds, LIMITS[name]) }
    catch (e) { console.error(`[${name}] bucket failed:`, e); buckets[name] = [] }
  }
  const total = Object.values(buckets).reduce((n, a) => n + a.length, 0)
  const data = { generatedAt: new Date().toISOString(), total, buckets }
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
  console.log(`\nWrote ${OUT} — ${total} stories across ${Object.keys(buckets).length} buckets.`)
  if (total === 0) process.exitCode = 1
}

main()
