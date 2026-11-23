// Holoul Maintenance service worker
// - The app opens straight from the phone (no waiting for the network); new versions download in the background.
// - Fonts are kept on the phone after the first visit.
// - Android: uploads waiting changes in the background, even after the app is closed (Background Sync).
importScripts('sync.js?v=9');

const CACHE = 'holoul-v9';
const FONTS = 'holoul-fonts';
const SHELL = ['./', 'index.html', 'sync.js?v=9', 'manifest.json', 'icon.svg', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API calls (POST) are never cached
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(cacheFirst(e, req.mode === 'navigate' ? 'index.html' : req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    }))));
  }
});

/** Answer from the phone right away; refresh the stored copy in the background. */
function cacheFirst(e, key) {
  return caches.open(CACHE).then(c => c.match(key, { ignoreSearch: typeof key === 'string' }).then(hit => {
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => typeof key === 'string' ? c.match('index.html') : Response.error());
  }));
}

// Background upload (Android Chrome). iPhone uploads while the app is open instead.
self.addEventListener('sync', e => {
  if (e.tag !== 'holoul-outbox') return;
  e.waitUntil(self.HoloulSync.flush().then(r => {
    if (r && !r.ok && !r.needLogin) throw new Error('retry later');   // the browser tries again later
  }));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'flush') e.waitUntil(self.HoloulSync.flush());
});
