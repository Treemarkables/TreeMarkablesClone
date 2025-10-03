import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Clear any service workers in development to prevent caching issues
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
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
          
          // Check for updates every 30 seconds
          setInterval(() => {
            registration.update();
          }, 30000);
          
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('🔄 New service worker found, installing...');
            
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('✅ New service worker activated, reloading page...');
                // Automatically reload to get the latest version
                window.location.reload();
              }
            });
          });
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
