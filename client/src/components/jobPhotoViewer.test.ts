/**
 * Run: node --experimental-strip-types --test client/src/components/jobPhotoViewer.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clampPan,
  pinchScale,
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
});

describe("job photo viewer layout contract", () => {
  const viewer = readFileSync(new URL("./JobPhotoViewer.tsx", import.meta.url), "utf8");
  const diary = readFileSync(new URL("./JobDiarySection.tsx", import.meta.url), "utf8");

  it("fits the bitmap in a definite box and pins Close above the zoom", () => {
    assert.match(viewer, /object-contain/);
    assert.match(viewer, /absolute inset-0 h-full w-full/);
    assert.match(viewer, /position:\s*"fixed"|className="[^"]*fixed/);
    assert.match(viewer, /button-close-photo/);
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
});
