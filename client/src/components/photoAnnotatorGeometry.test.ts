/**
 * Run: node --experimental-strip-types --test client/src/components/photoAnnotatorGeometry.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { twMerge } from "tailwind-merge";
import {
  ANNOTATOR_DIALOG_CLASS,
  arrowHeadScreenPx,
  arrowShaftScreenPx,
  clientToStagePx,
  fitImageContain,
  isSignificantMark,
  moveDraft,
  stagePxToImagePx,
} from "./photoAnnotatorGeometry.ts";

const DIALOG_DEFAULTS =
  "fixed left-[50%] top-[50%] z-[110] grid max-h-[90vh] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-3xl border bg-background p-6 shadow-lg sm:w-full";

describe("fitImageContain", () => {
  it("shows a 1440×1920 photo in full at the 402×536 stage from the iPhone editor", () => {
    // Phone content box is about 402px wide and taller than the photo, which
    // is what produced stage 402×536 in the screenshot.
    const fitted = fitImageContain(1440, 1920, 402, 700);
    assert.ok(Math.abs(fitted.w - 402) < 0.01);
    assert.ok(Math.abs(fitted.h - 536) < 0.01);
    assert.ok(Math.abs(fitted.w / fitted.h - 1440 / 1920) < 1e-9);

    const center = stagePxToImagePx(fitted.w / 2, fitted.h / 2, fitted.w, 1440);
    assert.ok(Math.abs(center.x - 720) < 0.01);
    assert.ok(Math.abs(center.y - 960) < 0.01);

    const corner = stagePxToImagePx(fitted.w, fitted.h, fitted.w, 1440);
    assert.ok(Math.abs(corner.x - 1440) < 0.01);
    assert.ok(Math.abs(corner.y - 1920) < 0.01);

    const origin = stagePxToImagePx(0, 0, fitted.w, 1440);
    assert.deepEqual(origin, { x: 0, y: 0 });
  });

  it("letterboxes a wide box instead of cropping the photo", () => {
    const fitted = fitImageContain(1440, 1920, 800, 536);
    assert.ok(Math.abs(fitted.h - 536) < 0.01);
    assert.ok(Math.abs(fitted.w - 402) < 0.01);
  });
});

describe("clientToStagePx", () => {
  it("maps a finger on the content box into stage pixels", () => {
    const box = { left: 12, top: 80, width: 402, height: 536 };
    const mid = clientToStagePx(12 + 201, 80 + 268, box, 402, 536);
    assert.ok(mid);
    assert.ok(Math.abs(mid.x - 201) < 0.01);
    assert.ok(Math.abs(mid.y - 268) < 0.01);
  });

  it("clamps a drag that leaves the photo to the stage edge", () => {
    const box = { left: 0, top: 0, width: 402, height: 536 };
    const pt = clientToStagePx(900, -40, box, 402, 536);
    assert.deepEqual(pt, { x: 402, y: 0 });
  });
});

describe("arrow shaft", () => {
  it("gives a real drag a shaft longer than the arrowhead at every stroke size", () => {
    const start = { x: 0.12, y: 0.42 };
    let arrow = {
      type: "arrow" as const,
      points: [start.x, start.y, start.x, start.y] as [
        number,
        number,
        number,
        number,
      ],
    };
    assert.equal(isSignificantMark(arrow), false);
    assert.equal(arrowShaftScreenPx(arrow.points, 402), 0);

    // Y is a fraction of width, so the finger's stage Y is 0.42 * 402, not
    // 0.42 * stage height.
    const end = clientToStagePx(0.72 * 402, 0.42 * 402, {
      left: 0,
      top: 0,
      width: 402,
      height: 536,
    }, 402, 536);
    assert.ok(end);
    arrow = moveDraft(arrow, end.x / 402, end.y / 402);
    const shaft = arrowShaftScreenPx(arrow.points, 402);
    assert.ok(Math.abs(shaft - 0.6 * 402) < 0.01);
    for (const stroke of [2, 4, 8]) {
      assert.ok(shaft > arrowHeadScreenPx(stroke));
    }
    assert.equal(isSignificantMark(arrow), true);

    const image = stagePxToImagePx(end.x, end.y, 402, 1440);
    assert.ok(Math.abs(image.x - 0.72 * 1440) < 0.01);
    assert.ok(Math.abs(image.y - 0.42 * 1440) < 0.01);
  });
});

describe("moveDraft", () => {
  it("grows a circle, a rectangle, and a pen stroke from the same pointer", () => {
    const circle = moveDraft(
      { type: "circle" as const, x: 0.2, y: 0.3, r: 0 },
      0.5,
      0.7,
    );
    assert.ok(Math.abs(circle.r - Math.hypot(0.3, 0.4)) < 1e-9);
    assert.equal(isSignificantMark(circle), true);

    const rect = moveDraft(
      { type: "rect" as const, x: 0.2, y: 0.3, w: 0, h: 0 },
      0.5,
      0.7,
    );
    assert.ok(Math.abs(rect.w - 0.3) < 1e-9);
    assert.ok(Math.abs(rect.h - 0.4) < 1e-9);

    const pen = moveDraft(
      { type: "pen" as const, points: [0.2, 0.3] },
      0.25,
      0.35,
    );
    assert.deepEqual(pen.points, [0.2, 0.3, 0.25, 0.35]);
    assert.equal(isSignificantMark(pen), true);
  });
});

describe("annotator dialog classes", () => {
  it("overrides the shared dialog cap so the editor covers the screen", () => {
    const merged = twMerge(DIALOG_DEFAULTS, ANNOTATOR_DIALOG_CLASS);
    assert.match(merged, /max-h-\[100dvh\]/);
    assert.doesNotMatch(merged, /max-h-\[90vh\]/);
    assert.match(merged, /overflow-hidden/);
    assert.doesNotMatch(merged, /overflow-y-auto/);
    assert.match(merged, /(?<!:)left-0/);
    assert.doesNotMatch(merged, /left-\[50%\]/);
    assert.doesNotMatch(merged, /translate-x-\[-50%\]/);
    assert.doesNotMatch(merged, /w-\[calc\(100%-2rem\)\]/);
  });
});
