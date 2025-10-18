// Firebase Cloud Messaging configuration for push notifications
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

let app: any;
let messaging: Messaging | null = null;
let firebaseConfig: any = null;
let vapidKey: string | null = null;

// Fetch Firebase config from API
async function fetchFirebaseConfig() {
  try {
    const response = await fetch('/api/firebase-config');
    const data = await response.json();
    
    if (data.success && data.configured && data.config) {
      firebaseConfig = data.config;
      
      // Get VAPID key from API response
      vapidKey = data.vapidKey || '';
      
      return true;
    }
    
    console.warn('⚠️ Firebase not configured - push notifications disabled');
    return false;
  } catch (error) {
    console.error('❌ Error fetching Firebase config:', error);
    return false;
  }
}

// Initialize Firebase
export async function initializeFirebase() {
  try {
    if (!app) {
      // Fetch config if not already loaded
      if (!firebaseConfig) {
        const configured = await fetchFirebaseConfig();
        if (!configured) {
          return { app: null, messaging: null };
        }
      }
      
      app = initializeApp(firebaseConfig);
      
      // Initialize messaging only if all required APIs are supported
      // This prevents errors in browsers that don't support messaging
      if (isNotificationSupported()) {
        try {
          messaging = getMessaging(app);
          console.log('✅ Firebase Messaging initialized');
        } catch (messagingError) {
          console.warn('⚠️ Firebase Messaging not supported in this browser:', messagingError);
          messaging = null;
        }
      } else {
        console.warn('⚠️ Push notifications not supported in this browser');
      }
    }
    return { app, messaging };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return { app: null, messaging: null };
  }
}

// Request notification permission and get FCM token
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    console.log('🔔 Requesting notification permission...');
    
    // Check if Firebase is configured
    if (!firebaseConfig) {
      console.log('📡 Firebase not initialized yet, fetching config...');
      const initialized = await fetchFirebaseConfig();
      if (!initialized) {
        console.error('❌ Firebase not configured - cannot request notifications');
        throw new Error('Firebase not configured. Please contact your administrator.');
      }
    }
    
    // Check VAPID key
    if (!vapidKey) {
      console.error('❌ VAPID key not found');
      throw new Error('VAPID key not configured. Please contact your administrator.');
    }
    console.log('✅ VAPID key loaded');
    
    const permission = await Notification.requestPermission();
    console.log('📱 Permission result:', permission);
    
    if (permission !== 'granted') {
      console.log('❌ Notification permission denied');
      return null;
    }

    console.log('✅ Notification permission granted');
    
    // Initialize Firebase and messaging if not already done
    if (!messaging) {
      console.log('🔧 Initializing messaging...');
      await initializeFirebase();
    }
    
    if (!messaging) {
      console.error('❌ Messaging not initialized after Firebase init');
      throw new Error('Failed to initialize Firebase messaging');
    }

    console.log('📡 Getting FCM token with VAPID key...');
    const token = await getToken(messaging, { vapidKey: vapidKey! });
    console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('❌ Error in requestNotificationPermission:', error);
    throw error;
  }
}

// Listen for foreground messages
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) {
    initializeFirebase();
  }
  
  if (!messaging) {
    console.error('Messaging not initialized');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  try {
    // Basic API checks
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    const hasIndexedDB = 'indexedDB' in window;
    
    // Safari (both iOS and macOS) doesn't fully support Firebase Cloud Messaging
    // We need to detect ACTUAL Safari, not Chrome/Firefox/Brave on iOS
    const userAgent = navigator.userAgent;
    
    // Debug: Log user agent to understand what Chrome on iPhone sends
    console.log('🔍 Browser User Agent:', userAgent);
    
    // Chrome on iOS uses "CriOS", Firefox uses "FxiOS", Brave is similar to Chrome
    const isChrome = /CriOS|Chrome/i.test(userAgent);
    const isFirefox = /FxiOS|Firefox/i.test(userAgent);
    const isBrave = /Brave/i.test(userAgent);
    const hasSafari = /Safari/i.test(userAgent);
    
    console.log('🔍 Browser Detection:', { isChrome, isFirefox, isBrave, hasSafari });
    
    // It's Safari ONLY if it has Safari in UA but none of the other browsers
    const isActualSafari = hasSafari && !isChrome && !isFirefox && !isBrave;
    
    console.log('🔍 Is Actual Safari?', isActualSafari);
    
    // Exclude ONLY actual Safari from notification support
    if (isActualSafari) {
      console.log('⚠️ Safari browser detected - Firebase messaging not supported');
      return false;
    }
    
    console.log('✅ Browser supports notifications');
    return hasServiceWorker && hasPushManager && hasNotification && hasIndexedDB;
  } catch {
    return false;
  }
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}
