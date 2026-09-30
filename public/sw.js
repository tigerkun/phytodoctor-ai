const CACHE_NAME = 'phyto-guard-v1.7';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://www.transparenttextures.com/patterns/leaves.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
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
        // Cache new assets if they are from the same origin or specific CDNs
        if (event.request.url.includes('transparenttextures') || event.request.url.includes('fonts.googleapis')) {
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
    icon: '/manifest.json',
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
        if ('focus' in win) return win.focus();
      }
      return clients.openWindow(target);
    })
  );
});
