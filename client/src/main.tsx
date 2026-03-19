import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// v14 - Auto-recover from stale cached JS bundles
// When a new deployment happens, old cached index.html references old JS filenames.
// Those files return 404 → "Failed to fetch dynamically imported module" error.
// This handler detects that and forces a full hard reload to get the fresh HTML + JS.
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const isChunkError = (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError') ||
    (event.filename && event.filename.includes('/assets/') && msg.includes('SyntaxError'))
  );

  if (isChunkError) {
    console.warn('⚠️ Stale JS bundle detected — forcing reload to get fresh version');
    // Use location.replace so the back button still works
    window.location.replace(window.location.href);
  }
});

// Also catch unhandled promise rejections (dynamic import errors)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason) || '';
  const isChunkError = (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError')
  );

  if (isChunkError) {
    console.warn('⚠️ Stale JS chunk import failed — forcing reload to get fresh version');
    event.preventDefault();
    window.location.replace(window.location.href);
  }
});

// Keep cache cleanup to remove any old service worker / cache that was left behind
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}

if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key));
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
