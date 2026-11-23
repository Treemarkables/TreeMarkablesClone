/**
 * Run: node --experimental-strip-types --test server/photoAnnotationStroke.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annotationMarkStrokePx,
  DEFAULT_ANNOTATION_STAGE_WIDTH,
} from "./photoAnnotationStroke.ts";

describe("annotationMarkStrokePx", () => {
  it("scales a screen-pixel stroke up to the photo", () => {
    // 4px on a 400px-wide stage, drawn over a 4000px-wide photo → 40px.
    assert.equal(annotationMarkStrokePx(4, 4000, 400), 40);
  });

  it("uses a phone-width stage when the editor didn't send one", () => {
    const scaled = annotationMarkStrokePx(4, DEFAULT_ANNOTATION_STAGE_WIDTH * 4);
    assert.equal(scaled, 16);
  });

  it("keeps a positive width for a zero stroke", () => {
    assert.equal(annotationMarkStrokePx(0, 1000, 400), 1);
  });
});
