// Capacitor iOS / PWA boot + resume recovery.
//
// The TestFlight app is a WKWebView pointed at https://app.inflowapp.co.nz
// (capacitor.config.ts server.url). A cold open that never paints is almost
// never "clear your cache" — it is one of:
//
// 1. LaunchScreen dismisses onto about:blank and the first remote load hangs
//    or the WKWebView content process dies (force-quit is the only recovery
//    unless native reloads the configured URL).
// 2. HTML arrives but the hashed JS bundle never runs, so #root stays empty.
// 3. React mounts but /api/auth/me never resolves, and the auth gate paints
//    an empty cream/white full-screen (looks identical to a dead webview).
// 4. JS freezes after background; visibilitychange may not even fire
//    (WKWebView can stick "hidden"). Native didBecomeActive is the backstop.
//
// This module is the JS half: a boot flag the native shell can probe, a
// heartbeat so a frozen context is detectable, and a loop-guarded reload.

export const BOOT_FLAG = "__INFLOW_BOOTED";
export const HEARTBEAT_FLAG = "__INFLOW_HEARTBEAT_MS";
export const BOOT_RELOAD_KEY = "inflowBootReloadAttempts";

export const BOOT_TIMEOUT_MS = 18_000;
export const HEARTBEAT_STALE_MS = 12_000;
export const AUTH_ME_TIMEOUT_MS = 10_000;
export const MAX_BOOT_RELOADS = 2;
export const ATTEMPT_WINDOW_MS = 3 * 60 * 1000;

export type BootProbeStatus = "booted" | "not-booted" | "wrong-origin" | "blank";

export function isAppOriginHost(host: string): boolean {
  return (
    host === "app.inflowapp.co.nz" ||
    host === "app.treemarkables.co.nz" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function classifyWebViewHref(href: string | null | undefined): BootProbeStatus {
  if (!href || href === "about:blank" || href.startsWith("about:")) return "blank";
  try {
    const url = new URL(href);
    // Capacitor's bundled origin is not the live server.url — a webview left
    // on capacitor://localhost after a failed remote load is still a white screen.
    if (url.protocol === "capacitor:" || url.protocol === "ionic:") return "wrong-origin";
    if (!isAppOriginHost(url.hostname)) return "wrong-origin";
  } catch {
    return "blank";
  }
  return "not-booted";
}

export function shouldForceLoadWhilePending(opts: {
  href: string | null | undefined;
  isLoading: boolean;
  elapsedMs: number;
  hungLoadMs?: number;
}): boolean {
  const hungLoadMs = opts.hungLoadMs ?? 20_000;
  const status = classifyWebViewHref(opts.href);
  if (status === "blank" || status === "wrong-origin") {
    if (opts.isLoading && opts.elapsedMs < hungLoadMs) return false;
    return opts.elapsedMs >= 6_000 || !opts.isLoading;
  }
  if (opts.isLoading && opts.elapsedMs >= hungLoadMs) return true;
  return false;
}

export function shouldReloadUnbootedPage(opts: {
  booted: boolean;
  elapsedMs: number;
  bootTimeoutMs?: number;
}): boolean {
  if (opts.booted) return false;
  return opts.elapsedMs >= (opts.bootTimeoutMs ?? BOOT_TIMEOUT_MS);
}

export function shouldRecoverFrozenResume(opts: {
  now: number;
  lastHeartbeatMs: number | null;
  booted: boolean;
  hiddenForMs: number;
  staleMs?: number;
  hasPendingNotificationNav?: boolean;
}): boolean {
  // A notification tap is what brought us foreground — reloading would
  // wipe the deep link (and any in-flight job-card open) and land on the
  // bare dispatch board.
  if (opts.hasPendingNotificationNav) return false;
  const staleMs = opts.staleMs ?? HEARTBEAT_STALE_MS;
  if (!opts.booted) {
    // A foreground that still isn't booted after being away is the
    // "restored dead WKWebView" case. Ignore brief focus blips.
    return opts.hiddenForMs >= 3_000;
  }
  if (opts.lastHeartbeatMs == null) return true;
  return opts.now - opts.lastHeartbeatMs >= staleMs;
}

export function readBootReloadAttempts(
  raw: string | null,
  now: number,
  windowMs = ATTEMPT_WINDOW_MS,
): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { count?: number; at?: number };
    if (typeof parsed.count !== "number" || typeof parsed.at !== "number") return 0;
    if (now - parsed.at > windowMs) return 0;
    return parsed.count;
  } catch {
    return 0;
  }
}

