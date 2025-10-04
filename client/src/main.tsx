import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration
if ('serviceWorker' in navigator) {
  // ALWAYS clear service workers on load to prevent Safari hard refresh issues
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('🧹 Unregistering service worker:', registration.scope);
      registration.unregister();
    });
  });
  
  // Service Worker temporarily disabled to fix Safari hard refresh issue
  // Jobs use localStorage fallback instead
  console.log('📴 Service Worker disabled - using localStorage for offline support');
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
