// v2.1 — two policies only:
//   1. Immutable responses (content-hashed /assets/ and the font CDNs) are
//      cache-first: the same URL can never mean different bytes.
//   2. Everything else we own is network-first, and every fresh response
//      refreshes its stored copy, so deploys arrive without a version bump.
//      Offline, the page falls back to the precached shell and files to their
//      last copy. /api/ is never cached at all.
// The activate handler evicts caches from older versions on load.
const CACHE_NAME = 'phyto-guard-v2.1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&display=swap'
];

// cache.addAll() is atomic — one bad URL kills the whole install, and a dead
// precache entry once took this worker down entirely. One at a time instead;
// a missing file is not worth the offline shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // GET /api/ used to be runtime-cached: an empty request board was cached and
  // replayed forever, so a posted request never appeared. Authenticated
  // responses must never be stored at all — fall through untouched.
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const immutable =
    (sameOrigin && url.pathname.startsWith('/assets/')) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (immutable) {
    event.respondWith(
      caches.match(event.request).then((hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
      )
    );
    return;
  }

  // Navigations and other same-origin files. Navigations store under '/' so
  // the whole SPA shares one offline shell.
  if (sameOrigin) {
    const cacheKey = event.request.mode === 'navigate' ? '/' : event.request;
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(cacheKey).then((hit) => hit || caches.match('/index.html'))
        )
    );
  }
  // Other cross-origin traffic passes through untouched.
});

// Push and notificationclick must be registered at the top level of the
// worker script: they once sat inside the fetch handler, so a push arriving
// before any fetch found no listener and the notification was dropped.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'PhytoDoctor alert', {
    body: data.body || 'A specimen needs your attention.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'plant-alert',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    // Reuse an open tab where possible, and navigate it to the alert's plant.
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          return win.focus().then((focused) =>
            focused && typeof focused.navigate === 'function'
              ? focused.navigate(target).catch(() => {})
              : focused
          );
        }
      }
      return clients.openWindow(target);
    })
  );
});
