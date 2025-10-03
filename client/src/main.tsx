import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration
if ('serviceWorker' in navigator) {
  // ALWAYS clear service workers on load to prevent infinite reload bugs
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('🧹 Unregistering service worker:', registration.scope);
      registration.unregister();
    });
  });
  
  if (import.meta.env.DEV) {
    // Development mode - keep service workers disabled
  } else {
    // Register service worker in production for PWA functionality
    // CRITICAL: Add version parameter to force iOS to fetch new service worker on each deployment
    // Without this, iOS caches sw.js and serves stale JavaScript bundles even after PWA reinstall
    const SW_VERSION = Date.now();
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`)
        .then(registration => {
          console.log('✅ Service Worker registered successfully:', registration.scope);
          console.log('📦 Service Worker version:', SW_VERSION);
        })
        .catch(error => {
          console.error('❌ Service Worker registration failed:', error);
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
