import { describe, it, before } from "node:test";
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
  elementHasRenderedContent,
  isAppOriginHost,
  nextBootReloadState,
  readBootReloadAttempts,
  shellSignalsRealPage,
  shellTextSignalsRealPage,
  shouldForceLoadWhilePending,
  shouldRecoverFrozenResume,
  shouldReloadNativeProbe,
  shouldReloadUnbootedDespiteHeartbeat,
  shouldReloadUnbootedPage,
  shouldRevealBootFailure,
  BOOT_FAILURE_REVEAL_MS,
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

type FakeStyle = {
  display?: string;
  visibility?: string;
  opacity?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
};

class FakeEl {
  tagName: string;
  children: FakeEl[] = [];
  parentElement: FakeEl | null = null;
  text = "";
  width = 0;
  height = 0;
  nodeType = 1;
  attrs: Record<string, string> = {};
  style: FakeStyle = {};
  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }
  append(child: FakeEl): FakeEl {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  get innerText(): string {
    return [this.text, ...this.children.map((child) => child.innerText)].filter(Boolean).join(" ");
  }
  get textContent(): string {
    return this.innerText;
  }
  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  getBoundingClientRect() {
    return {
      width: this.width,
      height: this.height,
      top: 0,
      left: 0,
      right: this.width,
      bottom: this.height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    };
  }
  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  querySelectorAll(sel: string): FakeEl[] {
    const tags = sel.split(",").map((part) => part.trim().toUpperCase());
    const all = tags.includes("*");
    const out: FakeEl[] = [];
    const walk = (el: FakeEl) => {
      for (const child of el.children) {
        if (all || tags.includes(child.tagName)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

function asEl(el: FakeEl): Element {
  return el as unknown as Element;
}

describe("native boot recovery — media counts as a painted page", () => {
  before(() => {
    const g = globalThis as typeof globalThis & { window: Window };
    g.window = {
      getComputedStyle(el: Element) {
        const style = (el as unknown as FakeEl).style ?? {};
        return {
          display: style.display ?? "block",
          visibility: style.visibility ?? "visible",
          opacity: style.opacity ?? "1",
          backgroundColor: style.backgroundColor ?? "rgba(0, 0, 0, 0)",
          backgroundImage: style.backgroundImage ?? "none",
          borderTopWidth: style.borderTopWidth ?? "0px",
          borderRightWidth: style.borderRightWidth ?? "0px",
          borderBottomWidth: style.borderBottomWidth ?? "0px",
          borderLeftWidth: style.borderLeftWidth ?? "0px",
        } as CSSStyleDeclaration;
      },
    } as unknown as Window;
  });

  it("treats a text main as ready and Opening Inflow as not ready", () => {
    assert.equal(
      shellSignalsRealPage({ rootText: "header chrome", mainText: "Daily target" }),
      true,
    );
    assert.equal(
      shellSignalsRealPage({
        rootText: "Opening Inflow",
        mainText: "Opening Inflow",
        mainHasRenderedContent: true,
      }),
      false,
    );
    assert.equal(
      shellSignalsRealPage({ rootText: "Opening Inflow", mainText: null }),
      false,
    );
  });

  it("treats a media-only main as ready and an empty main as not ready", () => {
    assert.equal(
      shellSignalsRealPage({
        rootText: "Powered by Treemarkables",
        mainText: "",
        mainHasRenderedContent: true,
      }),
      true,
    );
    assert.equal(
      shellSignalsRealPage({
        rootText: "Dispatch header",
        mainText: "",
        mainHasRenderedContent: false,
      }),
      false,
    );
    const videoMain = new FakeEl("main");
    const player = videoMain.append(new FakeEl("video"));
    player.width = 1080;
    player.height = 720;
    assert.equal(elementHasRenderedContent(asEl(videoMain)), true);
    assert.equal(
      shellSignalsRealPage({
        rootText: "",
        mainText: videoMain.innerText,
        mainHasRenderedContent: elementHasRenderedContent(asEl(videoMain)),
      }),
      true,
    );

    const empty = new FakeEl("main");
    const stretch = empty.append(new FakeEl("div"));
    stretch.width = 390;
    stretch.height = 800;
    assert.equal(elementHasRenderedContent(asEl(empty)), false);
  });

  it("does not treat a text-less card or spinner as the real page", () => {
    // Dispatch jobsLoading is a white card and pulse bars with no words.
    // Counting that as painted hid the cover and the installed text-only
    // native probe reloaded the WebView white.
    const cardMain = new FakeEl("main");
    const card = cardMain.append(new FakeEl("div"));
    card.width = 358;
    card.height = 571;
    card.style.backgroundColor = "rgb(255, 255, 255)";
    card.style.borderTopWidth = "1px";
    const bar = card.append(new FakeEl("div"));
    bar.width = 200;
    bar.height = 16;
    bar.style.backgroundColor = "rgb(240, 240, 240)";
    assert.equal(elementHasRenderedContent(asEl(cardMain)), false);
    assert.equal(
      shellSignalsRealPage({
        rootText: "Dispatch header",
        mainText: "",
        mainHasRenderedContent: elementHasRenderedContent(asEl(cardMain)),
      }),
      false,
    );

    const main = new FakeEl("main");
    const spinner = main.append(new FakeEl("div"));
    spinner.width = 32;
    spinner.height = 32;
    spinner.style.borderTopWidth = "4px";
    spinner.style.borderRightWidth = "4px";
    spinner.style.borderBottomWidth = "4px";
    spinner.style.borderLeftWidth = "4px";
    assert.equal(elementHasRenderedContent(asEl(main)), false);

    const shell = new FakeEl("main");
    const chrome = shell.append(new FakeEl("div"));
    chrome.attrs["data-boot-chrome"] = "";
    chrome.style.opacity = "0";
    const icon = chrome.append(new FakeEl("svg"));
    icon.width = 16;
    icon.height = 16;
    const circle = chrome.append(new FakeEl("div"));
    circle.width = 36;
    circle.height = 36;
    circle.style.backgroundColor = "rgb(255, 255, 255)";
    circle.style.borderTopWidth = "1px";
    assert.equal(elementHasRenderedContent(asEl(shell)), false);

    const placeholder = new FakeEl("main");
    placeholder.text = "Opening Inflow";
    const dark = placeholder.append(new FakeEl("div"));
    dark.width = 400;
    dark.height = 800;
    dark.style.backgroundColor = "rgb(26, 26, 26)";
    assert.equal(elementHasRenderedContent(asEl(placeholder)), false);
    assert.equal(
      shellSignalsRealPage({
        rootText: placeholder.innerText,
        mainText: placeholder.innerText,
        mainHasRenderedContent: elementHasRenderedContent(asEl(placeholder)),
      }),
      false,
    );
  });

  it("does not classify a booted media-only main as an empty shell", () => {
    assert.equal(
      classifyBootSurface({
        booted: true,
        bootShellVisible: false,
        heartbeatAgeMs: 100,
        rootText: "header",
        mainText: "",
        mainHasRenderedContent: true,
      }),
      "booted",
    );
    assert.equal(
      classifyBootSurface({
        booted: true,
        bootShellVisible: false,
        heartbeatAgeMs: 100,
        rootText: "Dispatch header",
        mainText: "",
      }),
      "empty",
    );
  });

  it("reveals a boot failure only when no real screen is up", () => {
    assert.equal(
      shouldRevealBootFailure({ elapsedMs: 5_000, realScreenVisible: false }),
      false,
    );
    assert.equal(
      shouldRevealBootFailure({
        elapsedMs: BOOT_FAILURE_REVEAL_MS,
        realScreenVisible: false,
      }),
      true,
    );
    assert.equal(
      shouldRevealBootFailure({
        elapsedMs: BOOT_FAILURE_REVEAL_MS,
        realScreenVisible: true,
      }),
      false,
    );
  });
});
