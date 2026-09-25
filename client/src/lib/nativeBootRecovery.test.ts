import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ME_TIMEOUT_MS,
  BLANK_HUNG_RELOAD_MS,
  BOOT_TIMEOUT_MS,
  NAV_FAILURE_BACKOFF_MS,
  HEARTBEAT_ALIVE_MS,
  LIVE_BOOT_HARD_TIMEOUT_MS,
  canAttemptBootReload,
  classifyBootSurface,
  classifyWebViewHref,
  cssTokenPresent,
  isAppOriginHost,
  nextBootReloadState,
  readBootReloadAttempts,
  shellTextSignalsRealPage,
  shouldForceLoadWhilePending,
  shouldRecoverFrozenResume,
  shouldReloadNativeProbe,
  shouldReloadUnbootedDespiteHeartbeat,
  shouldReloadUnbootedPage,
} from "./nativeBootRecovery.ts";

describe("native boot recovery — origin / blank webview", () => {
  it("accepts the Capacitor server.url hosts and local dev", () => {
    assert.equal(isAppOriginHost("app.inflowapp.co.nz"), true);
    assert.equal(isAppOriginHost("app.treemarkables.co.nz"), true);
    assert.equal(isAppOriginHost("localhost"), true);
    assert.equal(isAppOriginHost("evil.example"), false);
  });

  it("classifies about:blank and missing href as blank", () => {
    assert.equal(classifyWebViewHref(null), "blank");
    assert.equal(classifyWebViewHref(""), "blank");
    assert.equal(classifyWebViewHref("about:blank"), "blank");
    assert.equal(classifyWebViewHref("https://app.inflowapp.co.nz/dispatch"), "not-booted");
    assert.equal(classifyWebViewHref("capacitor://localhost"), "wrong-origin");
  });

  it("does not interrupt an in-flight first load of about:blank before the hung timeout", () => {
    // Cancelling a still loading document at 4s burned the reload budget and
    // left the opaque web view white. Wait out a slow connection.
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: 4_000,
      }),
      false,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: 10_000,
      }),
      false,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: BLANK_HUNG_RELOAD_MS,
      }),
      true,
    );
  });

  it("reloads a stuck blank webview that is not loading", () => {
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: 1_500,
      }),
      false,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: 2_000,
      }),
      true,
    );
  });

  it("retries a failed blank load after a short backoff and does not cancel a newer load", () => {
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: NAV_FAILURE_BACKOFF_MS - 1,
        navigationFailed: true,
      }),
      false,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: NAV_FAILURE_BACKOFF_MS,
        navigationFailed: true,
      }),
      true,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: 5_000,
        navigationFailed: true,
        force: true,
      }),
      false,
    );
  });

  it("reloads a blank webview immediately on a foreground wake once loading has stopped", () => {
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: 500,
        force: true,
      }),
      true,
    );
  });
});

describe("native boot recovery — JS boot timeout + frozen resume", () => {
  it("waits the boot timeout before reloading an unbooted page", () => {
    assert.equal(shouldReloadUnbootedPage({ booted: false, elapsedMs: 5_000 }), false);
    assert.equal(
      shouldReloadUnbootedPage({ booted: false, elapsedMs: BOOT_TIMEOUT_MS }),
      true,
    );
    assert.equal(shouldReloadUnbootedPage({ booted: true, elapsedMs: 60_000 }), false);
  });

  it("recovers a restored-but-unbooted shell after a real hide", () => {
    assert.equal(
      shouldRecoverFrozenResume({
        now: 10_000,
        lastHeartbeatMs: null,
        booted: false,
        hiddenForMs: 500,
      }),
      false,
    );
    assert.equal(
      shouldRecoverFrozenResume({
        now: 10_000,
        lastHeartbeatMs: null,
        booted: false,
        hiddenForMs: 4_000,
      }),
      true,
    );
  });

  it("recovers a booted page whose heartbeat has stalled", () => {
    assert.equal(
      shouldRecoverFrozenResume({
        now: 30_000,
        lastHeartbeatMs: 25_000,
        booted: true,
        hiddenForMs: 10_000,
      }),
      false,
    );
    assert.equal(
      shouldRecoverFrozenResume({
        now: 30_000,
        lastHeartbeatMs: 10_000,
        booted: true,
        hiddenForMs: 10_000,
      }),
      true,
    );
  });

  it("does not reload when a notification deep link is still pending", () => {
    assert.equal(
      shouldRecoverFrozenResume({
        now: 30_000,
        lastHeartbeatMs: 10_000,
        booted: true,
        hiddenForMs: 10_000,
        hasPendingNotificationNav: true,
      }),
      false,
    );
  });

  it("still recovers a frozen resume when no deep link is pending", () => {
    assert.equal(
      shouldRecoverFrozenResume({
        now: 30_000,
        lastHeartbeatMs: 10_000,
        booted: true,
        hiddenForMs: 10_000,
        hasPendingNotificationNav: false,
      }),
      true,
    );
  });

  it("treats a fresh heartbeat after grace as healthy (not frozen)", () => {
    // Watchdog re-reads __INFLOW_HEARTBEAT_MS after the 1.5s grace. A page
    // that resumed ticking must not force-reload just because the pre-grace
    // sample was stale from backgrounding.
    assert.equal(
      shouldRecoverFrozenResume({
        now: 30_000,
        lastHeartbeatMs: 29_000,
        booted: true,
        hiddenForMs: 20_000,
        hasPendingNotificationNav: false,
      }),
      false,
    );
  });

  it("caps boot reloads inside the attempt window", () => {
    const now = 1_000_000;
    assert.equal(readBootReloadAttempts(null, now), 0);
    assert.equal(readBootReloadAttempts(JSON.stringify({ count: 2, at: now - 1_000 }), now), 2);
    assert.equal(
      readBootReloadAttempts(JSON.stringify({ count: 2, at: now - 4 * 60 * 1000 }), now),
      0,
    );
    assert.equal(canAttemptBootReload(0), true);
    assert.equal(canAttemptBootReload(2), false);
    assert.deepEqual(nextBootReloadState(0, now), { count: 1, at: now });
  });

  it("keeps the auth /me timeout short enough that the loading gate cannot hang forever", () => {
    assert.ok(AUTH_ME_TIMEOUT_MS <= 12_000);
    assert.ok(AUTH_ME_TIMEOUT_MS >= 5_000);
  });

  it("does not reload a live boot whose heartbeat is still ticking", () => {
    assert.equal(
      shouldReloadUnbootedDespiteHeartbeat({
        booted: false,
        elapsedMs: BOOT_TIMEOUT_MS,
        heartbeatAgeMs: 1_000,
      }),
      false,
    );
    assert.equal(
      shouldReloadUnbootedDespiteHeartbeat({
        booted: false,
        elapsedMs: BOOT_TIMEOUT_MS,
        heartbeatAgeMs: HEARTBEAT_ALIVE_MS,
      }),
      true,
    );
    assert.equal(
      shouldReloadUnbootedDespiteHeartbeat({
        booted: false,
        elapsedMs: LIVE_BOOT_HARD_TIMEOUT_MS,
        heartbeatAgeMs: 500,
      }),
      true,
    );
  });
});

