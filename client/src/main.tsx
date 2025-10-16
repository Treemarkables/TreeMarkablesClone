import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// v13 - DISABLE service worker completely and force clean old caches
console.log('🚀 [v13] Starting cache cleanup...');

if ('serviceWorker' in navigator) {
  // Unregister ALL service workers
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('🧹 [v13] Found', registrations.length, 'service worker(s) - unregistering ALL');
    registrations.forEach(registration => {
      registration.unregister().then(() => {
        console.log('✅ [v13] Service worker unregistered');
      });
    });
  });
}

// Delete ALL caches
if ('caches' in window) {
  caches.keys().then(keys => {
    console.log('🧹 [v13] Found', keys.length, 'cache(s) - deleting ALL');
    keys.forEach(key => {
      caches.delete(key).then(() => {
        console.log('✅ [v13] Deleted cache:', key);
      });
    });
  });
}

console.log('✅ [v13] Cache cleanup complete - Service Worker DISABLED');

createRoot(document.getElementById("root")!).render(
  <App />
);
