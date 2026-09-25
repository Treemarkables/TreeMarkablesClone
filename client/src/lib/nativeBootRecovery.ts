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
// A heartbeat newer than this means the entry bundle is alive (chunk still
// downloading). Reloading a live boot throws the user back onto a black
// about:blank. Older than this means JS never started or the context froze.
export const HEARTBEAT_ALIVE_MS = 8_000;
// Hard stop if the inline shell is still up and no real page has painted.
export const LIVE_BOOT_HARD_TIMEOUT_MS = 45_000;
// about:blank that is not loading failed (radio not up). Retry quickly.
export const BLANK_IDLE_RELOAD_MS = 2_000;
// A still loading about:blank used to be treated as stalled at 4s. That
// cancelled the in flight remote load on the 4s, 10s, and 18s native checks
// and left an opaque web view white. Match WebViewBootPolicy.loadingStall.
export const BLANK_HUNG_RELOAD_MS = 18_000;
// didFail / didFailProvisionalNavigation / content process terminated.
export const NAV_FAILURE_BACKOFF_MS = 1_500;
export const AUTH_ME_TIMEOUT_MS = 10_000;
export const MAX_BOOT_RELOADS = 2;
export const ATTEMPT_WINDOW_MS = 3 * 60 * 1000;

export const BOOT_PLACEHOLDER_COPY = "Opening Inflow";

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
  idleReloadMs?: number;
  failureBackoffMs?: number;
  /** didFail / didFailProvisionalNavigation / content process terminated. */
  navigationFailed?: boolean;
  /** Foreground wake of a blank webview that is no longer loading. */
  force?: boolean;
}): boolean {
  const hungLoadMs = opts.hungLoadMs ?? BLANK_HUNG_RELOAD_MS;
  const idleReloadMs = opts.idleReloadMs ?? BLANK_IDLE_RELOAD_MS;
  const failureBackoffMs = opts.failureBackoffMs ?? NAV_FAILURE_BACKOFF_MS;
  const status = classifyWebViewHref(opts.href);
  if (opts.isLoading) return opts.elapsedMs >= hungLoadMs;
  if (status === "blank" || status === "wrong-origin") {
    if (opts.force) return true;
    if (opts.navigationFailed) return opts.elapsedMs >= failureBackoffMs;
    return opts.elapsedMs >= idleReloadMs;
  }
  if (opts.navigationFailed) return opts.elapsedMs >= failureBackoffMs;
  return false;
}

export type NativeBootProbe =
  | "booted"
  | "painting"
  | "empty"
  | "not-booted"
  | "blank"
  | "wrong-origin";

export function normalizeShellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isBootPlaceholderCopy(value: string): boolean {
  const text = normalizeShellText(value);
  return text === BOOT_PLACEHOLDER_COPY || text.startsWith(`${BOOT_PLACEHOLDER_COPY} `);
}

/**
 * True when a real route has painted. The phone sidebar is off-canvas, so
 * header chrome does not count. An empty `<main>` (Dispatch chunk still
 * loading behind the null inner Suspense fallback) is not a painted page.
 * `mainText === null` means there is no `<main>` yet (login / marketing).
 */
export function shellTextSignalsRealPage(opts: {
  rootText: string;
  mainText: string | null;
}): boolean {
  if (opts.mainText !== null) {
    const main = normalizeShellText(opts.mainText);
    return main.length > 0 && !isBootPlaceholderCopy(main);
  }
  const root = normalizeShellText(opts.rootText);
  return root.length > 0 && !isBootPlaceholderCopy(root);
}

