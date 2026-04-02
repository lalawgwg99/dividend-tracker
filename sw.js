const CACHE_NAME = 'dividend-tracker-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/src/styles.css',
  '/src/main.js',
  '/src/calculations.js',
  '/src/charts.js',
  '/src/config.js',
  '/src/storage.js',
  '/src/utils.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isChartJs = request.url.includes('cdn.jsdelivr.net/npm/chart.js');

  if (isChartJs) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (request.url.startsWith(self.location.origin)) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match('/index.html')))
  );
});
