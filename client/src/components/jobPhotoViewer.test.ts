/**
 * Run: node --experimental-strip-types --test client/src/components/jobPhotoViewer.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adjacentPhotoIndex,
  clampPan,
  dismissBackdropOpacity,
  dismissOffset,
  isDismissDrag,
  pinchScale,
  shouldDismissSwipe,
  swipeDirection,
} from "./jobPhotoViewer.ts";

describe("job photo pinch zoom", () => {
  it("fits at scale 1 and clamps a pinch between 1 and 5", () => {
    assert.equal(pinchScale(1, 100, 250), 2.5);
    assert.equal(pinchScale(2, 100, 20), 1);
    assert.equal(pinchScale(4, 100, 400), 5);
  });

  it("does not pan a fitted photo off the stage", () => {
    assert.deepEqual(clampPan({ x: 40, y: 20 }, 1, { w: 400, h: 800 }), { x: 0, y: 0 });
    assert.deepEqual(clampPan({ x: 500, y: -500 }, 2, { w: 400, h: 800 }), { x: 200, y: -400 });
  });

  it("steps to the next or previous photo and stops at the ends", () => {
    assert.equal(adjacentPhotoIndex(0, 13, "prev"), null);
    assert.equal(adjacentPhotoIndex(0, 13, "next"), 1);
    assert.equal(adjacentPhotoIndex(4, 13, "next"), 5);
    assert.equal(adjacentPhotoIndex(4, 13, "prev"), 3);
    assert.equal(adjacentPhotoIndex(12, 13, "next"), null);
    assert.equal(adjacentPhotoIndex(12, 13, "prev"), 11);
    assert.equal(adjacentPhotoIndex(0, 1, "next"), null);
    assert.equal(adjacentPhotoIndex(0, 1, "prev"), null);
    assert.equal(adjacentPhotoIndex(-1, 13, "next"), null);
    assert.equal(adjacentPhotoIndex(13, 13, "prev"), null);
  });

  it("swipes to the next photo only when the photo is fitted", () => {
    assert.equal(swipeDirection(-80, 10, 1), "next");
    assert.equal(swipeDirection(80, 10, 1), "prev");
    assert.equal(swipeDirection(-80, 10, 2), null);
    assert.equal(swipeDirection(-20, 10, 1), null);
    assert.equal(swipeDirection(-40, 80, 1), null);
  });

  it("dismisses a fitted photo on a firm downward swipe and pans when zoomed", () => {
    assert.equal(isDismissDrag(10, 80, 1), true);
    assert.equal(isDismissDrag(-80, 10, 1), false);
    assert.equal(isDismissDrag(0, 80, 2), false);
    assert.equal(dismissOffset(90, 1), 90);
    assert.equal(dismissOffset(-20, 1), 0);
    assert.equal(dismissOffset(90, 2), 0);
    assert.equal(shouldDismissSwipe(120, 800, 1), true);
    assert.equal(shouldDismissSwipe(70, 50, 1), true);
    assert.equal(shouldDismissSwipe(70, 400, 1), false);
    assert.equal(shouldDismissSwipe(140, 900, 2), false);
    assert.ok(dismissBackdropOpacity(0) === 1);
    assert.ok(dismissBackdropOpacity(180) < 1);
    assert.ok(dismissBackdropOpacity(180) > dismissBackdropOpacity(300));
  });
});

describe("job photo viewer layout contract", () => {
  const viewer = readFileSync(new URL("./JobPhotoViewer.tsx", import.meta.url), "utf8");
  const diary = readFileSync(new URL("./JobDiarySection.tsx", import.meta.url), "utf8");
  const library = readFileSync(new URL("../pages/Library.tsx", import.meta.url), "utf8");

  it("fits the bitmap in a definite box and pins Close above the zoom", () => {
    assert.match(viewer, /object-contain/);
    assert.match(viewer, /absolute inset-0 h-full w-full/);
    assert.match(viewer, /position:\s*"fixed"|className="[^"]*fixed/);
    assert.match(viewer, /button-close-photo/);
    assert.match(viewer, /minWidth:\s*56/);
    assert.match(viewer, /minHeight:\s*56/);
    assert.match(viewer, /zIndex:\s*100/);
    assert.match(viewer, /text-photo-count/);
    assert.match(viewer, /safe-area-inset-left/);
    assert.match(viewer, /shouldDismissSwipe/);
    assert.match(viewer, /translateY/);
    assert.match(viewer, /env\(safe-area-inset-top\)/);
    assert.match(viewer, /env\(safe-area-inset-right\)/);
    assert.match(viewer, /useOverlayHistory/);
    assert.match(viewer, /touchAction:\s*"none"/);
    assert.doesNotMatch(viewer, /max-h-full/);
  });

  it("steps with edge arrows, arrow keys, and a horizontal swipe, and does not wrap", () => {
    assert.match(viewer, /aria-label=\{label\}/);
    assert.match(viewer, /label="Previous photo"/);
    assert.match(viewer, /label="Next photo"/);
    assert.match(viewer, /button-previous-photo/);
    assert.match(viewer, /button-next-photo/);
    assert.match(viewer, /adjacentPhotoIndex/);
    assert.match(viewer, /event\.key === "ArrowRight"/);
    assert.match(viewer, /event\.key !== "ArrowRight" && event\.key !== "ArrowLeft"/);
    assert.match(viewer, /event\.key === "Escape"/);
    assert.match(viewer, /swipeDirection/);
    assert.match(viewer, /top: "50%"/);
    assert.match(viewer, /translateY\(-50%\)/);
    assert.match(viewer, /env\(safe-area-inset-left\) \+ 12px/);
    assert.match(viewer, /env\(safe-area-inset-right\) \+ 12px/);
    assert.match(viewer, /minWidth: 56/);
    assert.match(viewer, /minHeight: 56/);
    assert.match(viewer, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
    assert.match(viewer, /event\.stopPropagation\(\)/);
    assert.match(viewer, /try \{[\s\S]*?setPointerCapture\(event\.pointerId\)/);
    // The arrows are siblings of Close, not children of the gesture stage,
    // so a tap is not captured as a swipe or a dismiss.
    const stageAt = viewer.indexOf("onPointerDown={onPointerDown}");
    const prevAt = viewer.indexOf('testId="button-previous-photo"');
    const nextAt = viewer.indexOf('testId="button-next-photo"');
    const closeAt = viewer.indexOf('data-testid="button-close-photo"');
    assert.ok(stageAt > 0 && prevAt > stageAt && nextAt > prevAt && closeAt > nextAt);
    assert.doesNotMatch(viewer, /Math\.min\(photos\.length - 1/);
    assert.doesNotMatch(viewer, /Math\.max\(0, index - 1\)/);
  });

  it("job diary opens this viewer instead of the centered dialog", () => {
    assert.match(diary, /<JobPhotoViewer/);
    assert.doesNotMatch(diary, /DialogTitle>Job Photos/);
    assert.match(diary, /absolute inset-0 w-full h-full object-cover/);
  });

  it("library before/after shots open this viewer instead of the raw image", () => {
    assert.match(library, /<JobPhotoViewer/);
    assert.match(library, /Before \/ After/);
    assert.match(library, /absolute inset-0 h-full w-full object-cover/);
    assert.doesNotMatch(library, /target="_blank"/);
    assert.doesNotMatch(library, /href=\{item\.url\}/);
  });
});
