// Bumped to v1.9: v1.8 runtime-cached GET /api/ responses, so every signed-in
// device already holds stale API entries. The activate handler drops any cache
// that is not the current one, which evicts them all on the next load.
const CACHE_NAME = 'phyto-guard-v1.9';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&display=swap'
];

// Added one at a time, and a failure is logged rather than thrown.
//
// cache.addAll() is atomic: one rejected entry rejects the whole install, and a
// rejected install means the worker never activates. That is not theoretical
// here -- the precache list used to include a transparenttextures.com texture
// that now returns 404, which silently killed every install. Nothing in the UI
// referenced that texture, and the cost was total: no offline shell, and no
// `push` listener, so alerts a user had subscribed to were never delivered.
//
// A missing background image is not worth losing the worker over.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((error) => {
            console.warn('[sw] precache skipped', url, error);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Database operations are handled by IndexedDB directly (Dexie),
  // so we skip caching API or DB calls here.
  if (event.request.method !== 'GET') return;

  // API responses must NEVER be served from the cache, and must never be
  // stored in it.
  //
  // The check above only skips NON-GET, so every GET to /api/ used to fall
  // through to the cache-first branch below and get runtime-cached. Two real
  // consequences, both observed in production:
  //
  // 1. Stale forever. The request board loaded once while empty, that empty
  //    response was cached, and every later load replayed it -- so a player
  //    could post a request, be told it succeeded, and never see it appear.
  //
  // 2. Cross-user leak. The Cache API matches on URL and method only; it
  //    ignores the Authorization header. A `/api/economy/profile` response
  //    cached for one signed-in player was therefore handed to whoever signed
  //    in next on the same device -- another player's seed balance on screen.
  //
  // Returning here lets the request fall through to the network untouched.
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;

  // Navigation requests (the app shell) go network-first so deploys reach
  // users immediately; the cache is only the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
        return networkResponse;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        // Runtime-cache the stylesheet we depend on. Only same-origin and the
        // font CDN: caching an arbitrary cross-origin response would store a
        // 404 the page then serves forever.
        const url = event.request.url;
        const cacheable =
          url.startsWith(self.location.origin) || url.includes('fonts.googleapis');
        if (cacheable && networkResponse.ok) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for offline access
        return caches.match('/index.html');
      });
    })
  );
});

// These have to be registered at the top level of the worker script. They used
// to sit inside the fetch handler above, which meant they were only registered
// as a side effect of a page fetch and were re-registered on every one — a push
// arriving before any fetch would find no listener at all, so the notification
// was silently dropped.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    // A push with a non-JSON body is still worth showing; fall back to the
    // text payload rather than dropping the notification entirely.
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'PhytoDoctor alert', {
    body: data.body || 'A specimen needs your attention.',
    // An icon has to be an image the notifier can decode. This used to point at
    // /manifest.json, which is JSON -- every alert rendered with a blank or
    // broken icon, and no error surfaced to explain why.
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
    // Prefer reusing an open tab so tapping a notification does not pile up
    // duplicate copies of the app.
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          // Focusing alone is not enough. The alert names a plant, and
          // reusing a tab that is sitting on some unrelated page left the
          // tap looking like it did nothing at all.
          return win.focus().then((focused) => {
            if (focused && typeof focused.navigate === 'function') {
              return focused.navigate(target).catch(() => {});
            }
            return focused;
          });
        }
      }
      return clients.openWindow(target);
    })
  );
});
