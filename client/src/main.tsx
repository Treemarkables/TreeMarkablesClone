import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { isReloadUnsafe } from "./lib/foregroundReloadGuard";
import { isChunkLoadErrorMessage, requestStaleBundleReload } from "./lib/staleChunkReload";

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

// v15 - Auto-recover from stale or unfetchable JS chunks.
// Stale cached index.html referencing deleted chunk hashes AND transient asset
// failures during a deploy rollout both surface here. requestStaleBundleReload
// reloads immediately on the first failure, then retries with spaced delays
// (riding out a rollout) before giving up — so a permanently missing chunk
// can't cause an endless reload loop.
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const isChunkError = (
    isChunkLoadErrorMessage(msg) ||
    (event.filename && event.filename.includes('/assets/') && msg.includes('SyntaxError'))
  );

  if (isChunkError) {
    console.warn('⚠️ Stale JS bundle detected — reloading to get fresh version');
    requestStaleBundleReload();
  }
});

// Also catch unhandled promise rejections (dynamic import errors)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason) || '';

  if (isChunkLoadErrorMessage(msg)) {
    console.warn('⚠️ Stale JS chunk import failed — reloading to get fresh version');
    event.preventDefault();
    requestStaleBundleReload();
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

// Reload on foreground ONLY when a new build has actually shipped. In
// Capacitor (iOS WKWebView) and PWAs the page otherwise only refetches HTML on
// a manual full reload, so users sit on stale code indefinitely after a deploy.
// Time away alone is NOT a reason to reload — an unconditional
// backgrounded-too-long reload made every app-open after a break white-flash
// and refetch the whole bundle, which users read as the app "restarting".
// hasNewDeployShipped is one cheap no-store fetch of index.html; if it can't
// tell (offline/transient), we stay on the current code and check again next
// foreground.
//
// The catch: a foreground reload IS destructive when the user has in-progress
// work on screen. Locking the phone mid-edit and returning would otherwise wipe
// anything not yet auto-saved (the job-card auto-save history makes this a real
// data-loss path). So we ask the reload-guard registry first — if any surface
// is mid-edit (e.g. an open job card), we skip this reload entirely and retry
// on the next foreground, once the work is closed. Picking up fresh code can
// always wait; eating an edit cannot.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;

  hasNewDeployShipped().then((isStale) => {
    if (!isStale) return;
    if (isReloadUnsafe()) {
      console.warn('↻ New build shipped but in-progress work open — will reload once it closes.');
      return;
    }
    console.warn('↻ New build detected on foreground — reloading to get fresh code');
    window.location.reload();
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
