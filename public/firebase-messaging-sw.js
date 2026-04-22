// Firebase Cloud Messaging Service Worker
// This runs in the background to handle push notifications even when app is closed

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config and messaging instance
let firebaseConfig = null;
let messaging = null;
let isInitialized = false;

// Fetch Firebase config from API and initialize with retry
async function initializeFirebaseInServiceWorker(retryCount = 0) {
  if (isInitialized) {
    return true;
  }
  
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  try {
    console.log(`🔧 Fetching Firebase config from API (attempt ${retryCount + 1}/${maxRetries + 1})...`);
    const response = await fetch('/api/firebase-config');
    const data = await response.json();
    
    if (!data.success || !data.configured || !data.config) {
      console.warn('⚠️ Firebase not configured yet - push notifications disabled');
      return false;
    }
    
    firebaseConfig = data.config;
    
    // Initialize Firebase with the fetched config
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
    isInitialized = true;
    
    console.log('✅ Firebase initialized in service worker');
    
    // Set up background message handler
    setupBackgroundMessageHandler();
    
    return true;
  } catch (error) {
    console.error(`❌ Error initializing Firebase (attempt ${retryCount + 1}):`, error);
    
    // Retry with exponential backoff
    if (retryCount < maxRetries) {
      const delay = retryDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeFirebaseInServiceWorker(retryCount + 1);
    }
    
    console.error('❌ Failed to initialize Firebase after max retries');
    return false;
  }
}

// Setup background message handler
function setupBackgroundMessageHandler() {
  if (!messaging) {
    console.error('Cannot setup background message handler - messaging not initialized');
    return;
  }
  
  // Handle background messages (when app is in background or closed)
  messaging.onBackgroundMessage((payload) => {
    console.log('📬 Background notification received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Treemarkables Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.type || 'default',
    requireInteraction: false,
    data: payload.data || {},
    actions: []
  };

  // Add action buttons based on notification type
  if (payload.data?.type === 'job_assignment') {
    notificationOptions.actions = [
      { action: 'view', title: 'View Job' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
  }

    // Show the notification
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event);
  
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }
  
  // Determine where to navigate based on notification data
  let urlToOpen = '/dispatch'; // Default
  
  if (event.notification.data) {
    const { type, jobId, conversationId } = event.notification.data;

    switch (type) {
      case 'job_assignment':
      case 'schedule_change':
        // Navigate directly to the specific job if we have its ID
        urlToOpen = jobId ? `/dispatch?job=${jobId}` : '/dispatch';
        break;
      case 'new_lead':
        urlToOpen = '/conversations';
        break;
      case 'new_conversation':
      case 'conversation_reply':
        // Once a conversation has been converted to a lead/job, notifications
        // deep-link to that job card's diary tab. Pre-lead conversations (no
        // job yet) still land on the conversation detail page.
        if (jobId) {
          urlToOpen = `/dispatch?job=${jobId}&tab=diary`;
        } else if (conversationId) {
          urlToOpen = `/conversation/${conversationId}`;
        } else {
          urlToOpen = '/conversations';
        }
        break;
      case 'invoice_payment':
        urlToOpen = '/invoices';
        break;
      case 'quote_accepted':
        urlToOpen = '/quotes';
        break;
    }
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              url: urlToOpen,
              data: event.notification.data
            });
            return;
          }
        }
        
        // App not open, so open it
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close events (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification dismissed:', event);
});

// Initialize Firebase when service worker activates
self.addEventListener('activate', (event) => {
  console.log('🔔 Service worker activated');
  event.waitUntil(initializeFirebaseInServiceWorker());
});

// Also try to initialize on install (for first-time setup)
self.addEventListener('install', (event) => {
  console.log('📦 Service worker installing');
  event.waitUntil(initializeFirebaseInServiceWorker());
});

console.log('🔔 Firebase messaging service worker loaded');

// Initialize immediately when service worker script loads
// This ensures Firebase is ready even after worker recycling/restart
initializeFirebaseInServiceWorker().catch((error) => {
  console.error('Failed to initialize Firebase on service worker load:', error);
});
