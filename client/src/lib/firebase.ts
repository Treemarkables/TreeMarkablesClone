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
      if (!firebaseConfig) {
        const configured = await fetchFirebaseConfig();
        if (!configured) {
          return { app: null, messaging: null };
        }
      }
      
      app = initializeApp(firebaseConfig);
      
      if (isNotificationSupported()) {
        try {
          messaging = getMessaging(app);
          console.log('✅ Firebase Messaging initialized');
        } catch (messagingError) {
          console.warn('⚠️ Firebase Messaging not supported in this browser:', messagingError);
          messaging = null;
        }
      } else {
        console.warn('⚠️ Push notifications not supported in this context');
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
    
    if (!firebaseConfig) {
      console.log('📡 Firebase not initialized yet, fetching config...');
      const initialized = await fetchFirebaseConfig();
      if (!initialized) {
        console.error('❌ Firebase not configured - cannot request notifications');
        throw new Error('Firebase not configured. Please contact your administrator.');
      }
    }
    
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
    
    if (!messaging) {
      console.log('🔧 Initializing messaging...');
      await initializeFirebase();
    }
    
    if (!messaging) {
      console.error('❌ Messaging not initialized after Firebase init');
      throw new Error('Failed to initialize Firebase messaging');
    }

    // Get the existing service worker registration so Firebase uses sw.js
    // instead of looking for firebase-messaging-sw.js (which doesn't exist)
    let swRegistration: ServiceWorkerRegistration | undefined;
    try {
      await navigator.serviceWorker.ready;
      swRegistration = await navigator.serviceWorker.getRegistration('/sw.js') || undefined;
      if (swRegistration) {
        console.log('✅ Using existing service worker registration');
      } else {
        // Register sw.js if not already registered
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service worker registered');
      }
    } catch (swError) {
      console.warn('⚠️ Could not get service worker registration, proceeding without:', swError);
    }

    console.log('📡 Getting FCM token with VAPID key...');
    const token = await getToken(messaging, { 
      vapidKey: vapidKey!,
      serviceWorkerRegistration: swRegistration,
    });
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

// Detect if running as an installed PWA (standalone mode)
export function isRunningAsStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Detect actual Safari (not Chrome/Firefox/Brave on iOS which use different engines)
export function isActualSafari(): boolean {
  const ua = navigator.userAgent;
  const isChrome = /CriOS|Chrome/i.test(ua);
  const isFirefox = /FxiOS|Firefox/i.test(ua);
  const isBrave = /Brave/i.test(ua);
  const hasSafari = /Safari/i.test(ua);
  return hasSafari && !isChrome && !isFirefox && !isBrave;
}

// Check if notifications are supported in the current context
export function isNotificationSupported(): boolean {
  try {
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    const hasIndexedDB = 'indexedDB' in window;
    
    if (!hasServiceWorker || !hasPushManager || !hasNotification || !hasIndexedDB) return false;

    // Safari (iOS and macOS) only supports Web Push when the PWA is installed to the home screen.
    // iOS 16.4+ supports this natively. In a regular browser tab it won't work.
    if (isActualSafari()) {
      if (!isRunningAsStandalone()) {
        console.log('⚠️ Safari: push notifications require "Add to Home Screen" first (iOS 16.4+)');
        return false;
      }
      console.log('✅ Safari PWA standalone mode detected — Web Push supported (iOS 16.4+)');
      return true;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}
