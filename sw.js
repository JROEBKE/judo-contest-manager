const CACHE_NAME = 'judo-turnier-v2';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './ui.js',
  './matches.js',
  './ranking.js',
  './print.js',
  './backup.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith('judo-turnier-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if(cachedResponse) return cachedResponse;

      try {
        return await fetch(event.request);
      } catch(error) {
        if(event.request.mode === 'navigate'){
          const cachedPage = await caches.match('./index.html');
          if(cachedPage) return cachedPage;
        }
        return new Response('Die angeforderte Ressource ist offline nicht verfügbar.', {
          status:503,
          headers:{'Content-Type':'text/plain; charset=utf-8'}
        });
      }
    })
  );
});