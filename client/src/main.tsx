import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration - v11 dispatch fix
if ('serviceWorker' in navigator) {
  // FORCE clear all old service workers first
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('🧹 Found', registrations.length, 'service worker(s) - unregistering ALL old versions');
    registrations.forEach(registration => {
      registration.unregister();
    });
  });
  
  // Clear all old caches
  if ('caches' in window) {
    caches.keys().then(keys => {
      console.log('🧹 Found', keys.length, 'cache(s) - deleting ALL');
      keys.forEach(key => {
        caches.delete(key);
      });
    });
  }
  
  // Wait a moment then register new v11 service worker
  window.addEventListener('load', () => {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ [v11] Service Worker registered:', registration.scope);
          
          // Check for updates every 5 minutes
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);
        })
        .catch(error => {
          console.error('❌ [v11] Service Worker registration failed:', error);
        });
    }, 1000);
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
