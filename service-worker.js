// service-worker.js
// Family Tree PWA Service Worker - Network First Strategy

const CACHE_NAME = 'family-tree-v14';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sample-data.js',
  './tree-layout.js',
  './tree-renderer.js',
  './relationship.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || new Response('Нет сети и нет кэша', { status: 503 });
        });
      })
    );
    return;
  }

  const isExternal = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].some(d => url.href.includes(d));
  if (isExternal) {
    event.respondWith(
      fetch(event.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
});
