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

function newViewerHtml(): string {
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  </head><body style="margin:0;background:#000;">
    <div style="position:fixed;inset:0;height:100dvh;width:100%;display:flex;flex-direction:column;overflow:hidden;background:#000;">
      <button id="close" style="position:fixed;z-index:5;top:max(12px, env(safe-area-inset-top));right:max(12px, env(safe-area-inset-right));width:44px;height:44px;border-radius:999px;border:0;background:rgba(0,0,0,.75);color:#fff;">X</button>
      <div id="stage" style="position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;">
        <img id="photo" alt="" src="${PHOTO}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">
      </div>
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
              const photo = document.getElementById('photo').getBoundingClientRect();
              const stage = document.getElementById('stage');
              const stageBox = stage ? stage.getBoundingClientRect() : null;
              return {
                closeTop: close.top,
                closeBottom: close.bottom,
                closeRight: close.right,
                photoW: photo.width,
                photoH: photo.height,
                photoTop: photo.top,
                photoLeft: photo.left,
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
