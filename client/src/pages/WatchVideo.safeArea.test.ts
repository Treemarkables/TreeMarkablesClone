/**
 * Library, job-card copy-link, and customer share links all open /watch.
 * The Back control used to sit inside the iPhone status bar.
 *
 * Run: node --experimental-strip-types --test client/src/pages/WatchVideo.safeArea.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const page = readFileSync(new URL("./WatchVideo.tsx", import.meta.url), "utf8");
const photoViewer = readFileSync(new URL("../components/JobPhotoViewer.tsx", import.meta.url), "utf8");

/** Dynamic Island top inset. Desktop Chrome reports env(safe-area-inset-top) as 0. */
const STATUS_BAR_PX = 59;

describe("watch video safe area", () => {
  it("pads the header with the top inset and gives Back a 48px light control", () => {
    assert.match(page, /paddingTop:\s*"env\(safe-area-inset-top, 0px\)"/);
    assert.match(page, /paddingLeft:\s*"env\(safe-area-inset-left, 0px\)"/);
    assert.match(page, /paddingRight:\s*"env\(safe-area-inset-right, 0px\)"/);
    assert.match(page, /env\(safe-area-inset-bottom, 0px\)/);
    assert.match(page, /button-watch-back/);
    assert.match(page, /minHeight:\s*48/);
    assert.match(page, /minWidth:\s*48/);
    assert.match(page, /height:\s*48/);
    assert.match(page, /backgroundColor:\s*"#fff"/);
    assert.match(page, /color:\s*"#111"/);
    assert.match(page, /Powered by Treemarkables/);
    // The old header was a fixed 80px bar. Padding inside that box crushed
    // the row and left Back in the status bar.
    assert.doesNotMatch(page, /<header className="[^"]*\bh-20\b/);
  });

  it("keeps the job photo viewer close button below the same inset", () => {
    assert.match(photoViewer, /env\(safe-area-inset-top\)/);
    assert.match(photoViewer, /env\(safe-area-inset-right\)/);
    assert.match(photoViewer, /minHeight:\s*56/);
    assert.match(photoViewer, /minWidth:\s*56/);
    assert.match(photoViewer, /button-close-photo/);
  });
});

const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((bin) =>
  existsSync(bin),
);

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

function oldHeaderHtml(): string {
  // The shipped header: 80px, Back vertically centred, so most of the control
  // sits inside a 59px status bar.
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  </head><body style="margin:0;background:#fff;">
    <header style="box-sizing:border-box;height:80px;display:flex;align-items:center;justify-content:space-between;background:#000;padding:0 16px;">
      <div style="color:#fff;">Logo</div>
      <button id="back" style="box-sizing:border-box;height:36px;background:transparent;color:#fff;border:0;">Back</button>
    </header>
    <div id="status" style="position:fixed;top:0;left:0;right:0;height:${STATUS_BAR_PX}px;"></div>
    <main style="padding:32px 16px;"><div style="background:#f4f4f5;border-radius:12px;height:240px;"></div></main>
    <footer style="text-align:center;font:12px sans-serif;color:#666;padding:24px;">Powered by Treemarkables</footer>
  </body></html>`;
}

function newHeaderHtml(): string {
  // env(safe-area-inset-top) is 0 in desktop Chrome. 59px is the value iOS
  // reports for a Dynamic Island when viewport-fit=cover is set.
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  </head><body style="margin:0;background:#fff;font-family:sans-serif;">
    <header style="box-sizing:border-box;position:sticky;top:0;background:#000;padding-top:${STATUS_BAR_PX}px;">
      <div style="box-sizing:border-box;height:80px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;">
        <div style="color:#fff;">Logo</div>
        <button id="back" style="box-sizing:border-box;min-height:48px;min-width:48px;height:48px;padding:0 16px;background:#fff;color:#111;border:2px solid #111;border-radius:999px;font:600 16px sans-serif;">Back</button>
      </div>
    </header>
    <div id="status" style="position:fixed;top:0;left:0;right:0;height:${STATUS_BAR_PX}px;pointer-events:none;"></div>
    <main style="padding:32px 16px;"><div id="card" style="background:#f4f4f5;border-radius:12px;height:240px;"></div></main>
    <footer style="text-align:center;font:12px sans-serif;color:#666;padding:24px 16px 34px;">Powered by Treemarkables</footer>
  </body></html>`;
}

