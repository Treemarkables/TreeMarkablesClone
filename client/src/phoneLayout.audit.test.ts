/**
 * Phone layout fixtures at 360×800 and 412×915. Labels are test data.
 *
 * Run: node --experimental-strip-types --test client/src/phoneLayout.audit.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((bin) =>
  existsSync(bin),
);

describe("phone layout source", () => {
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("./components/ui/sheet.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("./components/ui/dialog.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("./pages/Login.tsx", import.meta.url), "utf8");
  const invoices = readFileSync(new URL("./pages/Invoices.tsx", import.meta.url), "utf8");

  it("wraps the dispatch header at 44px instead of shrinking it off-screen", () => {
    assert.match(app, /MOBILE_HEADER_ICON = "h-11 w-11 min-w-11 shrink-0"/);
    assert.match(app, /flex-wrap items-center gap-1/);
    assert.match(app, /LogoSidebarTrigger size=\{44\}/);
    assert.doesNotMatch(app, /min-w-9/);
  });

  it("scrolls crowded tab rows and clipped tables on a phone", () => {
    assert.match(css, /\[role="tablist"\]\.grid:has\(> :nth-child\(4\)\)/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\.overflow-hidden:has\(> table\)/);
  });

  it("keeps sheets, dialogs, login, and invoice tabs on a short screen", () => {
    assert.match(sheet, /max-h-\[90dvh\]/);
    assert.match(sheet, /h-11 w-11/);
    assert.match(dialog, /max-h-\[90dvh\]/);
    assert.match(login, /min-h-dvh overflow-y-auto/);
    assert.match(invoices, /whitespace-normal px-2 text-center leading-tight/);
  });
});

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

const HEADER_LABELS = ["Menu", "Bug", "Bell", "New", "Paste", "Filter", "Lanes", "Search", "Account"];

function headerHtml(wrap: boolean, frame: number): string {
  const buttons = HEADER_LABELS.map((label, i) => {
    const size = wrap ? 44 : 40;
    const shrink = wrap || i === 0 ? "0 0 auto" : "0 1 auto";
    const min = wrap ? 44 : i === 0 ? 40 : 36;
    return `<button id="b${i}" aria-label="${label}" style="flex:${shrink};width:${size}px;height:${size}px;min-width:${min}px;border-radius:999px;border:0;background:#111;color:#fff;font-size:11px;">${label.slice(0, 1)}</button>`;
  }).join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=${frame}"></head>
    <body style="margin:0;font-family:sans-serif;background:#bbb;">
      <div id="screen" style="width:${frame}px;background:#f4f4f0;overflow:hidden;">
        <header id="bar" style="display:flex;flex-wrap:${wrap ? "wrap" : "nowrap"};align-items:center;gap:4px;padding:8px;box-sizing:border-box;width:${frame}px;">
          ${buttons}
        </header>
      </div>
    </body></html>`;
}

function tabsHtml(scroll: boolean): string {
  const labels = ["Curated", "All Requests", "Follow-up", "Analytics", "Settings"];
  const tabs = labels
    .map(
      (label) =>
        `<button role="tab" style="${scroll ? "flex:0 0 auto;min-height:44px;" : ""}white-space:nowrap;padding:6px 12px;border:0;border-radius:999px;background:#fff;">${label}</button>`,
    )
    .join("");
  const list = scroll
    ? "display:flex;height:auto;max-width:100%;justify-content:flex-start;overflow-x:auto;"
    : "display:grid;grid-template-columns:repeat(5,minmax(0,1fr));height:40px;overflow:hidden;";
  return `<!doctype html><html><head><meta name="viewport" content="width=360"></head>
    <body style="margin:0;font-family:sans-serif;">
      <div role="tablist" id="tabs" style="${list}width:360px;gap:4px;padding:4px;background:#eee;box-sizing:border-box;">${tabs}</div>
    </body></html>`;
}

function invoiceTabsHtml(wrap: boolean): string {
  const labels = ["All (12)", "Pending (4)", "Not in Xero (128)"];
  const tabs = labels
    .map(
      (label) =>
        `<button role="tab" style="white-space:${wrap ? "normal" : "nowrap"};min-height:44px;height:${wrap ? "auto" : "40px"};padding:8px 12px;font-size:14px;border:0;background:#fff;line-height:1.2;">${label}</button>`,
    )
    .join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;font-family:sans-serif;">
      <div id="tabs" style="display:grid;width:360px;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:12px;box-sizing:border-box;">${tabs}</div>
    </body></html>`;
}

function sheetHtml(capped: boolean): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;background:#ddd;font-family:sans-serif;">
      <div id="screen" style="position:relative;width:360px;height:800px;overflow:hidden;background:#ddd;">
        <div id="sheet" style="position:absolute;left:0;right:0;bottom:0;background:#fff;overflow:auto;${capped ? "max-height:90%;" : "height:1400px;"}">
          <button id="close" style="position:absolute;right:8px;top:8px;width:${capped ? 44 : 16}px;height:${capped ? 44 : 16}px;">X</button>
          <div style="padding:64px 16px;height:1200px;">Actions<br>Schedule<br>Quote<br>Invoice</div>
        </div>
      </div>
    </body></html>`;
}

describe("Android phone layout fixtures", { skip: CHROME ? false : "google-chrome is not installed" }, () => {
  it("fits the dispatch header, tabs, invoice labels, and a tall sheet", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phone-layout-"));
    const shots = "/opt/cursor/artifacts/screenshots";
    mkdirSync(shots, { recursive: true });
    const port = 9800 + Math.floor(Math.random() * 200);
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

      const measure = async (html: string, shot: string, expression: string, width: number, height: number) => {
        const path = join(dir, `${shot}.html`);
        writeFileSync(path, html);
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height, deviceScaleFactor: 1, mobile: true },
          sessionId,
        );
        await cdp.send("Page.navigate", { url: `file://${path}` }, sessionId);
        await wait(200);
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height, deviceScaleFactor: 1, mobile: true },
          sessionId,
        );
        await cdp.send("Page.reload", { ignoreCache: true }, sessionId);
        await wait(250);
        const png = (await cdp.send(
          "Page.captureScreenshot",
          { format: "png", clip: { x: 0, y: 0, width, height: Math.min(height, 800), scale: 1 } },
          sessionId,
        )) as { data: string };
        writeFileSync(join(shots, `${shot}.png`), Buffer.from(png.data, "base64"));
        const value = (await cdp.send(
          "Runtime.evaluate",
          { expression, returnByValue: true },
          sessionId,
        )) as { result: { value: Record<string, number> } };
        return value.result.value;
      };

      const headerExpr = `(() => {
        const buttons = [...document.querySelectorAll('header button')].map((el) => {
          const r = el.getBoundingClientRect();
          return { right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        });
        return {
          innerW: window.innerWidth,
          scrollW: document.documentElement.scrollWidth,
          lastRight: buttons[buttons.length - 1].right,
          minSize: Math.min(...buttons.map((b) => Math.min(b.width, b.height))),
          maxRight: Math.max(...buttons.map((b) => b.right)),
        };
      })()`;

      const headerBefore = await measure(headerHtml(false, 360), "dispatch-header-360-before", headerExpr, 360, 800);
      assert.ok(headerBefore.lastRight > 360, `header should overflow 360 ${JSON.stringify(headerBefore)}`);

      const headerAfter = await measure(headerHtml(true, 360), "dispatch-header-360-after", headerExpr, 360, 800);
      assert.ok(headerAfter.maxRight <= 360 + 1, `wrapped header maxRight=${headerAfter.maxRight}`);
      assert.ok(headerAfter.minSize >= 44, `tap size ${headerAfter.minSize}`);

      await measure(headerHtml(false, 412), "dispatch-header-412-before", headerExpr, 412, 915);
      const header412 = await measure(headerHtml(true, 412), "dispatch-header-412-after", headerExpr, 412, 915);
      assert.ok(header412.maxRight <= 412 + 1, `412 header maxRight=${header412.maxRight}`);
      assert.ok(header412.minSize >= 44, `412 tap size ${header412.minSize}`);

      const tabsExpr = `(() => {
        const tabs = [...document.querySelectorAll('[role=tab]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { client: el.clientWidth, scroll: el.scrollWidth, height: r.height };
        });
        const list = document.getElementById('tabs');
        return {
          listW: list.getBoundingClientRect().width,
          clipped: tabs.filter((t) => t.scroll > t.client + 1).length,
          minH: Math.min(...tabs.map((t) => t.height)),
        };
      })()`;
      const tabsBefore = await measure(tabsHtml(false), "tabs-360-before", tabsExpr, 360, 800);
      assert.ok(tabsBefore.clipped > 0, "five nowrap tabs should clip on 360");
      const tabsAfter = await measure(tabsHtml(true), "tabs-360-after", tabsExpr, 360, 800);
      assert.equal(tabsAfter.clipped, 0);
      assert.ok(tabsAfter.listW <= 361);
      assert.ok(tabsAfter.minH >= 44);

      const invoiceExpr = `(() => {
        const tab = document.querySelectorAll('[role=tab]')[2];
        const box = tab.getBoundingClientRect();
        return { client: tab.clientWidth, scroll: tab.scrollWidth, right: box.right, height: box.height };
      })()`;
      const invoiceBefore = await measure(invoiceTabsHtml(false), "invoice-tabs-360-before", invoiceExpr, 360, 800);
      assert.ok(
        invoiceBefore.scroll > invoiceBefore.client + 1 || invoiceBefore.right > 361,
        `Not in Xero should clip or overflow ${JSON.stringify(invoiceBefore)}`,
      );
      const invoiceAfter = await measure(invoiceTabsHtml(true), "invoice-tabs-360-after", invoiceExpr, 360, 800);
      assert.ok(invoiceAfter.scroll <= invoiceAfter.client + 1, `wrapped scroll=${invoiceAfter.scroll} client=${invoiceAfter.client}`);
      assert.ok(invoiceAfter.right <= 361, `wrapped right=${invoiceAfter.right}`);
      assert.ok(invoiceAfter.height >= 44);

      const sheetExpr = `(() => {
        const screen = document.getElementById('screen').getBoundingClientRect();
        const close = document.getElementById('close').getBoundingClientRect();
        const sheet = document.getElementById('sheet').getBoundingClientRect();
        return {
          closeTop: close.top - screen.top,
          closeSize: close.width,
          sheetBottom: sheet.bottom - screen.top,
          screenH: screen.height,
        };
      })()`;
      const sheetBefore = await measure(sheetHtml(false), "sheet-360-before", sheetExpr, 360, 800);
      assert.ok(sheetBefore.closeTop < 0, `uncapped sheet close top=${sheetBefore.closeTop}`);
      const sheetAfter = await measure(sheetHtml(true), "sheet-360-after", sheetExpr, 360, 800);
      assert.ok(sheetAfter.closeTop >= 0, `capped close top=${sheetAfter.closeTop}`);
      assert.ok(sheetAfter.closeSize >= 44);
      assert.ok(sheetAfter.sheetBottom <= sheetAfter.screenH + 1, `sheet bottom ${sheetAfter.sheetBottom}`);
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
