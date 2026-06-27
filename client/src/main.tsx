import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { isReloadUnsafe } from "./lib/foregroundReloadGuard";

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

// The hashed entry bundle this page loaded with. index.html is served
// no-store, so re-fetching it later reveals whether a new build has shipped
// (the entry filename's hash changes every deploy). Lets us reload the moment
// a user returns to the app after a deploy, instead of leaving them on stale
// code until something 404s — the root cause behind features (deep links,
// notification highlights) silently not working right after a release.
const loadedEntryBundle = (() => {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'),
  );
  return (
    scripts.map((s) => s.getAttribute('src') || '').find((src) => src.includes('/assets/index-')) ||
    null
  );
})();

// True when prod is serving a newer entry bundle than the one we booted with.
async function hasNewDeployShipped(): Promise<boolean> {
  if (!loadedEntryBundle) return false;
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok) return false;
    const html = await res.text();
    const match = html.match(/\/assets\/index-[A-Za-z0-9_.-]+\.js/);
    return !!match && match[0] !== loadedEntryBundle;
  } catch {
    return false; // offline / transient — try again next foreground
  }
}

// Reload on foreground when EITHER we've been backgrounded a while OR a new
// build has shipped. In Capacitor (iOS WKWebView) and PWAs the page otherwise
// only refetches HTML on a manual full reload, so users sit on stale code
// indefinitely.
//
// The catch: a foreground reload IS destructive when the user has in-progress
// work on screen. Locking the phone mid-edit and returning would otherwise wipe
// anything not yet auto-saved (the job-card auto-save history makes this a real
// data-loss path, and it's exactly when the >5min threshold fires). So we ask
// the reload-guard registry first — if any surface is mid-edit (e.g. an open
// job card), we skip this reload entirely and retry on the next foreground,
// once the work is closed. Picking up fresh code can always wait; eating an
// edit cannot.
const STALE_RELOAD_THRESHOLD_MS = 5 * 60 * 1000;
let lastVisibleAt = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    lastVisibleAt = Date.now();
    return;
  }
  if (document.visibilityState !== 'visible') return;

  if (isReloadUnsafe()) {
    console.warn('↻ Foreground reload skipped — in-progress work open. Will retry once it closes.');
    return;
  }

  const elapsed = Date.now() - lastVisibleAt;
  if (elapsed > STALE_RELOAD_THRESHOLD_MS) {
    console.warn(`↻ App backgrounded for ${Math.round(elapsed / 1000)}s — reloading to get fresh code`);
    window.location.reload();
    return;
  }
  // Even after a brief away, pick up a fresh deploy on return.
  hasNewDeployShipped().then((isStale) => {
    if (isStale) {
      console.warn('↻ New build detected on foreground — reloading to get fresh code');
      window.location.reload();
    }
  });
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
