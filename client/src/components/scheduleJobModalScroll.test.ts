/**
 * Run: node --experimental-strip-types --test client/src/components/scheduleJobModalScroll.test.ts
 *
 * The Schedule Job dialog must scroll on a phone. Desktop (wide and tall)
 * keeps the centered 85vh layout. Chrome checks the real CSS from index.css
 * against a phone viewport and a desktop viewport.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const card = readFileSync(new URL("./GlobalJobCard.tsx", import.meta.url), "utf8");

const scheduleCss = css.slice(css.indexOf("/* Schedule Job modal"));
assert.ok(scheduleCss.startsWith("/* Schedule Job modal"), "schedule CSS block missing");

function chromeDump(html: string, width: number, height: number): string {
  const dir = mkdtempSync(join(tmpdir(), "schedule-job-"));
  const file = join(dir, "fixture.html");
  writeFileSync(file, html);
  const chrome = spawnSync(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${join(dir, "profile")}`,
      `--window-size=${width},${height}`,
      "--dump-dom",
      `file://${file}`,
    ],
    { encoding: "utf8", timeout: 20000, killSignal: "SIGKILL" },
  );
  const stdout = chrome.stdout || "";
  if (!stdout.includes("data-result=")) {
    throw new Error(chrome.stderr || stdout || "chrome failed");
  }
  const match = stdout.match(/data-result="([^"]*)"/);
  assert.ok(match, "chrome fixture did not report a result");
  return JSON.parse(match[1].replaceAll("&quot;", '"'));
}

function fixture(): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root { --background: 60 33% 98%; }
  * { box-sizing: border-box; }
  /* Desktop / default dialog utilities the component already ships. */
  .schedule-job-dialog {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    translate: -50% -50%;
    max-height: 85vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    width: calc(100% - 2rem);
    max-width: 32rem;
    background: white;
  }
  .schedule-job-dialog__body { overflow-y: auto; flex: 1 1 0%; min-height: 0; }
  .schedule-job-dialog__staff { max-height: 15rem; overflow-y: auto; }
  ${scheduleCss}
</style>
</head>
<body>
  <div class="schedule-job-dialog" id="dialog">
    <div class="schedule-job-dialog__header">Schedule Job</div>
    <div class="schedule-job-dialog__body" id="body">
      <div class="schedule-job-dialog__calendar">
        <p>Select Days</p>
        <button type="button" id="day">15</button>
        <div style="height:320px">calendar</div>
      </div>
      <div style="height:72px">Start Time Duration</div>
      <div class="schedule-job-dialog__staff" id="staff" style="height:480px">Assign Staff Members</div>
    </div>
    <div class="schedule-job-dialog__footer" id="footer">Unschedule Cancel Schedule</div>
  </div>
  <script>
    const dialog = document.getElementById("dialog");
    const body = document.getElementById("body");
    const day = document.getElementById("day");
    const staff = document.getElementById("staff");
    const footer = document.getElementById("footer");
    const header = document.querySelector(".schedule-job-dialog__header");
    body.scrollTop = 240;
    const dialogBox = dialog.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    const staffBox = staff.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const result = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      overflowY: getComputedStyle(dialog).overflowY,
      transform: getComputedStyle(dialog).transform,
      maxHeight: getComputedStyle(dialog).maxHeight,
      bodyOverflowY: getComputedStyle(body).overflowY,
      overscroll: getComputedStyle(body).overscrollBehavior,
      webkit: getComputedStyle(body).webkitOverflowScrolling || "",
      touchAction: getComputedStyle(day).touchAction,
      headerPosition: getComputedStyle(header).position,
      footerPosition: getComputedStyle(footer).position,
      staffMaxHeight: getComputedStyle(staff).maxHeight,
      staffOverflow: getComputedStyle(staff).overflowY,
      bodyScrollable: body.scrollHeight > body.clientHeight + 1,
      scrolled: body.scrollTop > 0,
      dialogTop: dialogBox.top,
      dialogBottom: dialogBox.bottom,
      footerVisible: footerBox.top < window.innerHeight && footerBox.bottom > 0,
      staffReached: staffBox.top < bodyBox.bottom && staffBox.bottom > bodyBox.top,
    };
    document.body.setAttribute("data-result", JSON.stringify(result));
  </script>
</body>
</html>`;
}

describe("Schedule Job modal scroll", () => {
  it("keeps a scrollable body, sticky chrome, and pan-y calendar in source", () => {
    assert.match(card, /className="schedule-job-dialog /);
    assert.match(card, /schedule-job-dialog__header/);
    assert.match(card, /schedule-job-dialog__body/);
    assert.match(card, /schedule-job-dialog__footer/);
    assert.match(card, /schedule-job-dialog__calendar/);
    assert.match(card, /onTouchMove=\{\(e\) => e\.stopPropagation\(\)\}/);
    assert.match(scheduleCss, /100dvh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\)/);
    assert.match(scheduleCss, /position: sticky/);
    assert.match(scheduleCss, /overflow-y: auto/);
    assert.match(scheduleCss, /-webkit-overflow-scrolling: touch/);
    assert.match(scheduleCss, /overscroll-behavior: contain/);
    assert.match(scheduleCss, /touch-action: pan-y/);
    assert.match(scheduleCss, /transform: none/);
    assert.match(scheduleCss, /max-width: 767px/);
    assert.match(scheduleCss, /pointer: coarse/);
  });

  it("scrolls the body inside the visual viewport on a phone", () => {
    const phone = chromeDump(fixture(), 390, 844);
    assert.ok(phone.innerWidth <= 767, JSON.stringify(phone));
    assert.equal(phone.overflowY, "hidden");
    assert.equal(phone.transform, "none");
    assert.equal(phone.bodyOverflowY, "auto");
    assert.equal(phone.overscroll, "contain");
    assert.equal(phone.touchAction, "pan-y");
    assert.equal(phone.headerPosition, "sticky");
    assert.equal(phone.footerPosition, "sticky");
    assert.equal(phone.staffMaxHeight, "none");
    assert.equal(phone.staffOverflow, "visible");
    assert.equal(phone.bodyScrollable, true);
    assert.equal(phone.scrolled, true);
    assert.equal(phone.staffReached, true);
    assert.equal(phone.footerVisible, true);
    assert.ok(phone.dialogTop >= -1, JSON.stringify(phone));
    assert.ok(phone.dialogBottom <= phone.innerHeight + 1, JSON.stringify(phone));
    const maxPx = parseFloat(phone.maxHeight);
    assert.ok(maxPx <= phone.innerHeight, JSON.stringify(phone));
  });

  it("leaves the centered 85vh dialog alone on a desktop viewport", () => {
    const desktop = chromeDump(fixture(), 1440, 900);
    assert.ok(desktop.innerWidth > 767, JSON.stringify(desktop));
    assert.equal(desktop.overflowY, "auto");
    assert.notEqual(desktop.transform, "none");
    assert.equal(desktop.touchAction, "auto");
    assert.equal(desktop.overscroll, "auto");
    assert.equal(desktop.headerPosition, "static");
    assert.notEqual(desktop.staffMaxHeight, "none");
    assert.equal(desktop.staffOverflow, "auto");
    const maxPx = parseFloat(desktop.maxHeight);
    const expected = desktop.innerHeight * 0.85;
    assert.ok(Math.abs(maxPx - expected) < 2, JSON.stringify(desktop));
  });
});
