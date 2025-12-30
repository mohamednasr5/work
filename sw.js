const CACHE_NAME = 'attendance-system-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event with network-first strategy for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Check if this is a Firebase request
  const isFirebaseRequest = event.request.url.includes('firebaseio.com');
  const isMapboxRequest = event.request.url.includes('mapbox.com');
  const isGoogleApi = event.request.url.includes('googleapis.com') || 
                      event.request.url.includes('gstatic.com');

  // For Firebase and external APIs, use network-first strategy
  if (isFirebaseRequest || isMapboxRequest || isGoogleApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache Firebase realtime data
          if (!isFirebaseRequest) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache for Mapbox/Google assets
          if (isMapboxRequest || isGoogleApi) {
            return caches.match(event.request);
          }
          return new Response('Offline - Firebase data unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  } else {
    // For local assets, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(event.request)
            .then((response) => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // Return offline page for HTML requests
              if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
              }
              
              // Return cached version if available
              return caches.match(event.request);
            });
        })
    );
  }
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendanceData());
  }
});

// Sync attendance data when back online
async function syncAttendanceData() {
  try {
    const db = await openAttendanceDB();
    const offlineRecords = await getAllOfflineRecords(db);
    
    for (const record of offlineRecords) {
      try {
        // Send to Firebase
        await syncRecordToFirebase(record);
        
        // Mark as synced
        await markRecordAsSynced(db, record.id);
      } catch (error) {
        console.error('Failed to sync record:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Helper functions for IndexedDB
function openAttendanceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('attendanceDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offlineRecords')) {
        const store = db.createObjectStore('offlineRecords', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

function getAllOfflineRecords(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineRecords'], 'readonly');
    const store = transaction.objectStore('offlineRecords');
    const index = store.index('synced');
    const request = index.getAll(false); // Get unsynced records
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function markRecordAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineRecords'], 'readwrite');
    const store = transaction.objectStore('offlineRecords');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'إشعار جديد من نظام الحضور',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('نظام الحضور والانصراف', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Periodically clean up old caches
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentTime = Date.now();
  
  for (const cacheName of cacheNames) {
    if (cacheName.startsWith('attendance-system-')) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const headers = response.headers;
          const date = headers.get('date');
          
          if (date && (currentTime - new Date(date).getTime()) > 7 * 24 * 60 * 60 * 1000) {
            await cache.delete(request);
          }
        }
      }
    }
  }
}

// Run cleanup once a day
setInterval(cleanupOldCaches, 24 * 60 * 60 * 1000);
