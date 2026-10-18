/**
 * DevShelf Service Worker
 * Offline Application Shell Caching & Navigation Fallback
 * 
 * STRICT DATA PRIVACY:
 * IndexedDB is the SOLE persistent store for snippets.
 * NO snippet data, titles, tags, code, backups, or credentials
 * are ever stored in Cache Storage. Only static app shell assets
 * (HTML, CSS, JS, icons, manifest) are cached.
 */

const CACHE_NAME = __CACHE_NAME__;
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;

// 1. Installation: Precache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[DevShelf SW] Precache failed during install:', err);
      })
  );
});

// 2. Activation: Clean up old/stale application caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith('devshelf-') && name !== CACHE_NAME) {
              return caches.delete(name);
            }
            return null;
          })
        );
      })
      .then(() => {
        // Take immediate control of all open client tabs
        return self.clients.claim();
      })
  );
});

// 3. Fetch Event: Safe Offline Routing & Cache Policy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http/https schemes (e.g. chrome-extension, data:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Handle SPA Navigation requests (request.mode === 'navigate')
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline navigation fallback: serve cached index.html
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;

          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          return caches.match(request);
        })
    );
    return;
  }

  // Handle Static Asset requests (same-origin static files, fonts, icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fetch from network and cache successful response
        return fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse && 
              networkResponse.status === 200 && 
              networkResponse.type === 'basic'
            ) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Asset unavailable offline and not in cache
            return new Response('', { status: 404, statusText: 'Offline Asset Not Cached' });
          });
      })
    );
    return;
  }

  // Handle external fonts or CDN dependencies (e.g., Google Fonts)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response('', { status: 404, statusText: 'Font unavailable offline' });
          });
      })
    );
  }
});
