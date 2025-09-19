const CACHE_NAME = 'treemarkables-v1';
const urlsToCache = [
  '/',
  '/job-dashboard',
  '/src/main.tsx',
  '/src/index.css',
  'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Source+Sans+Pro:ital,wght@0,200..900;1,200..900&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Push notification handler
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'New job update available',
    icon: '/tree-icon-192.png',
    badge: '/tree-icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore', 
        title: 'View Jobs',
        icon: '/tree-icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/tree-icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Treemarkables Jobs', options)
  );
});