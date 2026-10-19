// Service worker — Bible Église Porte des Brebis (hors ligne)
// Pour publier une mise à jour : changer le numéro de VERSION.
const VERSION = 'v2';
const CACHE = 'bible-porte-des-brebis-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'bible-data.js',
  'icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'logo-eglise.jpeg', 'pasteur.jpeg',
  'oceans.m4a', 'jehovah-is-your-name.m4a'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(FILES.map(f =>
      fetch(f, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(f); return c.put(f, r); })
    ))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bible-porte-des-brebis-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// iOS/Safari demande des réponses « Range » pour l'audio : on les fabrique depuis le cache.
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let res = await cache.match(req, { ignoreSearch: true });
    if (!res && req.mode === 'navigate') res = await cache.match('index.html');
    if (!res) {
      try { return await fetch(req); } catch (err) { return new Response('Hors ligne', { status: 503 }); }
    }
    if (req.headers.has('range')) return rangeResponse(req, res);
    return res;
  })());
});
