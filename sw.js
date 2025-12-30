const CACHE_NAME = 'attendance-system-v3';

const urlsToCache = [
    '/',
    '/index.html',
    '/admin.html',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const isFirebaseRequest = event.request.url.includes('firebaseio.com') || 
                              event.request.url.includes('googleapis.com');
    const isGoogleMaps = event.request.url.includes('maps.googleapis.com') ||
                         event.request.url.includes('maps.gstatic.com');

    if (isFirebaseRequest || isGoogleMaps) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => response || fetch(event.request))
        );
    }
});
