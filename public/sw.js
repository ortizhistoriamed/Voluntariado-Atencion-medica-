const CACHE_NAME = 'voluntario-v1';
const ASSETS = [
  '/',
  '/manifest.json',
  'https://cdn-icons-png.flaticon.com/512/3774/3774299.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