export function canAttemptBootReload(attempts: number, max = MAX_BOOT_RELOADS): boolean {
  return attempts >= 0 && attempts < max;
}

export function nextBootReloadState(attempts: number, now: number): { count: number; at: number } {
  return { count: attempts + 1, at: now };
}

type BootGlobals = {
  [BOOT_FLAG]?: boolean;
  [HEARTBEAT_FLAG]?: number;
};

function bootGlobals(): BootGlobals {
  return window as unknown as BootGlobals;
}

export function markAppBooted(now = Date.now()): void {
  const g = bootGlobals();
  g[BOOT_FLAG] = true;
  g[HEARTBEAT_FLAG] = now;
  try {
    document.getElementById("inflow-boot")?.setAttribute("data-booted", "1");
    document.documentElement.dataset.inflowBooted = "1";
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("inflow-booted"));
  } catch {
    /* ignore */
  }
}

export function touchHeartbeat(now = Date.now()): void {
  bootGlobals()[HEARTBEAT_FLAG] = now;
}

export function isAppBooted(): boolean {
  return bootGlobals()[BOOT_FLAG] === true;
}

export function requestBootReload(reason: string): boolean {
  const now = Date.now();
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(BOOT_RELOAD_KEY);
  } catch {
    raw = null;
  }
  const attempts = readBootReloadAttempts(raw, now);
  if (!canAttemptBootReload(attempts)) {
    console.warn(`[boot-recovery] gave up after ${attempts} reloads (${reason})`);
    return false;
  }
  const next = nextBootReloadState(attempts, now);
  try {
    sessionStorage.setItem(BOOT_RELOAD_KEY, JSON.stringify(next));
  } catch {
    /* private mode / webview — browser loop protection is the backstop */
  }
  console.warn(`[boot-recovery] reloading (${reason}) attempt ${next.count}/${MAX_BOOT_RELOADS}`);
  window.location.reload();
  return true;
}

let watchdogStarted = false;

function hasPendingNotificationDeepLink(): boolean {
  // Only treat a *fresh* notification deep-link as blocking frozen-resume
  // reload. #568 also checked sessionStorage dispatch_open_job with no TTL —
  // if the job card never opened (chunk hang / black root), that key stayed
  // forever and disabled the only JS recovery path for the rest of the
  // WebView session. ?job= in the live URL still counts (user mid-open).
  try {
    const raw = localStorage.getItem("pendingNotificationNav");
    if (raw) {
      const parsed = JSON.parse(raw) as { path?: string; ts?: number };
      if (parsed?.path && Date.now() - (parsed.ts || 0) < 60_000) return true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (new URLSearchParams(window.location.search).get("job")) return true;
  } catch {
    /* ignore */
  }
  const early = (window as unknown as { __pendingNotificationPath?: string | null }).__pendingNotificationPath;
  return typeof early === "string" && early.length > 0;
}

export function startNativeBootWatchdogs(): void {
  if (watchdogStarted) return;
  watchdogStarted = true;

  const startedAt = Date.now();
  let hiddenAt: number | null = document.visibilityState === "hidden" ? startedAt : null;

  const heartbeatId = window.setInterval(() => {
    if (isAppBooted()) touchHeartbeat();
  }, 2_000);

  window.setTimeout(() => {
    if (!isAppBooted()) {
      requestBootReload("boot-timeout");
    }
  }, BOOT_TIMEOUT_MS);

  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      hiddenAt = now;
      return;
    }
    const hiddenForMs = hiddenAt == null ? 0 : now - hiddenAt;
    hiddenAt = null;
    // Wait a beat so a notification tap can persist its deep link before
    // we decide to reload. Checking immediately lost the job-card path —
    // native inject and this handler raced, and the reload landed on
    // bare /dispatch.
    //
    // Re-read the heartbeat AFTER the grace window. Capturing it at
    // visibilitychange (pre-#568) made every >12s background look frozen
    // even when JS had resumed and was ticking again — force-reload every
    // warm open, which raced chunk load and painted the black empty root.
    window.setTimeout(() => {
      if (
        shouldRecoverFrozenResume({
          now: Date.now(),
          lastHeartbeatMs: bootGlobals()[HEARTBEAT_FLAG] ?? null,
          booted: isAppBooted(),
          hiddenForMs,
          hasPendingNotificationNav: hasPendingNotificationDeepLink(),
        })
      ) {
        requestBootReload("frozen-resume");
      }
    }, 1500);
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !isAppBooted()) {
      requestBootReload("bfcache-unbooted");
    }
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(heartbeatId);
  });
}
