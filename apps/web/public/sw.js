// FieldSync service worker (Phase 2 PWA, app shell only).
//
// What it caches: same-origin static assets (/_next/static,
// manifest, icon) and the /offline page. What it never caches:
// API calls (they live on a different origin), Clerk auth pages,
// or job/board pages — those are server-rendered with the
// signed-in user's data, so caching them would serve one
// user's jobs to another session or stale data.
// Navigation requests go network-first and fall back to
// /offline when the network is down.
const CACHE = 'fieldsync-v1';
const PRECACHE = ['/offline', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API + Clerk: network only

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline')),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/manifest.json' || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(request, res.clone()));
          return res;
        });
        return cached || network;
      }),
    );
  }
});
