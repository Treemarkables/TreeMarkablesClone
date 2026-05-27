import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Sentry frontend init — disabled when VITE_SENTRY_DSN is unset so local
// development without a DSN doesn't spam Sentry.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      // Records the user's session as a replayable timeline. We only ever
      // record on error (sessionSampleRate=0, errorSampleRate=1) so we stay
      // well under the free-tier 50/mo cap.
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Stay on the free tier — no perf tracing, just errors + replays.
    tracesSampleRate: 0,
    // Stale-bundle chunk errors are already handled by the listeners below
    // (they trigger a hard reload). Don't double-report them to Sentry.
    ignoreErrors: [
      "Failed to fetch dynamically imported module",
      "Importing a module script failed",
      "Loading chunk",
      "ChunkLoadError",
      // Browser extensions injecting into the page — not our bugs.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  });
}

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

// Reload on foreground if backgrounded for >5 minutes.
// In Capacitor (iOS WKWebView) and PWAs, users can sit on a stale JS bundle indefinitely
// — the page only refetches HTML on a full reload, not on background→foreground transitions.
// This means a deploy can ship to web but iOS users stay on the old code until they force-quit.
// Threshold is intentionally generous (5 min) so quick app-switches don't trash in-progress state.
const STALE_RELOAD_THRESHOLD_MS = 5 * 60 * 1000;
let lastVisibleAt = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    lastVisibleAt = Date.now();
  } else if (document.visibilityState === 'visible') {
    const elapsed = Date.now() - lastVisibleAt;
    if (elapsed > STALE_RELOAD_THRESHOLD_MS) {
      console.warn(`↻ App backgrounded for ${Math.round(elapsed / 1000)}s — reloading to get fresh code`);
      window.location.reload();
    }
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
