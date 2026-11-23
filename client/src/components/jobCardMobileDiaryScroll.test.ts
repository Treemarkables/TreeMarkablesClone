/**
 * Android Chrome will not chain a touch pan out of a nested overflow scroller
 * whose overscroll-behavior is none, even when that scroller has nothing to
 * scroll. Job Diary on the mobile card used to sit in PullToRefresh's
 * `h-full overflow-y-auto overscroll-y-none` port. The port grew with the
 * feed, so the pan died there and older entries stayed off screen.
 *
 * Embedded mode now returns the feed as plain flow so JobCardMobile's body
 * is the only scrollport. Desktop still uses the inner port, inside a pane
 * that has a real height.
 *
 * Run: node --experimental-strip-types --test client/src/components/jobCardMobileDiaryScroll.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const diarySectionSrc = readFileSync(
  new URL("./JobDiarySection.tsx", import.meta.url),
  "utf8",
);
const jobCardMobileSrc = readFileSync(
  new URL("./JobCardMobile.tsx", import.meta.url),
  "utf8",
);

describe("mobile job diary scroll owner", () => {
  it("embedded diary returns before the pull-to-refresh scrollport", () => {
    const embeddedReturn = diarySectionSrc.indexOf("if (embedded) return diary;");
    const pullWrap = diarySectionSrc.indexOf(
      "<PullToRefresh onRefresh={handleRefresh} enabled={false}>",
    );
    assert.ok(embeddedReturn > 0, "embedded diary must skip PullToRefresh");
    assert.ok(pullWrap > embeddedReturn, "desktop diary must keep PullToRefresh");
  });

  it("mobile card body is a shrinkable vertical scrollport", () => {
    assert.match(
      jobCardMobileSrc,
      /data-testid="job-card-mobile-body"[^>]*className="flex-1 min-h-0 overflow-y-auto bg-muted"|className="flex-1 min-h-0 overflow-y-auto bg-muted"[^>]*data-testid="job-card-mobile-body"/,
    );
  });
});

const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((bin) =>
  existsSync(bin),
);

function cards(count: number): string {
  return Array.from({ length: count }, (_, i) => {
    return `<article data-diary-entry-id="entry-${i + 1}" style="content-visibility:auto;contain-intrinsic-size:auto 160px;overflow:hidden;border-radius:1rem;min-height:180px;margin:12px;padding:12px;background:#fff;border:1px solid #ddd;">
      <h2>Diary entry ${i + 1}</h2>
      <p>Note body long enough to sit below the fold on a Galaxy sized viewport.</p>
    </article>`;
  }).join("");
}

/** Mirrors JobCardMobile after the fix: one body scrollport, flowing diary. */
function fixedMobileHtml(): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">
  <div style="position:fixed;inset:0;display:flex;flex-direction:column;background:#f3f4f6;">
    <header style="flex:0 0 56px;">Job</header>
    <div id="body" style="flex:1 1 auto;min-height:0;overflow-y:auto;background:#fff;">
      <div style="padding-bottom:110px;">${cards(24)}</div>
    </div>
  </div>
</body></html>`;
}

/**
 * Mirrors the bug: PullToRefresh's clipping shell plus
 * overflow-y:auto; overscroll-behavior-y:none around the same feed.
 */
function trappedMobileHtml(): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">
  <div style="position:fixed;inset:0;display:flex;flex-direction:column;">
    <header style="flex:0 0 56px;">Job</header>
    <div id="body" style="flex:1 1 auto;min-height:0;overflow-y:auto;">
      <div style="padding-bottom:110px;">
        <div style="position:relative;height:100%;width:100%;overflow:hidden;">
          <div id="trap" style="height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:none;">
            ${cards(24)}
          </div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;
}

/** Desktop diary pane: bounded height, inner scroller is supposed to move. */
function desktopPaneHtml(): string {
  return `<!doctype html><html><body style="margin:0">
  <div style="height:640px;display:flex;flex-direction:column;overflow:hidden;">
    <div style="flex:0 0 40px;">videos</div>
    <div style="position:relative;height:100%;width:100%;overflow:hidden;">
      <div id="pane" style="height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:none;">
        ${cards(24)}
      </div>
    </div>
  </div>
