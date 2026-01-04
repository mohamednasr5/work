// service-worker.js - PWA Service Worker Enhanced

const CACHE_NAME = 'parliament-v1.0.2';
const RUNTIME_CACHE = 'parliament-runtime-v1.0.2';
const EXTERNAL_CACHE = 'parliament-external-v1.0.2';

// Basic files to cache
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase-config.js',
  './install.js',
  './manifest.json'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js'
];

// Install event - cache all resources
self.addEventListener('install', (event) => {
  console.log('⚙️ Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache local files
      caches.open(CACHE_NAME).then((cache) => {
        console.log('📦 Caching app shell...');
        return cache.addAll(PRECACHE_URLS).catch((error) => {
          console.warn('⚠️ Some local resources failed to cache:', error);
          return Promise.resolve();
        });
      }),
      // Cache external resources
      caches.open(EXTERNAL_CACHE).then((cache) => {
        console.log('🌐 Caching external resources...');
        return Promise.all(
          EXTERNAL_RESOURCES.map((url) => {
            return fetch(url, { mode: 'cors' })
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch((error) => {
                console.warn(`⚠️ Failed to cache ${url}:`, error.message);
              });
          })
        );
      })
    ])
    .then(() => {
      console.log('✅ Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== EXTERNAL_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') return;
  
  // Skip Firebase real-time database (always use network)
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle different resource types
  if (isExternalResource(url)) {
    // External resources: Cache first, then network
    event.respondWith(cacheFirst(request, EXTERNAL_CACHE));
  } else if (isLocalResource(url)) {
    // Local resources: Cache first, then network
    event.respondWith(cacheFirst(request, CACHE_NAME));
  } else {
    // Other resources: Network first, then cache
    event.respondWith(networkFirst(request));
  }
});

/**
 * Check if URL is an external resource
 */
function isExternalResource(url) {
  return url.hostname.includes('googleapis.com') ||
         url.hostname.includes('cdnjs.cloudflare.com') ||
         url.hostname.includes('jsdelivr.net') ||
         url.hostname.includes('gstatic.com');
}

/**
 * Check if URL is a local resource
 */
function isLocalResource(url) {
  return url.hostname === location.hostname || 
         url.hostname === 'localhost';
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName) {
  try {
    // Try cache first
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Update cache in background
      updateCache(request, cacheName);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.ok) {
      // Cache for future use
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache-first error:', error);
    return handleOffline(request);
  }
}

/**
 * Network-first strategy
 */
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.ok) {
      // Cache for offline use
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // If network fails, try cache
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return handleOffline(request);
  }
}

/**
 * Update cache in background
 */
async function updateCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silent fail - we already have cached version
  }
}

/**
 * Handle offline scenarios
 */
function handleOffline(request) {
  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    return new Response(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>غير متصل - نظام البرلمان</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 500px;
            animation: fadeIn 0.5s ease;
          }
          .icon {
            font-size: 100px;
            margin-bottom: 30px;
            animation: pulse 2s infinite;
          }
          h1 { 
            font-size: 36px; 
            margin-bottom: 20px;
            font-weight: 900;
          }
          p { 
            font-size: 18px; 
            margin-bottom: 30px;
            opacity: 0.9;
            line-height: 1.8;
          }
          button {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          }
          button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
          }
          button:active {
            transform: translateY(-1px);
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          @media (max-width: 768px) {
            .icon { font-size: 70px; }
            h1 { font-size: 28px; }
            p { font-size: 16px; }
            button { padding: 12px 30px; font-size: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>غير متصل بالإنترنت</h1>
          <p>
            عذراً، يبدو أنك غير متصل بالإنترنت حالياً.<br>
            يرجى التحقق من اتصالك والمحاولة مرة أخرى.
          </p>
          <button onclick="window.location.reload()">
            إعادة المحاولة
          </button>
        </div>
      </body>
      </html>
    `, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      })
    });
  }
  
  // Return error response for other requests
  return new Response('محتوى غير متوفر بدون اتصال', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain; charset=utf-8'
    })
  });
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  console.log('🔄 Syncing offline data...');
  // Placeholder for future offline data sync
}

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'تنبيه جديد';
  const options = {
    body: data.body || 'لديك إشعار جديد من نظام البرلمان',
    icon: data.icon || './manifest.json',
    badge: './manifest.json',
    vibrate: [200, 100, 200],
    tag: data.tag || 'parliament-notification',
    requireInteraction: false,
    data: data,
    actions: [
      {
        action: 'open',
        title: 'فتح'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

console.log('🚀 Service Worker loaded successfully');
