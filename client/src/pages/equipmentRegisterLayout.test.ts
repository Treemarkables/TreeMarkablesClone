/**
 * Settings → Equipment register rows at iPhone width.
 *
 * The old row was one nowrap flex line: the name truncated, and a
 * whitespace-nowrap licence badge (flex-shrink: 0) covered the icon and
 * pushed Edit past the screen. The new row stacks on a phone and keeps the
 * badge inline from the lg breakpoint up.
 *
 * Run: node --experimental-strip-types --test client/src/pages/equipmentRegisterLayout.test.ts
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

const CLASS_2 = "Class 2 Heavy Motor Vehicle Licence";

const SEED = [
  {
    name: "Elevating Work Platform — 19m Niftylift Trailer Mount",
    type: "Equipment",
    licence: "",
  },
  {
    name: "Hiab Knuckle Boom Crane",
    type: "Crane",
    licence: CLASS_2,
  },
  {
    name: "Hino 500 Series Crane Truck",
    type: "Truck",
    licence: CLASS_2,
  },
  {
    name: "Chipper",
    type: "Equipment",
    licence: "",
  },
];

describe("equipment register row source", () => {
  const page = readFileSync(new URL("./EquipmentRegister.tsx", import.meta.url), "utf8");
  const badge = readFileSync(new URL("../components/ui/badge.tsx", import.meta.url), "utf8");
  const staff = readFileSync(new URL("./StaffManagement.tsx", import.meta.url), "utf8");

  it("stacks the name, type, and a wrapping licence, with a 44px Edit", () => {
    assert.match(page, /grid-cols-\[2\.75rem_minmax\(0,1fr\)_auto\]/);
    assert.match(page, /lg:grid-cols-\[2\.75rem_minmax\(8rem,1fr\)_minmax\(0,18rem\)_auto\]/);
    assert.match(page, /break-words text-base font-semibold leading-snug/);
    assert.match(page, /whitespace-normal/);
    assert.match(page, /min-h-11 min-w-11/);
    assert.match(page, /h-11 w-11/);
    assert.doesNotMatch(page, /truncate/);
  });

  it("leaves the shared badge and the staff list alone", () => {
    assert.match(badge, /whitespace-nowrap/);
    assert.doesNotMatch(staff, /EquipmentRegister/);
    assert.doesNotMatch(staff, /equip-row-/);
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const WRENCH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
const SHIELD = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;

function badgeHtml(licence: string) {
  if (!licence) {
    return `<span data-badge class="badge badge-ok">${CHECK}<span>No licence required</span></span>`;
  }
  return `<span data-badge class="badge badge-lic">${SHIELD}<span>${escapeHtml(licence)}</span></span>`;
}

function rowsHtml(layout: "before" | "after") {
  return SEED.map(
    (row) => `
      <article data-row class="row ${layout}">
        <div data-icon class="icon">${WRENCH}</div>
        <div class="name-block">
          <p data-name class="name">${escapeHtml(row.name)}</p>
          <p class="type">${escapeHtml(row.type)}</p>
        </div>
        ${
          layout === "before"
            ? `<div class="right">${badgeHtml(row.licence)}<button data-edit class="edit" type="button">Edit</button></div>`
            : `<div class="badge-slot">${badgeHtml(row.licence)}</div><button data-edit class="edit" type="button">Edit</button>`
        }
      </article>`,
  ).join("");
}

function pageHtml(layout: "before" | "after", withSidebar: boolean) {
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: hsl(60 33% 98%);
        color: hsl(240 5% 4%);
        font-family: Inter, "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell { display: flex; min-height: 100vh; align-items: stretch; }
      aside {
        width: 16rem;
        flex: none;
        background: #fff;
        border-right: 1px solid hsl(216 17% 89%);
        padding: 28px 16px;
      }
      aside .brand { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
      aside .group { margin-top: 28px; font-size: 12px; color: hsl(214 10% 40%); }
      aside .item {
        margin-top: 8px;
        padding: 8px 12px;
        border-radius: 10px;
        background: hsl(216 17% 94%);
        font-size: 14px;
        font-weight: 600;
      }
      main { flex: 1; min-width: 0; }
      .page { padding: ${layout === "before" ? "1.5rem" : "1rem"}; }
      @media (min-width: 640px) {
        .page { padding: 1.5rem; }
      }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
      .back {
        width: 44px; height: 44px; border-radius: 999px; border: 1px solid transparent;
        background: transparent; font-size: 22px; line-height: 1;
      }
      h1 { font-size: 24px; line-height: 1.2; margin: 0; }
      .sub { margin: 2px 0 0; color: hsl(214 10% 40%); font-size: 14px; }
      .card {
        background: #fff;
        border: 1px solid hsl(216 17% 89%);
        border-radius: 24px;
        box-shadow: 0 1px 2px rgb(15 23 42 / 0.04), 0 10px 28px rgb(15 23 42 / 0.05);
      }
      .card-head, .card-body { padding-left: ${layout === "before" ? "1.5rem" : "1rem"}; padding-right: ${layout === "before" ? "1.5rem" : "1rem"}; }
      @media (min-width: 640px) {
        .card-head, .card-body { padding-left: 1.5rem; padding-right: 1.5rem; }
      }
      .card-head { padding-top: 1.5rem; }
      .card-body { padding-bottom: 1.5rem; }
      .card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
      .card-title svg { width: 16px; height: 16px; }
      .list { display: flex; flex-direction: column; gap: ${layout === "before" ? "8px" : "12px"}; margin-top: 16px; }
      .row.before {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px; border: 1px solid hsl(216 17% 89%); border-radius: 6px; background: #fff;
        overflow: visible;
      }
      .row.before .left, .name-block { min-width: 0; }
      .row.before .cluster { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
      .row.before { }
      .row.before .icon { width: 36px; height: 36px; flex: none; }
      .row.before .name {
        margin: 0; font-size: 14px; font-weight: 500; line-height: 1.25;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .row.before .type { margin: 0; font-size: 12px; color: hsl(214 10% 40%); }
      .row.before .right { display: flex; align-items: center; gap: 8px; flex: none; }
      .row.before .badge { white-space: nowrap; position: relative; z-index: 1; flex: none; align-items: center; }
      .row.before .edit { height: 28px; min-height: 28px; padding: 0 12px; font-size: 12px; }
      .row.after {
        display: grid;
        grid-template-columns: 2.75rem minmax(0, 1fr) auto;
        align-items: start;
        column-gap: 0.75rem;
        row-gap: 0.5rem;
        min-width: 0;
        padding: 1rem;
        border: 1px solid hsl(216 17% 89%);
        border-radius: 6px;
        background: #fff;
      }
      .row.after .icon { grid-column: 1; grid-row: 1; width: 2.75rem; height: 2.75rem; align-self: start; }
      .row.after .name-block { grid-column: 2; grid-row: 1; }
      .row.after .name {
        margin: 0; font-size: 16px; font-weight: 600; line-height: 1.375;
        overflow-wrap: break-word; white-space: normal;
      }
      .row.after .type { margin: 2px 0 0; font-size: 14px; color: hsl(214 10% 40%); overflow-wrap: break-word; }
      .row.after .badge-slot { grid-column: 2 / span 2; grid-row: 2; min-width: 0; }
      .row.after .badge { white-space: normal; align-items: flex-start; width: fit-content; max-width: 100%; height: auto; }
      .row.after .edit {
        grid-column: 3; grid-row: 1; align-self: start;
        height: 44px; min-height: 44px; min-width: 44px; padding: 0 12px; font-size: 14px;
      }
      @media (min-width: 1024px) {
        .row.after {
          grid-template-columns: 2.75rem minmax(8rem, 1fr) minmax(0, 18rem) auto;
          align-items: center;
        }
        .row.after .icon { align-self: center; }
        .row.after .badge-slot { grid-column: 3; grid-row: 1; align-self: center; }
        .row.after .edit { grid-column: 4; align-self: center; }
      }
      .icon {
        display: flex; align-items: center; justify-content: center;
        border-radius: 6px; background: hsl(220 23% 97%); color: hsl(214 10% 40%);
      }
      .badge {
        display: inline-flex; gap: 4px; border-radius: 999px;
        padding: 2px 10px; font-size: 12px; font-weight: 600; line-height: 1.375;
      }
      .row.after .badge { padding-top: 4px; padding-bottom: 4px; }
      .badge svg { flex: none; margin-top: 1px; }
      .badge-ok { background: hsl(216 17% 94%); color: hsl(240 5% 4%); }
      .badge-lic { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
      .edit {
        border-radius: 999px; border: 1px solid rgba(0,0,0,0.1); background: #fff;
        color: inherit; font-family: inherit; font-weight: 500;
      }
    </style>
  </head><body>
    <div class="shell">
      ${
        withSidebar
          ? `<aside><div class="brand">Inflow</div><div class="group">Settings</div><div class="item">Equipment register</div></aside>`
          : ""
      }
      <main>
        <div class="page">
          <div class="header">
            <button class="back" type="button" aria-label="Back">‹</button>
            <div>
              <h1>Equipment Register</h1>
              <p class="sub">Assign licence requirements to each piece of equipment</p>
            </div>
          </div>
          <section class="card">
            <div class="card-head"><div class="card-title">${WRENCH} All Equipment (${SEED.length})</div></div>
            <div class="card-body"><div class="list">
              ${
                layout === "before"
                  ? SEED.map(
                      (row) => `
                        <article data-row class="row before">
                          <div class="cluster">
                            <div data-icon class="icon">${WRENCH}</div>
                            <div class="name-block">
                              <p data-name class="name">${escapeHtml(row.name)}</p>
                              <p class="type">${escapeHtml(row.type)}</p>
                            </div>
                          </div>
                          <div class="right">${badgeHtml(row.licence)}<button data-edit class="edit" type="button">Edit</button></div>
                        </article>`,
                    ).join("")
                  : rowsHtml("after")
              }
            </div></div>
          </section>
        </div>
      </main>
    </div>
  </body></html>`;
}

type Box = { top: number; left: number; right: number; bottom: number; width: number; height: number };
type RowMeasure = {
  name: string;
  badge: string;
  nameBox: Box;
  badgeBox: Box;
  editBox: Box;
  iconBox: Box;
  rowBox: Box;
  nameScrollW: number;
  nameClientW: number;
  nameFont: number;
  nameWeight: string;
  textInsideRow: boolean;
  badgeInsideRow: boolean;
};

function overlaps(a: Box, b: Box) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

describe("equipment register row geometry", { skip: CHROME ? false : "google-chrome is not installed" }, () => {
  it("reproduces the phone overlap, then keeps every row readable at 390px and on desktop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "equip-rows-"));
    const shots = "/opt/cursor/artifacts";
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

      const shoot = async (
        html: string,
        width: number,
        height: number,
        mobile: boolean,
        shot: string,
      ): Promise<RowMeasure[]> => {
        await cdp.send(
          "Emulation.setDeviceMetricsOverride",
          { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile },
          sessionId,
        );
        const path = join(dir, `${shot}.html`);
        writeFileSync(path, html);
        await cdp.send("Page.navigate", { url: `file://${path}` }, sessionId);
        await wait(400);
        const measured = (await cdp.send(
          "Runtime.evaluate",
          {
            expression: `(() => {
              const box = (el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
              };
              const inside = (el, row) => {
                const range = document.createRange();
                range.selectNodeContents(el);
                const rowBox = row.getBoundingClientRect();
                return [...range.getClientRects()].every((r) =>
                  r.width > 0 && r.left >= rowBox.left - 1 && r.right <= rowBox.right + 1 && r.bottom <= rowBox.bottom + 1
                );
              };
              const rows = [...document.querySelectorAll("[data-row]")].map((row) => {
                const name = row.querySelector("[data-name]");
                const badge = row.querySelector("[data-badge]");
                const style = getComputedStyle(name);
                return {
                  name: name.textContent,
                  badge: badge.textContent.trim(),
                  nameBox: box(name),
                  badgeBox: box(badge),
                  editBox: box(row.querySelector("[data-edit]")),
                  iconBox: box(row.querySelector("[data-icon]")),
                  rowBox: box(row),
                  nameScrollW: name.scrollWidth,
                  nameClientW: name.clientWidth,
                  nameFont: parseFloat(style.fontSize),
                  nameWeight: style.fontWeight,
                  textInsideRow: inside(name, row) && inside(badge, row),
                  badgeInsideRow: badge.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1,
                };
              });
              const main = document.querySelector("main");
              return { rows, contentBottom: main.getBoundingClientRect().bottom, innerW: window.innerWidth };
            })()`,
            returnByValue: true,
          },
          sessionId,
        )) as { result: { value: { rows: RowMeasure[]; contentBottom: number; innerW: number } } };
        const value = measured.result.value;
        const clipH = Math.max(1, Math.min(height, Math.ceil(value.contentBottom + 24)));
        const png = (await cdp.send(
          "Page.captureScreenshot",
          { format: "png", clip: { x: 0, y: 0, width, height: clipH, scale: 1 } },
          sessionId,
        )) as { data: string };
        writeFileSync(join(shots, `${shot}.png`), Buffer.from(png.data, "base64"));
        assert.equal(value.innerW, width);
        return value.rows;
      };

      const beforePhone = await shoot(pageHtml("before", false), 390, 1100, true, "equipment_register_before_390");
      const longBefore = beforePhone.filter((row) => row.badge.includes("Class 2"));
      assert.ok(longBefore.length >= 1);
      assert.ok(
        longBefore.some(
          (row) =>
            row.nameScrollW > row.nameClientW + 2 ||
            overlaps(row.badgeBox, row.nameBox) ||
            overlaps(row.badgeBox, row.iconBox) ||
            row.editBox.right > row.rowBox.right + 2,
        ),
        `old phone row should truncate, overlap, or push Edit off: ${JSON.stringify(longBefore)}`,
      );
      assert.ok(
        beforePhone.some((row) => row.name.startsWith("El") && row.nameScrollW > row.nameClientW + 2),
        "old row should truncate Elevating… to an ellipsis",
      );

      const afterPhone = await shoot(pageHtml("after", false), 390, 1200, true, "equipment_register_after_390");
      for (const row of afterPhone) {
        assert.ok(row.nameFont >= 16, `${row.name} font ${row.nameFont}`);
        assert.ok(Number(row.nameWeight) >= 600, `${row.name} weight ${row.nameWeight}`);
        assert.ok(row.nameScrollW <= row.nameClientW + 1, `${row.name} still truncated`);
        assert.ok(row.textInsideRow, `${row.name} text leaves the row`);
        assert.ok(row.badgeInsideRow, `${row.badge} leaves the row`);
        assert.ok(!overlaps(row.badgeBox, row.nameBox), `${row.name} badge overlaps the name`);
        assert.ok(!overlaps(row.badgeBox, row.iconBox), `${row.name} badge overlaps the icon`);
        assert.ok(!overlaps(row.badgeBox, row.editBox), `${row.name} badge overlaps Edit`);
        assert.ok(!overlaps(row.editBox, row.nameBox), `${row.name} Edit overlaps the name`);
        assert.ok(row.badgeBox.top >= row.nameBox.bottom - 1, `${row.name} badge is not on its own line`);
        assert.ok(row.editBox.height >= 44 && row.editBox.width >= 44, `${row.name} Edit is ${row.editBox.width}x${row.editBox.height}`);
        assert.ok(row.editBox.right <= row.rowBox.right + 1, `${row.name} Edit is off the row`);
        assert.ok(row.iconBox.width >= 44 && row.iconBox.height >= 44, `${row.name} icon is ${row.iconBox.width}`);
        assert.ok(row.nameClientW >= 96, `${row.name} column is only ${row.nameClientW}px`);
      }

      const beforeDesktop = await shoot(
        pageHtml("before", true),
        1280,
        900,
        false,
        "equipment_register_before_desktop",
      );
      for (const row of beforeDesktop) {
        assert.ok(row.editBox.right <= 1280, `${row.name} Edit off the desktop viewport`);
      }

      const afterDesktop = await shoot(
        pageHtml("after", true),
        1280,
        900,
        false,
        "equipment_register_after_desktop",
      );
      for (const row of afterDesktop) {
        assert.ok(row.nameFont >= 16, `${row.name} desktop font ${row.nameFont}`);
        assert.ok(row.nameScrollW <= row.nameClientW + 1, `${row.name} truncated on desktop`);
        assert.ok(row.textInsideRow, `${row.name} leaves the desktop row`);
        assert.ok(!overlaps(row.badgeBox, row.nameBox), `${row.name} badge overlaps the name on desktop`);
        assert.ok(!overlaps(row.badgeBox, row.iconBox), `${row.name} badge overlaps the icon on desktop`);
        assert.ok(!overlaps(row.badgeBox, row.editBox), `${row.name} badge overlaps Edit on desktop`);
        assert.ok(row.badgeBox.left >= row.nameBox.right - 1, `${row.name} badge is not inline on desktop`);
        assert.ok(row.editBox.height >= 44 && row.editBox.width >= 44, `desktop Edit ${row.editBox.width}x${row.editBox.height}`);
        assert.ok(row.editBox.right <= row.rowBox.right + 1, `${row.name} Edit off the desktop row`);
      }
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
