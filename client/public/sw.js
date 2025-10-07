const CACHE_NAME = 'treemarkables-v10-thumbnail-fix';
const STATIC_CACHE = 'treemarkables-static-v10-thumbnail-fix';
const API_CACHE = 'treemarkables-api-v10-thumbnail-fix';

// ONLY cache static assets, NEVER cache HTML pages
const urlsToCache = [
  '/tree-icon-192.png',
  '/tree-icon-512.png'
];

// Install event - cache critical assets
self.addEventListener('install', function(event) {
  console.log('[SW v7] Installing - Mutations never cached - FORCING immediate activation');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW v7] Installed - skipping waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches  
self.addEventListener('activate', function(event) {
  console.log('[SW v9] Activating - deleting ALL old caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      console.log('[SW v9] Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete ANY cache that's not v10
          if (!cacheName.includes('v10-thumbnail-fix')) {
            console.log('[SW v10] DELETING old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW v9] Taking control of all clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first for API, cache first for assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // BYPASS Service Worker entirely for critical Dispatch Board endpoints
  // These endpoints use localStorage fallback in React Query and must not be intercepted
  if (url.pathname === '/api/jobs' || 
      url.pathname === '/api/customers' || 
      url.pathname === '/api/staff-assignments') {
    console.log('[SW v9] BYPASSING Service Worker for localStorage-backed endpoint:', url.pathname);
    // Don't call event.respondWith() - let the browser handle it directly
    return;
  }
  
  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    // CRITICAL: NEVER cache or return cached responses for POST/PUT/DELETE (mutations)
    if (event.request.method !== 'GET') {
      console.log('[SW v7] Mutation request - bypassing cache:', event.request.method, url.pathname);
      event.respondWith(
        fetch(event.request)
          .then(response => {
            console.log('[SW v7] Mutation response:', response.status);
            return response;
          })
          .catch(function(error) {
            console.error('[SW v7] Mutation fetch failed:', error);
            throw error; // NEVER fallback to cache for mutations
          })
      );
      return;
    }
    
    // NEVER cache diary endpoints - always fetch fresh
    if (url.pathname.includes('/diary')) {
      console.log('[SW v7] Diary request - fetching fresh from network:', url.pathname);
      event.respondWith(
        fetch(event.request)
          .then(response => {
            console.log('[SW v7] Diary response received:', response.status);
            return response;
          })
          .catch(function(error) {
            console.error('[SW v7] Diary fetch failed:', error);
            throw error; // Don't fallback to cache for diary
          })
      );
      return;
    }
    
    // GET requests - network first, cache fallback
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Only cache successful GET requests
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          // Only fallback to cache for GET requests
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
  
  // Navigation requests - ALWAYS fetch fresh HTML (never cache index.html)
  if (event.request.mode === 'navigate') {
    console.log('[SW v7] Navigation request - fetching fresh HTML:', event.request.url);
    event.respondWith(
      fetch(event.request, { cache: 'reload' })
        .then(function(response) {
          console.log('[SW v7] Fresh HTML loaded:', response.status);
          return response;
        })
        .catch(function(error) {
          console.error('[SW v7] HTML fetch failed:', error);
          // Show offline page instead of cached stale HTML
          return new Response('Offline - please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
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