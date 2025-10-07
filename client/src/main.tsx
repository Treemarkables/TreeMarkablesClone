import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration - v10 thumbnail update
if ('serviceWorker' in navigator) {
  // Force clear ALL caches and unregister ALL service workers
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('🧹 [v10] Unregistering service worker:', registration.scope);
      registration.unregister();
    });
  });
  
  // Clear all caches to force fresh bundle load
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => {
        console.log('🧹 [v10] Deleting cache:', key);
        caches.delete(key);
      });
    });
  }
  
  console.log('📴 [v10] Service Worker disabled - caches cleared - using localStorage');
}

createRoot(document.getElementById("root")!).render(
  <App />
);
