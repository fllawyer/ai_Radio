const CACHE = 'claudio-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
