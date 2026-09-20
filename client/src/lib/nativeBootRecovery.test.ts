import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ME_TIMEOUT_MS,
  BOOT_TIMEOUT_MS,
  canAttemptBootReload,
  classifyWebViewHref,
  isAppOriginHost,
  nextBootReloadState,
  readBootReloadAttempts,
  shouldForceLoadWhilePending,
  shouldRecoverFrozenResume,
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
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: 5_000,
      }),
      false,
    );
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: true,
        elapsedMs: 21_000,
      }),
      true,
    );
  });

  it("reloads a stuck blank webview that is not loading", () => {
    assert.equal(
      shouldForceLoadWhilePending({
        href: "about:blank",
        isLoading: false,
        elapsedMs: 6_000,
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
});
