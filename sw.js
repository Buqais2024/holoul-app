// Holoul Maintenance service worker
// - The app opens straight from the phone (no waiting for the network); new versions download in the background.
// - Fonts are kept on the phone after the first visit.
// - Android: uploads waiting changes in the background, even after the app is closed (Background Sync).
// - Phone notifications: new task assigned / task done (Web Push).
importScripts('sync.js?v=13');

const CACHE = 'holoul-v13';
const FONTS = 'holoul-fonts';
const SHELL = ['./', 'index.html', 'sync.js?v=13', 'dash.js?v=13', 'manifest.json', 'icon.svg', 'icon-512.png', 'apple-touch-icon.png', 'badge-96.png'];

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

/* ---------- notifications ----------
 * The server sends an empty push; we ask it what happened (pushInbox) and show it.
 * A notification is always shown (required by iPhone), even if the question fails. */
const WORDS = {
  en: { app: 'Holoul Maintenance', newTask: 'New task', newTasks: n => n + ' new tasks', done: 'Task done', generic: 'You have new tasks — open the app',
        test: 'Notifications work on this phone ✓', prio: { High: 'High priority', Urgent: 'URGENT' } },
  ar: { app: 'صيانة حلول', newTask: 'مهمة جديدة', newTasks: n => n + ' مهام جديدة', done: 'تم إنجاز مهمة', generic: 'لديك مهام جديدة — افتح التطبيق',
        test: 'الإشعارات تعمل على هذا الجوال ✓', prio: { High: 'أولوية عالية', Urgent: 'عاجلة' } }
};
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]); }

async function handlePush() {
  const lang = (await self.HoloulSync.kv.get('lang').catch(() => 'en')) === 'ar' ? 'ar' : 'en';
  const W = WORDS[lang];
  let msgs = [], open = null;
  try {
    const r = await withTimeout(self.HoloulSync.api('pushInbox', {}, 8000), 9000);
    if (r && r.ok) { msgs = r.messages || []; open = r.openTasks; }
  } catch (e) {}
  const assigned = msgs.filter(m => m.kind === 'assigned'), done = msgs.filter(m => m.kind === 'done');
  let title = W.app, body = W.generic, url = './#tasks', tag = 'holoul-tasks';
  if (assigned.length === 1) {
    const m = assigned[0];
    title = W.newTask + (W.prio[m.priority] ? ' · ' + W.prio[m.priority] : '');
    body = m.title + (m.equipment ? ' — ' + m.equipment : '');
  } else if (assigned.length > 1) {
    title = W.newTasks(assigned.length); body = assigned.map(m => m.title).join(' · ');
  } else if (done.length) {
    title = W.done; body = done.map(m => m.by + ': ' + m.title).join('\n'); url = './#dash'; tag = 'holoul-done';
  } else if (msgs.some(m => m.kind === 'test')) {
    title = W.app; body = W.test; tag = 'holoul-test';
  }
  await self.registration.showNotification(title, {
    body, tag, renotify: true, icon: 'icon-512.png', badge: 'badge-96.png',
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', vibrate: [200, 100, 200], data: { url }
  });
  try {
    if (open != null && self.navigator.setAppBadge) open ? await self.navigator.setAppBadge(open) : await self.navigator.clearAppBadge();
  } catch (e) {}
  self.HoloulSync.emit({ type: 'tasksChanged' });   // open app windows refresh their task list
}
self.addEventListener('push', e => e.waitUntil(handlePush()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.indexOf(self.registration.scope) === 0) { c.postMessage({ type: 'openFromNotification', url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
