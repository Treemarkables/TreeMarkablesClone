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
      
      // Fetch VAPID key from environment or use default
      // Note: VAPID key must be set in environment variables with VITE_ prefix
      vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
      
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
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}
