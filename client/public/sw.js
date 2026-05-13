const CACHE_NAME = 'treemarkables-v16-mutation-bypass';
const STATIC_CACHE = 'treemarkables-static-v16-mutation-bypass';
const API_CACHE = 'treemarkables-api-v16-mutation-bypass';

// ONLY cache static assets, NEVER cache HTML pages
const urlsToCache = [
  '/tree-icon-192.png',
  '/tree-icon-512.png'
];

// Install event - cache critical assets
self.addEventListener('install', function(event) {
  console.log('[SW v16] Installing - forcing immediate activation');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW v16] Installed - skipping waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', function(event) {
  console.log('[SW v16] Activating - deleting ALL old caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      console.log('[SW v16] Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (!cacheName.includes('v16-mutation-bypass')) {
            console.log('[SW v16] DELETING old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW v16] Taking control of all clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first for API, cache first for assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // BYPASS Service Worker entirely for any non-GET request. Mutations must go
  // straight to the network with the browser's normal cookie/credentials
  // handling — PWA users were hitting 401s on PUT because the SW's
  // fetch(event.request) round-trip was dropping the session cookie in some
  // Chromium contexts. Leaving event.respondWith uncalled lets the browser
  // handle the request natively, with cookies attached.
  if (event.request.method !== 'GET') {
    return;
  }

  // BYPASS Service Worker entirely for critical Dispatch Board endpoints
  if (url.pathname === '/api/jobs' ||
      url.pathname === '/api/customers' ||
      url.pathname === '/api/staff-assignments' ||
      url.pathname === '/api/conversations' ||
      url.pathname.includes('/api/conversations/')) {
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    // NEVER cache diary endpoints - always fetch fresh
    if (url.pathname.includes('/diary')) {
      event.respondWith(fetch(event.request, { credentials: 'include' }));
      return;
    }

    // GET requests - network first, cache fallback. Explicit credentials so
    // the SW-mediated fetch behaves the same as the original page fetch.
    event.respondWith(
      fetch(event.request, { credentials: 'include' })
        .then(function(response) {
          if (response.status === 200) {
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
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then(function(cache) {
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

  // Navigation requests - ALWAYS fetch fresh HTML (never cache index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'reload' })
        .catch(function() {
          return new Response('Offline - please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // JS and CSS files - ALWAYS network first so code changes appear immediately
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.css') || url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then(function(cache) {
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

  // Other static assets (images, icons) - cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(function(response) {
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

// Push notification handler — supports both Firebase JSON format and plain text
self.addEventListener('push', function(event) {
  var title = 'Treemarkables';
  var body = 'New job update available';
  var clickUrl = '/dispatch';
  var tag = 'general';

  if (event.data) {
    try {
      // Firebase sends JSON: { notification: { title, body }, data: { clickAction, type } }
      var payload = event.data.json();
      var notif = payload.notification || {};
      var data = payload.data || {};
      title = notif.title || payload.title || title;
      body = notif.body || payload.body || body;
      clickUrl = data.clickAction || notif.click_action || clickUrl;
      tag = data.type || tag;
    } catch (e) {
      // Plain text fallback
      body = event.data.text() || body;
    }
  }

  var options = {
    body: body,
    icon: '/tree-icon-192.png',
    badge: '/tree-icon-192.png',
    tag: tag,
    data: { clickUrl: clickUrl },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Open the app when a notification is tapped
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var clickUrl = (event.notification.data && event.notification.data.clickUrl) || '/dispatch';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          client.navigate(clickUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    })
  );
});
