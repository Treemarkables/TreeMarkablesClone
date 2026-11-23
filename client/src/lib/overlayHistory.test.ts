/**
 * Run: node --experimental-strip-types --test client/src/lib/overlayHistory.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOverlayHistory, type OverlayHistory } from "./overlayHistory.ts";

function fakeHistory(): OverlayHistory & { back: () => void } {
  const states: unknown[] = [null];
  const listeners = new Set<() => void>();
  return {
    getState: () => states[states.length - 1],
    pushState: (state) => {
      states.push(state);
    },
    back: () => {
      if (states.length > 1) states.pop();
      for (const listener of [...listeners]) listener();
    },
    addPopListener: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

describe("overlay history", () => {
  it("hardware back closes only the top overlay", () => {
    const history = fakeHistory();
    const overlays = createOverlayHistory(history);
    let job = true;
    let photo = true;
    overlays.push(() => {
      job = false;
    });
    const releasePhoto = overlays.push(() => {
      photo = false;
      releasePhoto();
    });

    history.back();

    assert.equal(photo, false);
    assert.equal(job, true);
  });

  it("a second hardware back closes the overlay underneath", () => {
    const history = fakeHistory();
    const overlays = createOverlayHistory(history);
    let job = true;
    let photo = true;
    const releaseJob = overlays.push(() => {
      job = false;
      releaseJob();
    });
    const releasePhoto = overlays.push(() => {
      photo = false;
      releasePhoto();
    });

    history.back();
    history.back();

    assert.equal(photo, false);
    assert.equal(job, false);
  });

  it("the close button drops the photo entry and leaves the job card", () => {
    const history = fakeHistory();
    const overlays = createOverlayHistory(history);
    let job = true;
    let photo = true;
    overlays.push(() => {
      job = false;
    });
    const releasePhoto = overlays.push(() => {
      photo = false;
    });

    releasePhoto();

    assert.equal(photo, true, "button close is the parent's setState, not the back handler");
    assert.equal(job, true);
    assert.equal(
      (history.getState() as { inflowOverlay?: number } | null)?.inflowOverlay,
      1,
      "photo entry is gone; job entry remains",
    );
  });
});
