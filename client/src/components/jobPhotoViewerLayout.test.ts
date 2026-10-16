/**
 * Galaxy-class viewport check: a camera-sized photo in the old centered
 * dialog pushes Close off the top of the screen. The new viewer keeps the
 * bitmap inside the stage and Close inside the viewport.
 *
 * Run: node --experimental-strip-types --test client/src/components/jobPhotoViewerLayout.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((bin) =>
  existsSync(bin),
);

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="4032" height="3024">
      <rect width="4032" height="3024" fill="#1e3a8a"/>
      <circle cx="2016" cy="1512" r="700" fill="#facc15"/>
      <text x="2016" y="1600" font-size="280" font-family="sans-serif" fill="#111" text-anchor="middle">TREE</text>
    </svg>`,
  );

function oldViewerHtml(): string {
  // Desktop Chrome honors max-width:100% on this image. Android WebView does
  // not, once the flex item's min-size resolves to the camera bitmap, so the
  // dialog is the intrinsic 4032×3024 box centered on the screen. This fixture
  // is that used layout: Close is in the header, above the viewport.
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head><body style="margin:0;background:#222;">
    <div id="dialog" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;background:#111;">
      <header id="close" style="flex:none;height:56px;line-height:56px;color:#fff;padding:0 16px;">Close</header>
      <img id="photo" alt="" width="4032" height="3024" src="${PHOTO}" style="width:4032px;height:3024px;max-width:none;object-fit:contain;">
    </div>
  </body></html>`;
}

function newViewerHtml(src = PHOTO): string {
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  </head><body style="margin:0;background:#000;">
    <div style="position:fixed;inset:0;height:100dvh;width:100%;display:flex;flex-direction:column;overflow:hidden;background:#000;">
      <div id="count" style="position:fixed;z-index:99;top:calc(env(safe-area-inset-top) + 34px);left:calc(env(safe-area-inset-left) + 16px);width:max-content;max-width:calc(100% - 6.5rem);color:#fff;font:14px sans-serif;pointer-events:none;">3 of 83</div>
      <button id="close" style="position:fixed;z-index:100;top:calc(env(safe-area-inset-top) + 16px);right:calc(env(safe-area-inset-right) + 12px);width:56px;height:56px;min-width:56px;min-height:56px;border-radius:999px;border:2px solid #fff;background:#000;color:#fff;font:700 28px sans-serif;">X</button>
      <div id="stage" style="position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;">
        <img id="photo" alt="" src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">
      </div>
    </div>
  </body></html>`;
}

// Library before/after shots are one side-by-side JPEG, wider than a phone.
const COMPOSITE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="7200" height="2400">
      <rect width="3600" height="2400" fill="#1e3a8a"/>
      <rect x="3600" width="3600" height="2400" fill="#14532d"/>
      <text x="1800" y="1280" font-size="280" font-family="sans-serif" fill="#fff" text-anchor="middle">BEFORE</text>
      <text x="5400" y="1280" font-size="280" font-family="sans-serif" fill="#fff" text-anchor="middle">AFTER</text>
    </svg>`,
  );

function rawCompositeHtml(): string {
  // Opening the library composite with target=_blank loads this bitmap as the
  // page. Android shows it at intrinsic size, so Close (if any) is off to the
  // right and there is no way back except leaving the WebView.
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head><body style="margin:0;background:#111;">
    <div style="position:relative;width:7200px;height:2400px;">
      <img id="photo" alt="" width="7200" height="2400" src="${COMPOSITE}" style="width:7200px;height:2400px;max-width:none;display:block;">
      <div id="close" style="position:absolute;top:12px;right:12px;width:44px;height:44px;background:#000;color:#fff;">X</div>
    </div>
  </body></html>`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Cdp {
  ws: WebSocket;
  id = 0;
  pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  opened: Promise<void>;
  constructor(ws: WebSocket) {
    this.ws = ws;
    this.opened = new Promise((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown };
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload: Record<string, unknown> = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
}

describe("Android photo viewer fit", { skip: CHROME ? false : "google-chrome is not installed" }, () => {
  it("keeps a 4032px photo and the close button on a 412x915 screen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "photo-viewer-"));
    const shots = "/opt/cursor/artifacts/screenshots";
    mkdirSync(shots, { recursive: true });
    const port = 9600 + Math.floor(Math.random() * 200);
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
      const created = (await cdp.send("Target.createTarget", { url: "about:blank" })) as {
        targetId: string;
      };
      const attached = (await cdp.send("Target.attachToTarget", {
        targetId: created.targetId,
        flatten: true,
      })) as { sessionId: string };
      const sessionId = attached.sessionId;
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
        sessionId,
      );

      const measure = async (html: string, shot: string) => {
        const path = join(dir, `${shot}.html`);
        writeFileSync(path, html);
        await cdp.send("Page.navigate", { url: `file://${path}` }, sessionId);
        await wait(400);
        const png = (await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId)) as {
          data: string;
        };
        writeFileSync(join(shots, `${shot}.png`), Buffer.from(png.data, "base64"));
        const value = (await cdp.send(
          "Runtime.evaluate",
          {
            expression: `(() => {
              const close = document.getElementById('close').getBoundingClientRect();
              const photoEl = document.getElementById('photo');
              const photo = photoEl.getBoundingClientRect();
              const stage = document.getElementById('stage');
              const stageBox = stage ? stage.getBoundingClientRect() : null;
              const count = document.getElementById('count');
              const countBox = count ? count.getBoundingClientRect() : null;
              const naturalW = photoEl.naturalWidth || photo.width;
              const naturalH = photoEl.naturalHeight || photo.height;
              const fit = Math.min(photo.width / naturalW, photo.height / naturalH);
              const contained = getComputedStyle(photoEl).objectFit === 'contain';
              return {
                closeTop: close.top,
                closeBottom: close.bottom,
                closeRight: close.right,
                closeLeft: close.left,
                closeW: close.width,
                closeH: close.height,
                countLeft: countBox ? countBox.left : null,
                countRight: countBox ? countBox.right : null,
                countTop: countBox ? countBox.top : null,
                countBottom: countBox ? countBox.bottom : null,
                photoW: photo.width,
                photoH: photo.height,
                photoTop: photo.top,
                photoLeft: photo.left,
                drawnW: contained ? naturalW * fit : photo.width,
                drawnH: contained ? naturalH * fit : photo.height,
                stageH: stageBox ? stageBox.height : null,
                innerW: window.innerWidth,
                innerH: window.innerHeight,
              };
            })()`,
            returnByValue: true,
          },
          sessionId,
        )) as { result: { value: Record<string, number | null> } };
        return value.result.value;
      };

      const before = await measure(oldViewerHtml(), "photo-viewer-before");
      assert.ok(
        (before.closeTop ?? 0) < 0,
        `old close button should sit above the viewport, top=${before.closeTop}`,
      );
      assert.ok((before.photoH ?? 0) > (before.innerH ?? 0), "old photo should be taller than the screen");

      const after = await measure(newViewerHtml(), "photo-viewer-after");
      assert.ok((after.closeTop ?? -1) >= 0, `close top ${after.closeTop}`);
      assert.ok((after.closeBottom ?? 9999) <= (after.innerH ?? 0), `close bottom ${after.closeBottom}`);
      assert.ok((after.closeRight ?? 9999) <= (after.innerW ?? 0) + 1, `close right ${after.closeRight}`);
      assert.ok((after.photoW ?? 9999) <= (after.innerW ?? 0) + 1, `photo width ${after.photoW}`);
      assert.ok(
        (after.photoH ?? 9999) <= (after.stageH ?? 0) + 1,
        `photo height ${after.photoH} stage ${after.stageH}`,
      );
      assert.ok((after.photoTop ?? -1) >= -1, `photo top ${after.photoTop}`);
      assert.ok((after.closeW ?? 0) >= 56, `close width ${after.closeW}`);
      assert.ok((after.closeH ?? 0) >= 56, `close height ${after.closeH}`);
      assert.ok((after.closeTop ?? 0) >= 12, `close should clear the status bar, top=${after.closeTop}`);
      assert.ok(
        (after.countRight ?? 9999) <= (after.closeLeft ?? 0),
        `counter right ${after.countRight} overlaps close left ${after.closeLeft}`,
      );

      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 360, height: 800, deviceScaleFactor: 2, mobile: true },
        sessionId,
      );
      const narrow = await measure(newViewerHtml(), "photo-viewer-360");
      assert.ok((narrow.closeW ?? 0) >= 56, `narrow close width ${narrow.closeW}`);
      assert.ok((narrow.closeRight ?? 9999) <= (narrow.innerW ?? 0) + 1, `narrow close right ${narrow.closeRight}`);
      assert.ok(
        (narrow.countRight ?? 9999) <= (narrow.closeLeft ?? 0),
        `narrow counter right ${narrow.countRight} overlaps close left ${narrow.closeLeft}`,
      );

      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
        sessionId,
      );
      const compositeBefore = await measure(rawCompositeHtml(), "library-before-after-before");
      assert.ok(
        (compositeBefore.drawnW ?? 0) > (compositeBefore.innerW ?? 0),
        `raw composite should be wider than the phone, drawn=${compositeBefore.drawnW}`,
      );
      assert.ok(
        (compositeBefore.closeRight ?? 0) > (compositeBefore.innerW ?? 0),
        `raw composite close should be off the right edge, right=${compositeBefore.closeRight}`,
      );

      const compositeAfter = await measure(newViewerHtml(COMPOSITE), "library-before-after-after");
      assert.ok((compositeAfter.closeTop ?? -1) >= 0, `composite close top ${compositeAfter.closeTop}`);
      assert.ok(
        (compositeAfter.closeRight ?? 9999) <= (compositeAfter.innerW ?? 0) + 1,
        `composite close right ${compositeAfter.closeRight}`,
      );
      assert.ok(
        (compositeAfter.closeLeft ?? -1) >= 0,
        `composite close left ${compositeAfter.closeLeft}`,
      );
      assert.ok(
        (compositeAfter.drawnW ?? 9999) <= (compositeAfter.innerW ?? 0) + 1,
        `fitted composite width ${compositeAfter.drawnW}`,
      );
      assert.ok(
        (compositeAfter.drawnH ?? 9999) <= (compositeAfter.stageH ?? 0) + 1,
        `fitted composite height ${compositeAfter.drawnH}`,
      );
      assert.ok((compositeAfter.drawnW ?? 0) > 100, "composite should still be visible");
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
