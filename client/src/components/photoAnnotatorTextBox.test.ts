/**
 * Run: npx tsx --test client/src/components/photoAnnotatorTextBox.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { annotationTextFrame } from "@shared/annotationTextWrap";
import {
  applyTextBoxPointer,
  defaultTextBox,
  fontSizeNormForStroke,
  textBoxCoveringContent,
  textBoxHandleAt,
} from "./photoAnnotatorTextBox.ts";

const STAGE_W = 402;
const STAGE_H = 536;

describe("fontSizeNormForStroke", () => {
  it("maps the size buttons and leaves medium where older text sat", () => {
    assert.equal(fontSizeNormForStroke(2), 0.03);
    assert.equal(fontSizeNormForStroke(4), 0.04);
    assert.equal(fontSizeNormForStroke(8), 0.06);
  });
});

describe("applyTextBoxPointer", () => {
  it("drags the box and keeps it on the photo", () => {
    const start = defaultTextBox(0.2, 0.3, 0.04, STAGE_W, STAGE_H);
    const moved = applyTextBoxPointer(
      start,
      "move",
      0.15,
      0.1,
      STAGE_W,
      STAGE_H,
      0.04,
    );
    assert.ok(Math.abs(moved.x - (start.x + 0.15)) < 0.02);
    assert.ok(Math.abs(moved.y - (start.y + 0.1)) < 0.02);
    assert.equal(moved.boxWidth, start.boxWidth);
    assert.equal(moved.boxHeight, start.boxHeight);

    const shoved = applyTextBoxPointer(
      start,
      "move",
      5,
      5,
      STAGE_W,
      STAGE_H,
      0.04,
    );
    assert.ok(shoved.x + shoved.boxWidth <= 1);
    assert.ok(shoved.y + shoved.boxHeight <= STAGE_H / STAGE_W + 0.001);
  });

  it("changes wrap width and box height without a font size to write back", () => {
    const start = defaultTextBox(0.2, 0.3, 0.04, STAGE_W, STAGE_H);
    const wider = applyTextBoxPointer(
      start,
      "e",
      0.1,
      0,
      STAGE_W,
      STAGE_H,
      0.04,
    );
    assert.ok(wider.boxWidth > start.boxWidth + 0.05);
    assert.equal(wider.x, start.x);
    assert.equal(wider.boxHeight, start.boxHeight);

    const fromLeft = applyTextBoxPointer(
      start,
      "w",
      -0.08,
      0,
      STAGE_W,
      STAGE_H,
      0.04,
    );
    assert.ok(fromLeft.x < start.x);
    assert.ok(Math.abs(fromLeft.x + fromLeft.boxWidth - (start.x + start.boxWidth)) < 0.02);

    const taller = applyTextBoxPointer(
      start,
      "se",
      0.05,
      0.12,
      STAGE_W,
      STAGE_H,
      0.04,
    );
    assert.ok(taller.boxWidth > start.boxWidth);
    assert.ok(taller.boxHeight > start.boxHeight);
  });

  it("wraps a long note when the box gets narrower and keeps the font", () => {
    const font = fontSizeNormForStroke(4);
    const wide = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.2,
      fontSizeNorm: font,
      text: "Large oak on the fence line needs to come down before Friday",
      imageWidthPx: 1000,
      imageHeightPx: 1200,
      boxWidthNorm: 0.8,
      boxHeightNorm: 0.2,
    });
    const narrow = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.2,
      fontSizeNorm: font,
      text: "Large oak on the fence line needs to come down before Friday",
      imageWidthPx: 1000,
      imageHeightPx: 1200,
      boxWidthNorm: 0.22,
      boxHeightNorm: 0.35,
    });
    assert.equal(wide.fontSizePx, narrow.fontSizePx);
    assert.ok(narrow.lines.length > wide.lines.length);
    assert.ok(narrow.widthPx < wide.widthPx);
    assert.equal(narrow.xPx, 100);
    assert.equal(narrow.yPx, 200);
  });

  it("grows a narrowed box so the whole note stays visible", () => {
    const text = "Large oak on the fence line needs to come down before Friday";
    const font = fontSizeNormForStroke(4);
    const wide = defaultTextBox(0.1, 0.2, font, 1000, 1200);
    const narrow = applyTextBoxPointer(wide, "e", -0.2, 0, 1000, 1200, font);
    const fitted = textBoxCoveringContent(narrow, text, font, 1000, 1200);
    const frame = annotationTextFrame({
      xNorm: fitted.x,
      yNorm: fitted.y,
      fontSizeNorm: font,
      text,
      imageWidthPx: 1000,
      imageHeightPx: 1200,
      boxWidthNorm: fitted.boxWidth,
      boxHeightNorm: fitted.boxHeight,
    });
    assert.equal(frame.fontSizePx, font * 1000);
    assert.equal(frame.visibleLines.length, frame.lines.length);
    assert.equal(frame.lines.join(" "), text);
    assert.ok(fitted.boxHeight > narrow.boxHeight);
  });

  it("hides lines that sit below a short box and shows them when the box grows", () => {
    const text = "One two three four five six seven eight nine ten";
    const short = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.1,
      fontSizeNorm: 0.04,
      text,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      boxWidthNorm: 0.25,
      boxHeightNorm: 0.05,
    });
    assert.ok(short.lines.length > short.visibleLines.length);
    const grown = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.1,
      fontSizeNorm: 0.04,
      text,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      boxWidthNorm: 0.25,
      boxHeightNorm: 0.4,
    });
    assert.equal(grown.visibleLines.length, grown.lines.length);
  });
});

describe("textBoxHandleAt", () => {
  it("prefers a corner over the body, and the body over empty photo", () => {
    const box = { x: 40, y: 80, width: 160, height: 90 };
    assert.equal(textBoxHandleAt(box, 40, 80), "nw");
    assert.equal(textBoxHandleAt(box, 200, 170), "se");
    assert.equal(textBoxHandleAt(box, 120, 130), "body");
    assert.equal(textBoxHandleAt(box, 10, 10), null);
  });
});
