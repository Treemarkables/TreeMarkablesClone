// Firebase Cloud Messaging configuration for push notifications
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// Firebase configuration - loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// VAPID key for web push notifications
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app: any;
let messaging: Messaging | null = null;

// Initialize Firebase
export function initializeFirebase() {
  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      
      // Initialize messaging if supported
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        messaging = getMessaging(app);
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
    console.log('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    console.log('Notification permission granted');
    
    // Get FCM token
    if (!messaging) {
      initializeFirebase();
    }
    
    if (!messaging) {
      console.error('Messaging not initialized');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    console.log('FCM Token obtained:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
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