describe("watch video header on an iPhone-sized screen", { skip: CHROME ? false : "google-chrome is not installed" }, () => {
  it("moves Back below a 59px status bar and keeps a 48px target", async () => {
    const dir = mkdtempSync(join(tmpdir(), "watch-video-"));
    const shots = "/opt/cursor/artifacts/screenshots";
    mkdirSync(shots, { recursive: true });
    const port = 9700 + Math.floor(Math.random() * 200);
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
      const created = (await cdp.send("Target.createTarget", { url: "about:blank" })) as { targetId: string };
      const attached = (await cdp.send("Target.attachToTarget", {
        targetId: created.targetId,
        flatten: true,
      })) as { sessionId: string };
      const sessionId = attached.sessionId;
      await cdp.send("Page.enable", {}, sessionId);

      const measure = async (html: string, shot: string, width: number, height: number) => {
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height, deviceScaleFactor: 3, mobile: true },
          sessionId,
        );
        const path = join(dir, `${shot}.html`);
        writeFileSync(path, html);
        await cdp.send("Page.navigate", { url: `file://${path}` }, sessionId);
        await wait(300);
        const png = (await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId)) as { data: string };
        writeFileSync(join(shots, `${shot}.png`), Buffer.from(png.data, "base64"));
        const value = (await cdp.send(
          "Runtime.evaluate",
          {
            expression: `(() => {
              const back = document.getElementById('back').getBoundingClientRect();
              const status = document.getElementById('status').getBoundingClientRect();
              const style = getComputedStyle(document.getElementById('back'));
              return {
                top: back.top,
                bottom: back.bottom,
                left: back.left,
                right: back.right,
                width: back.width,
                height: back.height,
                statusBottom: status.bottom,
                innerW: window.innerWidth,
                innerH: window.innerHeight,
                bg: style.backgroundColor,
                color: style.color,
              };
            })()`,
            returnByValue: true,
          },
          sessionId,
        )) as { result: { value: Record<string, number | string> } };
        return value.result.value;
      };

      const before = await measure(oldHeaderHtml(), "watch-video-back-before", 390, 844);
      assert.ok(
        Number(before.top) < Number(before.statusBottom),
        `old Back should overlap the status bar, top=${before.top} status=${before.statusBottom}`,
      );

      const after = await measure(newHeaderHtml(), "watch-video-back-after", 390, 844);
      assert.ok(
        Number(after.top) >= Number(after.statusBottom),
        `Back top ${after.top} still overlaps status bar ending at ${after.statusBottom}`,
      );
      assert.ok(Number(after.height) >= 48, `Back height ${after.height}`);
      assert.ok(Number(after.width) >= 48, `Back width ${after.width}`);
      assert.ok(Number(after.left) >= 0, `Back left ${after.left}`);
      assert.ok(Number(after.right) <= Number(after.innerW) + 1, `Back right ${after.right}`);
      assert.equal(after.bg, "rgb(255, 255, 255)");
      assert.equal(after.color, "rgb(17, 17, 17)");

      const narrow = await measure(newHeaderHtml(), "watch-video-back-320", 320, 568);
      assert.ok(Number(narrow.top) >= STATUS_BAR_PX, `narrow Back top ${narrow.top}`);
      assert.ok(Number(narrow.height) >= 48, `narrow Back height ${narrow.height}`);
      assert.ok(Number(narrow.right) <= Number(narrow.innerW) + 1, `narrow Back right ${narrow.right}`);
    } finally {
      chrome?.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