/** `--background` from index.css. Empty until the stylesheet has applied. */
export function cssTokenPresent(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * Mirrors the probe string in WebViewBootRecovery.swift. A booted flag with
 * no visible page is the #579 hole (overlay hidden, viewport still black).
 * `painting` means the inline shell is up and JS is ticking — do not reload.
 */
export function classifyBootSurface(opts: {
  booted: boolean;
  bootShellVisible: boolean;
  heartbeatAgeMs: number | null;
  rootText: string;
  mainText: string | null;
}): "booted" | "painting" | "empty" | "not-booted" {
  const visible = shellTextSignalsRealPage({
    rootText: opts.rootText,
    mainText: opts.mainText,
  });
  if (opts.booted) {
    if (visible || opts.bootShellVisible) return "booted";
    return "empty";
  }
  const alive = opts.heartbeatAgeMs != null && opts.heartbeatAgeMs < HEARTBEAT_ALIVE_MS;
  if (opts.bootShellVisible && alive) return "painting";
  return "not-booted";
}

export function shouldReloadNativeProbe(opts: {
  probe: NativeBootProbe;
  elapsedMs: number;
  isLoading: boolean;
  /** Once a healthy boot has been seen, don't reload a brief empty main. */
  seenHealthyBoot?: boolean;
  force?: boolean;
  navigationFailed?: boolean;
  reloadCount?: number;
  maxReloads?: number;
}): boolean {
  const count = opts.reloadCount ?? 0;
  const maxReloads = opts.maxReloads ?? 3;
  if (count >= maxReloads) return false;
  if (opts.probe === "booted" || opts.probe === "painting") return false;
  if (opts.probe === "empty") {
    if (opts.seenHealthyBoot) return false;
    if (opts.isLoading) return opts.elapsedMs >= BLANK_HUNG_RELOAD_MS;
    return true;
  }
  if (opts.probe === "blank" || opts.probe === "wrong-origin") {
    return shouldForceLoadWhilePending({
      href: opts.probe === "blank" ? "about:blank" : "https://evil.example/",
      isLoading: opts.isLoading,
      elapsedMs: opts.elapsedMs,
      force: opts.force,
      navigationFailed: opts.navigationFailed,
    });
  }
  if (opts.isLoading) return opts.elapsedMs >= BLANK_HUNG_RELOAD_MS;
  if (opts.navigationFailed) return opts.elapsedMs >= NAV_FAILURE_BACKOFF_MS;
  return opts.elapsedMs >= BOOT_TIMEOUT_MS;
}

export function shouldReloadUnbootedDespiteHeartbeat(opts: {
  booted: boolean;
  elapsedMs: number;
  heartbeatAgeMs: number | null;
  bootTimeoutMs?: number;
  hardTimeoutMs?: number;
  heartbeatAliveMs?: number;
}): boolean {
  if (opts.booted) return false;
  const hard = opts.hardTimeoutMs ?? LIVE_BOOT_HARD_TIMEOUT_MS;
  if (opts.elapsedMs >= hard) return true;
  const soft = opts.bootTimeoutMs ?? BOOT_TIMEOUT_MS;
  if (opts.elapsedMs < soft) return false;
  const alive = opts.heartbeatAliveMs ?? HEARTBEAT_ALIVE_MS;
  if (opts.heartbeatAgeMs != null && opts.heartbeatAgeMs < alive) return false;
  return true;
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

  // Tick even before the first real page. A fresh heartbeat tells the HTML
  // watchdog and the native probe that a slow Dispatch chunk is not a dead
  // WebView — reloading it was painting black about:blank again.
  const heartbeatId = window.setInterval(() => {
    touchHeartbeat();
  }, 2_000);

  const armBootTimeout = (delayMs: number) => {
    window.setTimeout(() => {
      const hb = bootGlobals()[HEARTBEAT_FLAG] ?? null;
      if (
        shouldReloadUnbootedDespiteHeartbeat({
          booted: isAppBooted(),
          elapsedMs: Date.now() - startedAt,
          heartbeatAgeMs: hb == null ? null : Date.now() - hb,
        })
      ) {
        requestBootReload("boot-timeout");
      }
    }, delayMs);
  };
  armBootTimeout(BOOT_TIMEOUT_MS);
  armBootTimeout(LIVE_BOOT_HARD_TIMEOUT_MS);

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

function readCssBackgroundToken(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue("--background");
  } catch {
    return "";
  }
}

/**
 * Hide #inflow-boot only after a real route has text AND the CSS bundle has
 * applied. App's first effect used to call markAppBooted() as soon as the
 * sidebar shell committed. On a phone that shell's inner Suspense fallback
 * is empty while the Dispatch chunk downloads, the inline shell disappeared,
 * and the viewport was the #1a1a1a body — a black screen native recovery
 * then treated as healthy.
 */
export function watchUntilRealPagePainted(): () => void {
  let stopped = false;
  let timer = 0;

  const tick = () => {
    if (stopped || isAppBooted()) return;
    const root = document.getElementById("root");
    const main = root?.querySelector("main") ?? null;
    const ready =
      shellTextSignalsRealPage({
        rootText: root?.innerText ?? "",
        mainText: main ? (main.innerText ?? "") : null,
      }) && cssTokenPresent(readCssBackgroundToken());
    if (!ready) {
      timer = window.setTimeout(tick, 150);
      return;
    }
    // Two frames so the page is on screen before the inline shell hides.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!stopped && !isAppBooted()) markAppBooted();
      });
    });
  };

  tick();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
