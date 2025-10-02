const CACHE_NAME = 'treemarkables-v5-mobile-fix';
const STATIC_CACHE = 'treemarkables-static-v5-mobile-fix';
const API_CACHE = 'treemarkables-api-v5-mobile-fix';

const urlsToCache = [
  '/',
  '/job-dashboard',
  '/dispatch',
  '/customers',
  '/tree-icon-192.png',
  '/tree-icon-512.png'
];

// Install event - cache critical assets
self.addEventListener('install', function(event) {
  console.log('[SW v5] Installing - FORCING immediate activation');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW v5] Installed - skipping waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches  
self.addEventListener('activate', function(event) {
  console.log('[SW v5] Activating - deleting ALL old caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      console.log('[SW v5] Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete ANY cache that's not v5
          if (!cacheName.includes('v5-mobile-fix')) {
            console.log('[SW v5] DELETING old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW v5] Taking control of all clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first for API, cache first for assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    // NEVER cache diary endpoints - always fetch fresh
    if (url.pathname.includes('/diary')) {
      console.log('[SW v5] Diary request - fetching fresh from network:', url.pathname);
      event.respondWith(
        fetch(event.request)
          .then(response => {
            console.log('[SW v5] Diary response received:', response.status);
            return response;
          })
          .catch(function(error) {
            console.error('[SW v5] Diary fetch failed:', error);
            throw error; // Don't fallback to cache for diary
          })
      );
      return;
    }
    
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Only cache successful GET requests
          if (event.request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Object storage (photos) - network first for fresh content
  if (url.pathname.startsWith('/objects/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Cache successful responses for offline access
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          // Fallback to cache if offline
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Navigation requests - serve cached index for offline SPA routing
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }
  
  // Static assets - cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(function(response) {
            // Cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then(function(cache) {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
      })
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