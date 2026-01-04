// =====================================================
// Service Worker المحسن - مع تحسينات متقدمة للتخزين المؤقت
// Enhanced Service Worker with Advanced Caching
// =====================================================

const CACHE_NAME = 'parliament-app-v3.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/animations.css',
  '/icon-animations.css',
  '/install-button.css',
  '/app.js',
  '/firebase-config.js',
  '/charts.js',
  '/notifications.js',
  '/install-prompt.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Almarai:wght@300;400;700;800&display=swap'
];

// Install Event - Cache all static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 📦 Installing version 3.0.0...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 📚 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] ✅ All assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] ❌ Install error:', error);
      })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 🚀 Activating new version...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] 🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] ✅ Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch Event - Advanced caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: Firebase requests - Network first with aggressive caching
  if (url.hostname.includes('firebase') || url.hostname.includes('firebaseio')) {
    event.respondWith(
      this.firebaseStrategy(request)
    );
    return;
  }

  // Strategy 2: Local assets - Cache first, then network
  if (url.origin === location.origin || STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    event.respondWith(
      this.cacheFirstStrategy(request)
    );
    return;
  }

  // Strategy 3: External resources - Stale-while-revalidate
  if (EXTERNAL_RESOURCES.some(resource => request.url.startsWith(resource))) {
    event.respondWith(
      this.staleWhileRevalidateStrategy(request)
    );
    return;
  }

  // Strategy 4: Default - Network first with cache fallback
  event.respondWith(
    this.networkFirstStrategy(request)
  );
});

// Firebase Strategy - Network first with aggressive caching
firebaseStrategy(request) {
  return fetch(request)
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
    .catch(() => {
      return caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Return offline data if available
          if (request.url.includes('parliament-requests')) {
            return this.getOfflineRequests();
          }
          
          return new Response(JSON.stringify({ error: 'Offline mode' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        });
    });
}

// Cache First Strategy - For static assets
cacheFirstStrategy(request) {
  return caches.match(request)
    .then((response) => {
      if (response) {
        // Update cache in background
        this.updateCache(request);
        return response;
      }
      
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return offline page for document requests
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
    });
}

// Stale While Revalidate Strategy - For external resources
staleWhileRevalidateStrategy(request) {
  return caches.match(request)
    .then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Ignore fetch errors
        });

      return cachedResponse || fetchPromise;
    });
}

// Network First Strategy - Default strategy
networkFirstStrategy(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok && request.method === 'GET') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
      }
      return response;
    })
    .catch(() => {
      return caches.match(request);
    });
}

// Update cache in background
updateCache(request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
      }
    })
    .catch(() => {
      // Ignore errors
    });
}

// Get offline requests data
getOfflineRequests() {
  return new Response(JSON.stringify({
    offline: true,
    timestamp: new Date().toISOString(),
    message: 'Working in offline mode'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(this.syncFailedRequests());
  }
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(this.syncNotifications());
  }
});

async syncFailedRequests() {
  console.log('[Service Worker] 🔄 Syncing failed requests...');
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const failedRequests = requests.filter(req => 
      req.url.includes('firebase') && 
      !req.url.includes('parliament-requests')
    );
    
    for (const request of failedRequests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.put(request, response);
          console.log(`[Service Worker] ✅ Synced: ${request.url}`);
        }
      } catch (error) {
        console.error(`[Service Worker] ❌ Sync error for ${request.url}:`, error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] ❌ Sync failed:', error);
  }
}

async syncNotifications() {
  console.log('[Service Worker] 🔔 Syncing notifications...');
  
  try {
    // Implement notification sync logic here
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_NOTIFICATIONS',
        data: { timestamp: new Date().toISOString() }
      });
    });
  } catch (error) {
    console.error('[Service Worker] ❌ Notification sync failed:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] 📨 Message received:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'CLEAR_CACHE':
      this.clearCache(event);
      break;
      
    case 'GET_CACHE_INFO':
      this.getCacheInfo(event);
      break;
      
    case 'UPDATE_CACHE':
      this.updateSpecificCache(data, event);
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      event.ports[0].postMessage({ success: true, message: 'Skipped waiting' });
      break;
      
    case 'CHECK_UPDATES':
      this.checkForUpdates(event);
      break;
  }
});

async clearCache(event) {
  try {
    await caches.delete(CACHE_NAME);
    event.ports[0].postMessage({ 
      success: true, 
      message: 'Cache cleared successfully' 
    });
  } catch (error) {
    event.ports[0].postMessage({ 
      success: false, 
      error: error.message 
    });
  }
}

async getCacheInfo(event) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const info = {
      cacheName: CACHE_NAME,
      totalItems: requests.length,
      size: await this.calculateCacheSize(cache),
      items: requests.map(req => ({
        url: req.url,
        method: req.method
      }))
    };
    
    event.ports[0].postMessage({ success: true, info });
  } catch (error) {
    event.ports[0].postMessage({ 
      success: false, 
      error: error.message 
    });
  }
}

async calculateCacheSize(cache) {
  const requests = await cache.keys();
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  // Convert to human readable format
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = totalSize;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async updateSpecificCache(urls, event) {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error(`[Service Worker] ❌ Failed to update ${url}:`, error);
      }
    }
    
    event.ports[0].postMessage({ 
      success: true, 
      message: `Updated ${urls.length} items` 
    });
  } catch (error) {
    event.ports[0].postMessage({ 
      success: false, 
      error: error.message 
    });
  }
}

async checkForUpdates(event) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheVersion = CACHE_NAME.split('-v')[1];
    
    // Check for new version
    const response = await fetch('/version.json');
    const data = await response.json();
    
    if (data.version !== cacheVersion) {
      event.ports[0].postMessage({
        success: true,
        updateAvailable: true,
        currentVersion: cacheVersion,
        newVersion: data.version
      });
    } else {
      event.ports[0].postMessage({
        success: true,
        updateAvailable: false,
        currentVersion: cacheVersion
      });
    }
  } catch (error) {
    event.ports[0].postMessage({
      success: false,
      error: error.message
    });
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] 📲 Push notification received');
  
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'تحديث جديد في النظام',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'parliament-update',
    data: data.data || {},
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
    self.registration.showNotification(data.title || 'نظام إدارة الطلبات', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' })
        .then((clientList) => {
          if (clientList.length > 0) {
            return clientList[0].focus();
          }
          return self.clients.openWindow('/');
        })
    );
  }
});

// Periodic sync (for background updates)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    console.log('[Service Worker] 🔄 Periodic sync triggered');
    event.waitUntil(this.periodicCacheUpdate());
  }
});

async periodicCacheUpdate() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Update static assets
    for (const url of STATIC_ASSETS) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error(`[Service Worker] ❌ Failed to update ${url}:`, error);
      }
    }
    
    console.log('[Service Worker] ✅ Periodic cache update completed');
  } catch (error) {
    console.error('[Service Worker] ❌ Periodic sync failed:', error);
  }
}

// Log service worker lifecycle
console.log('[Service Worker] ✅ Loaded and ready for offline support');
