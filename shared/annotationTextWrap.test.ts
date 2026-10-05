/**
 * Run: node --experimental-strip-types --test shared/annotationTextWrap.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annotationTextFrame,
  estimateAnnotationTextWidth,
  wrapAnnotationText,
} from "./annotationTextWrap.ts";

describe("wrapAnnotationText", () => {
  it("keeps a short label on one line", () => {
    const lines = wrapAnnotationText("Remove", 400, 24);
    assert.deepEqual(lines, ["Remove"]);
  });

  it("wraps a sentence onto the next line instead of one long run", () => {
    const fontSize = 20;
    const maxWidth = 180;
    const lines = wrapAnnotationText(
      "Large oak on the fence line needs to come down before Friday",
      maxWidth,
      fontSize,
    );
    assert.ok(lines.length > 1, `expected wrap, got ${JSON.stringify(lines)}`);
    for (const line of lines) {
      assert.ok(
        estimateAnnotationTextWidth(line, fontSize) <= maxWidth + 0.5,
        `line overflowed: ${line}`,
      );
    }
    assert.equal(lines.join(" "), "Large oak on the fence line needs to come down before Friday");
  });

  it("breaks a single long word so it cannot run off the edge", () => {
    const fontSize = 16;
    const maxWidth = 80;
    const lines = wrapAnnotationText("Supercalifragilistic", maxWidth, fontSize);
    assert.ok(lines.length > 1);
    for (const line of lines) {
      assert.ok(estimateAnnotationTextWidth(line, fontSize) <= maxWidth + fontSize);
    }
    assert.equal(lines.join(""), "Supercalifragilistic");
  });

  it("keeps blank lines from an explicit newline", () => {
    const lines = wrapAnnotationText("First\n\nSecond", 400, 20);
    assert.deepEqual(lines, ["First", "", "Second"]);
  });
});

describe("annotationTextFrame", () => {
  it("leaves a short mark where it was placed", () => {
    const frame = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.2,
      fontSizeNorm: 0.04,
      text: "Oak",
      imageWidthPx: 1000,
      imageHeightPx: 800,
    });
    assert.equal(frame.xPx, 100);
    assert.equal(frame.yPx, 200);
    assert.deepEqual(frame.lines, ["Oak"]);
    assert.ok(frame.xPx + frame.widthPx <= 1000);
  });

  it("wraps long text and keeps every line inside the photo", () => {
    const frame = annotationTextFrame({
      xNorm: 0.05,
      yNorm: 0.1,
      fontSizeNorm: 0.04,
      text: "Power lines through the canopy, do not climb, use the bucket truck from the drive",
      imageWidthPx: 800,
      imageHeightPx: 1200,
    });
    assert.ok(frame.lines.length > 1);
    assert.ok(frame.xPx >= 0);
    assert.ok(frame.xPx + frame.widthPx <= 800);
    const bottom = frame.yPx + frame.lines.length * frame.lineHeightPx;
    assert.ok(bottom <= 1200, `text ran off the bottom: ${bottom}`);
  });

  it("pulls a mark on the right edge back inside the photo", () => {
    const frame = annotationTextFrame({
      xNorm: 0.97,
      yNorm: 0.4,
      fontSizeNorm: 0.04,
      text: "Hazard limb over the roof",
      imageWidthPx: 1000,
      imageHeightPx: 1000,
    });
    assert.ok(frame.xPx + frame.widthPx <= 1000);
    assert.ok(frame.lines.length > 1);
    assert.ok(frame.yPx + frame.lines.length * frame.lineHeightPx <= 1000);
  });

  it("shifts a bottom-placed paragraph up so the lines stay on the photo", () => {
    const frame = annotationTextFrame({
      xNorm: 0.1,
      yNorm: 0.92,
      fontSizeNorm: 0.04,
      text: "This note is long enough that it has to wrap and would otherwise leave the photo",
      imageWidthPx: 1000,
      imageHeightPx: 1000,
    });
    assert.ok(frame.lines.length > 1);
    const bottom = frame.yPx + frame.lines.length * frame.lineHeightPx;
    assert.ok(bottom <= 1000, `ran off bottom: ${bottom}`);
    assert.ok(frame.yPx < 920);
  });
});
