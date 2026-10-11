/* ============================================================
   VIDEO LIBRARY API | Cloudflare Worker + R2
   ------------------------------------------------------------
   Stores every video exactly as uploaded (no re-encoding), so a
   download is byte-for-byte the original file.

   Bindings (see wrangler.toml / SETUP.md):
     VIDEOS           R2 bucket
     UPLOAD_PASSCODE  secret: needed to upload or delete
     ALLOWED_ORIGINS  comma-separated sites allowed to call this API

   Routes
     GET    /api/videos                     list videos (+ metadata)
     POST   /api/check                      check the upload passcode
     POST   /api/uploads                    start a multipart upload
     PUT    /api/uploads/:id/:part?key=     upload one chunk
     POST   /api/uploads/:id/complete?key=  finish the upload
     DELETE /api/uploads/:id?key=           cancel an upload
     PUT    /api/thumbs?key=                save a thumbnail (JPEG)
     DELETE /api/videos?key=                delete a video
     GET    /v/<key>                        stream (Range aware)
     GET    /v/<key>?download=1             download the original file
     GET    /t/<key>                        thumbnail
   ============================================================ */

const MAX_FILE = 1024 * 1024 * 1024;       // 1 GB per video
const MAX_PART = 95 * 1024 * 1024;         // Workers accept request bodies up to 100 MB
const MAX_PARTS = 200;
const MAX_THUMB = 2 * 1024 * 1024;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp|ogv)$/i;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (err) {
      return json({ error: err.status ? err.message : 'Something went wrong' }, err.status || 500, cors);
    }
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const m = request.method;
  const key = url.searchParams.get('key');

  if (m === 'GET' && path === '/api/videos') return listVideos(env);
  if (m === 'POST' && path === '/api/check') { await requirePasscode(request, env); return json({ ok: true }); }

  if (m === 'POST' && path === '/api/uploads') {
    await requirePasscode(request, env);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').slice(0, 200);
    const size = Number(body.size);
    const type = String(body.type || '');
    if (!name || !(size > 0)) fail(400, 'Missing file name or size');
    if (size > MAX_FILE) fail(413, 'Videos must be under 1 GB');
    if (!type.startsWith('video/') && !VIDEO_EXT.test(name)) fail(415, 'Only video files can be uploaded');
    const id = Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 8);
    const objKey = `videos/${id}-${safeName(name)}`;
    const meta = {
      title: String(body.title || name).slice(0, 200),
      originalName: name,
      uploadedAt: new Date().toISOString(),
      size: String(size)
    };
    if (body.duration) meta.duration = String(Number(body.duration) || '');
    if (body.width && body.height) meta.dims = `${Number(body.width)}x${Number(body.height)}`;
    const upload = await env.VIDEOS.createMultipartUpload(objKey, {
      httpMetadata: { contentType: type || 'video/mp4' },
      customMetadata: meta
    });
    return json({ key: objKey, uploadId: upload.uploadId, partSize: MAX_PART });
  }

  let mm;
  if (m === 'PUT' && (mm = path.match(/^\/api\/uploads\/([^/]+)\/(\d+)$/))) {
    await requirePasscode(request, env);
    checkKey(key);
    const part = Number(mm[2]);
    if (part < 1 || part > MAX_PARTS) fail(400, 'Bad part number');
    const len = Number(request.headers.get('content-length'));
    if (!(len > 0) || len > MAX_PART) fail(413, 'Chunk too large');
    const upload = env.VIDEOS.resumeMultipartUpload(key, decodeURIComponent(mm[1]));
    const done = await upload.uploadPart(part, request.body);
    return json({ partNumber: done.partNumber, etag: done.etag });
  }

  if (m === 'POST' && (mm = path.match(/^\/api\/uploads\/([^/]+)\/complete$/))) {
    await requirePasscode(request, env);
    checkKey(key);
    const { parts } = await request.json();
    if (!Array.isArray(parts) || !parts.length) fail(400, 'No parts');
    const upload = env.VIDEOS.resumeMultipartUpload(key, decodeURIComponent(mm[1]));
    const obj = await upload.complete(parts.map(p => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })));
    if (obj.size > MAX_FILE) { await env.VIDEOS.delete(key); fail(413, 'Videos must be under 1 GB'); }
    return json({ ok: true, video: describe(obj) });
  }

  if (m === 'DELETE' && (mm = path.match(/^\/api\/uploads\/([^/]+)$/))) {
    await requirePasscode(request, env);
    checkKey(key);
    await env.VIDEOS.resumeMultipartUpload(key, decodeURIComponent(mm[1])).abort().catch(() => {});
    return json({ ok: true });
  }

  if (m === 'PUT' && path === '/api/thumbs') {
    await requirePasscode(request, env);
    checkKey(key);
    const len = Number(request.headers.get('content-length'));
    if (!(len > 0) || len > MAX_THUMB) fail(413, 'Thumbnail too large');
    await env.VIDEOS.put('thumbs/' + key.slice(7) + '.jpg', request.body, { httpMetadata: { contentType: 'image/jpeg' } });
    return json({ ok: true });
  }

  if (m === 'DELETE' && path === '/api/videos') {
    await requirePasscode(request, env);
    checkKey(key);
    await env.VIDEOS.delete([key, 'thumbs/' + key.slice(7) + '.jpg']);
    return json({ ok: true });
  }

  if ((m === 'GET' || m === 'HEAD') && path.startsWith('/v/')) return serveVideo(request, env, decodeURIComponent(path.slice(3)), url);
  if (m === 'GET' && path.startsWith('/t/')) {
    const obj = await env.VIDEOS.get('thumbs/' + decodeURIComponent(path.slice(3)).replace(/^videos\//, '') + '.jpg');
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
  }

  if (path === '/' || path === '') return json({ ok: true, service: 'video library' });
  return json({ error: 'Not found' }, 404);
}

/* ── Listing ── */
async function listVideos(env) {
  const videos = [];
  const thumbs = new Set();
  let cursor;
  do {
    const page = await env.VIDEOS.list({ prefix: 'thumbs/', cursor, limit: 1000 });
    page.objects.forEach(o => thumbs.add(o.key.slice(7, -4)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  do {
    const page = await env.VIDEOS.list({ prefix: 'videos/', cursor, include: ['customMetadata', 'httpMetadata'], limit: 1000 });
    page.objects.forEach(o => videos.push(Object.assign(describe(o), { thumb: thumbs.has(o.key.slice(7)) })));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  videos.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  return json({ videos }, 200, { 'Cache-Control': 'no-store' });
}

function describe(o) {
  const c = o.customMetadata || {};
  return {
    key: o.key,
    title: c.title || o.key.replace(/^videos\/[^-]+-[^-]+-/, ''),
    name: c.originalName || o.key.replace(/^videos\/[^-]+-[^-]+-/, ''),
    size: o.size,
    type: (o.httpMetadata && o.httpMetadata.contentType) || 'video/mp4',
    uploadedAt: c.uploadedAt || (o.uploaded && o.uploaded.toISOString()) || '',
    duration: c.duration ? Number(c.duration) : null,
    dims: c.dims || ''
  };
}

/* ── Streaming and downloads: the stored bytes, untouched ── */
async function serveVideo(request, env, key, url) {
  checkKey(key);
  const head = await env.VIDEOS.head(key);
  if (!head) return new Response('Not found', { status: 404 });
  const size = head.size;
  const range = parseRange(request.headers.get('range'), size);
  if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });

  const h = new Headers();
  head.writeHttpMetadata(h);
  h.set('Accept-Ranges', 'bytes');
  h.set('ETag', head.httpEtag);
  h.set('Cache-Control', 'private, max-age=3600');
  const name = (head.customMetadata && head.customMetadata.originalName) || key.split('/').pop();
  const download = url.searchParams.has('download');
  h.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);

  if (request.method === 'HEAD') { h.set('Content-Length', String(size)); return new Response(null, { headers: h }); }

  if (range) {
    const obj = await env.VIDEOS.get(key, { range: { offset: range.start, length: range.end - range.start + 1 } });
    h.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    h.set('Content-Length', String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers: h });
  }
  const obj = await env.VIDEOS.get(key);
  h.set('Content-Length', String(size));
  return new Response(obj.body, { headers: h });
}

function parseRange(header, size) {
  if (!header) return null;
  const m = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start, end;
  if (m[1] === '') { const n = Number(m[2]); start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/* ── Helpers ── */
async function requirePasscode(request, env) {
  const given = request.headers.get('x-passcode') || '';
  const want = env.UPLOAD_PASSCODE || '';
  if (!want) fail(500, 'Upload passcode not set on the server');
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(want);
  const ha = new Uint8Array(await crypto.subtle.digest('SHA-256', a));
  const hb = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  if (diff) fail(401, 'Wrong passcode');
}

function checkKey(key) {
  if (!key || !/^videos\/[A-Za-z0-9._-]+$/.test(key)) fail(400, 'Bad video key');
}

function safeName(n) {
  return n.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'video.mp4';
}
function asciiName(n) { return n.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_'); }

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Passcode, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
