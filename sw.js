const CACHE_NAME = 'attendance-app-v2';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', evt => {
  // استراتيجية الكاش أولاً ثم الشبكة
  evt.respondWith(
    caches.match(evt.request).then(res => res || fetch(evt.request))
  );
});