describe("native boot recovery — painted page vs empty shell", () => {
  it("does not treat the boot placeholder or an empty dispatch main as a painted page", () => {
    assert.equal(
      shellTextSignalsRealPage({ rootText: "Opening Inflow", mainText: null }),
      false,
    );
    assert.equal(
      shellTextSignalsRealPage({
        rootText: "Opening Inflow",
        mainText: "Opening Inflow",
      }),
      false,
    );
    assert.equal(
      shellTextSignalsRealPage({ rootText: "Dispatch header", mainText: "" }),
      false,
    );
  });

  it("treats login copy and a filled main as a painted page", () => {
    assert.equal(
      shellTextSignalsRealPage({ rootText: "Welcome Back", mainText: null }),
      true,
    );
    assert.equal(
      shellTextSignalsRealPage({
        rootText: "header chrome",
        mainText: "Daily target",
      }),
      true,
    );
  });

  it("requires the CSS token before the inline shell may hide", () => {
    assert.equal(cssTokenPresent(""), false);
    assert.equal(cssTokenPresent("   "), false);
    assert.equal(cssTokenPresent("60 33% 98%"), true);
  });

  it("classifies a booted-but-blank shell as empty and a live shell as painting", () => {
    assert.equal(
      classifyBootSurface({
        booted: true,
        bootShellVisible: false,
        heartbeatAgeMs: 100,
        rootText: "",
        mainText: "",
      }),
      "empty",
    );
    assert.equal(
      classifyBootSurface({
        booted: false,
        bootShellVisible: true,
        heartbeatAgeMs: 1_000,
        rootText: "Opening Inflow",
        mainText: "",
      }),
      "painting",
    );
    assert.equal(
      classifyBootSurface({
        booted: true,
        bootShellVisible: false,
        heartbeatAgeMs: 100,
        rootText: "header",
        mainText: "Daily target",
      }),
      "booted",
    );
  });

  it("does not native-reload a painting shell, and reloads an empty shell only before the first healthy boot", () => {
    assert.equal(
      shouldReloadNativeProbe({
        probe: "painting",
        elapsedMs: 30_000,
        isLoading: false,
      }),
      false,
    );
    assert.equal(
      shouldReloadNativeProbe({
        probe: "empty",
        elapsedMs: 8_000,
        isLoading: false,
        seenHealthyBoot: false,
      }),
      true,
    );
    assert.equal(
      shouldReloadNativeProbe({
        probe: "empty",
        elapsedMs: 8_000,
        isLoading: false,
        seenHealthyBoot: true,
      }),
      false,
    );
    assert.equal(
      shouldReloadNativeProbe({
        probe: "not-booted",
        elapsedMs: 10_000,
        isLoading: false,
      }),
      false,
    );
    assert.equal(
      shouldReloadNativeProbe({
        probe: "not-booted",
        elapsedMs: BOOT_TIMEOUT_MS,
        isLoading: false,
      }),
      true,
    );
  });
});
