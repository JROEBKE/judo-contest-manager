const CACHE_NAME = 'judo-turnier-v7';
const ASSETS_TO_CACHE = [
  './index.html',
  './live.html',
  './manifest.json',
  './ui.js',
  './live.js',
  './matches.js',
  './ranking.js',
  './print.js',
  './backup.js',
  './service-worker-client.js',
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
      const requestUrl = new URL(event.request.url);
      if(event.request.mode === 'navigate' && requestUrl.search){
        const cachedPage = await caches.match(`${requestUrl.origin}${requestUrl.pathname}`);
        if(cachedPage) return cachedPage;
      }

      try {
        return await fetch(event.request);
      } catch(error) {
        if(event.request.mode === 'navigate'){
          const cachedIndex = await caches.match('./index.html');
          if(cachedIndex) return cachedIndex;
        }
        return new Response('Die angeforderte Ressource ist offline nicht verfügbar.', {
          status:503,
          headers:{'Content-Type':'text/plain; charset=utf-8'}
        });
      }
    })
  );
});