// Service Worker - Offline Support & Caching Strategy
// خادم رسالة - دعم عمل بلا إنترنت واستراتيجية التخزين المؤقت

const CACHE_NAME = 'parliament-app-v2.0.0';
const STATIC_ASSETS = [
  '/work/',
  '/work/index.html',
  '/work/style.css',
  '/work/animations.css',
  '/work/app.js',
  '/work/firebase-config.js',
  '/work/charts.js',
  '/work/notifications.js',
  '/work/manifest.json'
];

const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
];

// Install Event - Cache all static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[Service Worker] Installed and cached');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[Service Worker] Install error:', error);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activated');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Firebase requests - Network first
  if (url.hostname.includes('firebase') || url.hostname.includes('firebaseio')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          }
          return caches.match(request);
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Local assets - Cache first
  if (url.origin === location.origin || STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            if (response.ok && request.method === 'GET') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Return offline page or cached response
          if (request.destination === 'document') {
            return caches.match('/work/index.html');
          }
        })
    );
    return;
  }

  // External resources - Network first with cache fallback
  if (EXTERNAL_RESOURCES.some(resource => request.url.startsWith(resource))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          }
          return caches.match(request);
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Default - Network first
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request))
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  console.log('[Service Worker] Syncing failed requests...');
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.error('[Service Worker] Sync error:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true, message: 'Cache cleared' });
    });
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((requests) => {
        event.ports[0].postMessage({ size: requests.length, items: requests.length });
      });
    });
  }
});

console.log('[Service Worker] Loaded and ready for offline support');
