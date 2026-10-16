/**
 * Run: node --experimental-strip-types --test client/src/components/jobPhotoViewer.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
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
