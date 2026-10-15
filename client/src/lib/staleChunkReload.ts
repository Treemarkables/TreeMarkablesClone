// Shared stale-bundle recovery for chunk-load failures.
//
// A lazy()/dynamic-import that fails after a deploy throws one of these
// browser-specific messages: Chrome "Failed to fetch dynamically imported
// module", iOS/Safari "Importing a module script failed", Firefox/webpack
// "Loading chunk"/"ChunkLoadError". Two distinct causes, one recovery:
//
// 1. Stale HTML — a cached index.html references chunk hashes the new build
//    deleted. One hard reload pulls the fresh HTML and fixes it.
// 2. Deploy rollout — the HTML is current but the DO container is mid-restart,
//    so the asset fetch itself fails transiently. A single instant reload hits
//    the same rollout and fails again; it needs a few spaced retries.
//
// So: reload immediately on the first failure (fixes case 1 instantly), then
// retry with a delay a few more times (rides out case 2), and only after
// exhausting attempts let the caller show a real error UI. Attempt state
// lives in sessionStorage so it survives the reloads it causes, and expires
// after ATTEMPT_WINDOW_MS so the next genuine deploy gets a fresh ladder.

import { isVoiceCallActive } from "./voiceCallReloadGuard";

export { isChunkLoadError, isChunkLoadErrorMessage, isAssetScriptFailure } from "./chunkLoadError";

const STATE_KEY = 'chunkReloadState';
const ATTEMPT_WINDOW_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 12_000;

/** Drop a controlling service worker and the Cache API before a recovery reload. */
export function clearStaleShellCache(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  try {
    if ('serviceWorker' in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then((regs) =>
          Promise.all(regs.map((reg) => reg.unregister())),
        ),
      );
    }
  } catch {
    /* private mode / very old webview */
  }
  try {
    if ('caches' in window) {
      tasks.push(
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      );
    }
  } catch {
    /* ignore */
  }
  return Promise.all(tasks).then(() => undefined).catch(() => undefined);
}

/**
 * Reload onto a cache-busted URL after the service worker lets go.
 * Waiting forever on unregister would leave the white screen up, so the
 * navigation proceeds either way after a short cap.
 */
export function reloadBypassingStaleShell(): void {
  const cap = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 400);
  });
  void Promise.race([clearStaleShellCache(), cap]).finally(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('inflow_boot', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  });
}

function readState(): { count: number; at: number } {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.count === 'number' && typeof parsed.at === 'number') {
        // Attempts outside the window belong to a previous incident.
        if (Date.now() - parsed.at <= ATTEMPT_WINDOW_MS) return parsed;
      }
    }
  } catch (_) {
    // sessionStorage unavailable (private mode / webview) — behave as a
    // first attempt; the browser's own reload-loop protection is the backstop.
  }
  return { count: 0, at: 0 };
}

// Read-only check for render-time decisions (getDerivedStateFromError must
// not have side effects): true if a reload attempt is still available.
export function canAttemptReload(): boolean {
  return readState().count < MAX_ATTEMPTS;
}

// True once a reload has been requested this page-lifetime, so concurrent
// chunk errors (several lazy imports failing together) don't stack reloads
// or burn multiple attempts on one incident.
let reloadPending = false;

export type ReloadOutcome = 'reloading' | 'gave-up';

// Attempt recovery from a stale/unfetchable chunk. Returns 'reloading' when a
// reload is imminent (caller should show a calm "updating" state and skip
// error reporting) or 'gave-up' when the attempt ladder is exhausted (caller
// should surface its real error UI).
export function requestStaleBundleReload(): ReloadOutcome {
  // Reloading the WKWebView mid-call kills the Twilio connection (31005).
  // The next chunk error, after the call ends, runs the normal ladder.
  if (isVoiceCallActive()) {
    console.warn('⚠️ Chunk error during a live call — reload deferred');
    return 'gave-up';
  }
  if (reloadPending) return 'reloading';

  const state = readState();
  if (state.count >= MAX_ATTEMPTS) return 'gave-up';

  reloadPending = true;
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ count: state.count + 1, at: Date.now() }),
    );
  } catch (_) {}

  if (state.count === 0) {
    // First failure: reload now — the common stale-HTML case fixes instantly.
    // Unregister a controlling service worker first so the reload is not
    // served the same cached index.html.
    reloadBypassingStaleShell();
  } else {
    // Repeat failure: the fresh HTML still couldn't fetch the chunk, i.e. a
    // deploy is likely mid-rollout. Wait before retrying instead of hammering.
    console.warn(
      `⚠️ Chunk still unavailable (attempt ${state.count + 1}/${MAX_ATTEMPTS}) — retrying in ${RETRY_DELAY_MS / 1000}s`,
    );
    setTimeout(() => reloadBypassingStaleShell(), RETRY_DELAY_MS);
  }
  return 'reloading';
}