</body></html>`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  ws: WebSocket;
  id = 0;
  pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  opened: Promise<void>;
  constructor(ws: WebSocket) {
    this.ws = ws;
    this.opened = new Promise((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: unknown };
      if (msg.id && this.pending.has(msg.id)) {
        const waiter = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
        else waiter.resolve(msg.result);
      }
    });
  }
  async send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    await this.opened;
    const id = ++this.id;
    const result = await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload: Record<string, unknown> = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
    return result as { result?: { value?: unknown }; targetId?: string; sessionId?: string };
  }
}

async function touchPan(cdp: Cdp, sessionId: string) {
  const pts = (y: number) => [{ x: 180, y, id: 1, radiusX: 1, radiusY: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(560) }, sessionId);
  for (let y = 540; y >= 160; y -= 20) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(y) }, sessionId);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
}

async function evalJson(cdp: Cdp, sessionId: string, expression: string) {
  const res = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true },
    sessionId,
  );
  return (res as { result: { value: Record<string, number | null> } }).result.value;
}

describe("Android touch scroll of the mobile job diary", { skip: CHROME ? false : "google-chrome is not installed" }, () => {
  it("pans the card body after the fix, and the old nested port still swallows the pan", async () => {
    const dir = mkdtempSync(join(tmpdir(), "diary-scroll-"));
    const port = 9400 + Math.floor(Math.random() * 200);
    let chrome: ChildProcess | undefined;
    try {
      chrome = spawn(
        CHROME!,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${join(dir, "profile")}`,
          "about:blank",
        ],
        { stdio: "ignore" },
      );
      let version: { webSocketDebuggerUrl: string } | undefined;
      for (let i = 0; i < 40; i++) {
        try {
          version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
          break;
        } catch {
          await wait(150);
        }
      }
      assert.ok(version, "headless Chrome did not open a debugging port");
      const cdp = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
      const created = await cdp.send("Target.createTarget", { url: "about:blank" });
      const attached = await cdp.send("Target.attachToTarget", {
        targetId: created.targetId,
        flatten: true,
      });
      const sessionId = attached.sessionId!;
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      // Galaxy S21 / S22 class CSS viewport, touch enabled, Android UA.
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 360, height: 780, deviceScaleFactor: 3, mobile: true },
        sessionId,
      );
      await cdp.send(
        "Emulation.setTouchEmulationEnabled",
        { enabled: true, maxTouchPoints: 5 },
        sessionId,
      );
      await cdp.send(
        "Emulation.setUserAgentOverride",
        {
          userAgent:
            "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
        },
        sessionId,
      );

      const fixedPath = join(dir, "fixed.html");
      writeFileSync(fixedPath, fixedMobileHtml());
      await cdp.send("Page.navigate", { url: `file://${fixedPath}` }, sessionId);
      await wait(250);
      await touchPan(cdp, sessionId);
      await wait(200);
      const fixed = await evalJson(
        cdp,
        sessionId,
        `({body: document.getElementById('body').scrollTop})`,
      );
      assert.ok(
        (fixed.body ?? 0) > 80,
        `fixed diary body should move under a finger pan, scrollTop=${fixed.body}`,
      );

      const trapPath = join(dir, "trap.html");
      writeFileSync(trapPath, trappedMobileHtml());
      await cdp.send("Page.navigate", { url: `file://${trapPath}` }, sessionId);
      await wait(250);
      const trapBefore = await evalJson(
        cdp,
        sessionId,
        `({bodyH: document.getElementById('body').clientHeight, bodySH: document.getElementById('body').scrollHeight, trapH: document.getElementById('trap').clientHeight, trapSH: document.getElementById('trap').scrollHeight})`,
      );
      assert.ok(trapBefore.bodySH! > trapBefore.bodyH!, "card body has entries below the fold");
      assert.equal(trapBefore.trapH, trapBefore.trapSH, "nested port must have nothing of its own to scroll");
      await touchPan(cdp, sessionId);
      await wait(200);
      const trapped = await evalJson(
        cdp,
        sessionId,
        `({body: document.getElementById('body').scrollTop, trap: document.getElementById('trap').scrollTop})`,
      );
      assert.equal(trapped.body, 0, "nested overscroll none port must swallow the Android pan");
      assert.equal(trapped.trap, 0);

      // Desktop pane is tall enough to be a real scrollport, so the same
      // overscroll rule must still move that pane (mouse and touch).
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      const deskPath = join(dir, "desk.html");
      writeFileSync(deskPath, desktopPaneHtml());
      await cdp.send("Page.navigate", { url: `file://${deskPath}` }, sessionId);
      await wait(250);
      await cdp.send(
        "Input.synthesizeScrollGesture",
        { x: 200, y: 300, yDistance: -400, speed: 800, preventFling: true },
        sessionId,
      );
      await wait(200);
      const desk = await evalJson(
        cdp,
        sessionId,
        `({pane: document.getElementById('pane').scrollTop, paneH: document.getElementById('pane').clientHeight, paneSH: document.getElementById('pane').scrollHeight})`,
      );
      assert.ok(desk.paneSH! > desk.paneH!, "desktop pane overflows");
      assert.ok((desk.pane ?? 0) > 80, `desktop inner diary scroller should move, scrollTop=${desk.pane}`);
    } finally {
      if (chrome && chrome.exitCode == null) {
        chrome.kill("SIGKILL");
        await wait(200);
      }
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Chrome can still be releasing the profile directory.
      }
    }
  });
});
