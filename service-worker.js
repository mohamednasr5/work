// service-worker.js - PWA Service Worker

const CACHE_NAME = 'parliament-v1.0.0';
const RUNTIME_CACHE = 'parliament-runtime-v1.0.0';

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

// Install event
self.addEventListener('install', (event) => {
  console.log('⚙️ Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell...');
        return cache.addAll(PRECACHE_URLS).catch((error) => {
          console.warn('⚠️ Some resources failed to cache:', error);
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
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

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  // Skip Firebase requests (always use network)
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(() => {
          // Return basic offline page
          if (event.request.mode === 'navigate') {
            return new Response(`
              <!DOCTYPE html>
              <html lang="ar" dir="rtl">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>غير متصل</title>
                <style>
                  body {
                    font-family: 'Cairo', sans-serif;
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
                  h1 { font-size: 48px; margin-bottom: 20px; }
                  p { font-size: 20px; margin-bottom: 30px; }
                  button {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 50px;
                    font-size: 18px;
                    font-weight: 700;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <div>
                  <h1>📡 غير متصل</h1>
                  <p>يرجى التحقق من اتصالك بالإنترنت</p>
                  <button onclick="window.location.reload()">إعادة المحاولة</button>
                </div>
              </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        });
      })
  );
});
