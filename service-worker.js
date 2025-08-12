const CACHE_NAME = 'cookbook-final-shell-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(req, copy));
        return res;
      }).catch(()=>caches.match(req).then(cached => cached || caches.match('/')))
    );
    return;
  }
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (req.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME).then(cache=>cache.put(req, res.clone()));
          }
          return res;
        }).catch(()=> new Response('', {status:404, statusText:'offline'}));
      })
    );
  }
});
