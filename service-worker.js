// service-worker.js
// Family Tree PWA Service Worker - Full Offline Cache Strategy

const CACHE_NAME = 'family-tree-v10';

// All app files to pre-cache on install
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
];

// External resources to cache dynamically on first request
const CACHE_EXTERNALS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
];

// Install: pre-cache all local app files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app files...');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      console.log('[SW] Pre-cache complete. Activating immediately.');
      return self.skipWaiting();
    })
  );
});

// Activate: delete old caches if any
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Active. Claiming all clients.');
      return self.clients.claim();
    })
  );
});

// Fetch: Cache-First for local files, Network-First for external
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For navigation requests (HTML pages) - use cache first, then network
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        return cached || fetch(event.request).catch(() => {
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Local app files: Cache First strategy
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Serve from cache; also update cache in background
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          }).catch(() => null);

          return cached;
        }
        // Not in cache, try network
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => new Response('Файл недоступен в офлайн-режиме', { status: 503 }));
      })
    );
    return;
  }

  // External CDN resources (fonts, icons): Network first, fallback to cache
  const isExternal = CACHE_EXTERNALS.some(domain => url.href.includes(domain));
  if (isExternal) {
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
        return caches.match(event.request);
      })
    );
    return;
  }

  // Avatar images from Unsplash (cache when loaded online, show cached offline)
  if (url.hostname.includes('unsplash.com') || url.hostname.includes('images.unsplash.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => new Response('Avatar unavailable offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
      })
    );
    return;
  }
});
