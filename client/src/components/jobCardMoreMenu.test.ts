/**
 * Run: node --experimental-strip-types --test client/src/components/jobCardMoreMenu.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moreMenuPress } from "./jobCardMoreMenu.ts";

describe("desktop job card More menu press", () => {
  it("a mouse press on a closed menu opens from the click, not pointerdown", () => {
    const press = moreMenuPress("mouse", false);
    assert.equal(press.preventRadixToggle, true);
    assert.equal(press.toggleOnClick, true);
  });

  it("a mouse press on an open menu does not toggle it back open on click", () => {
    const press = moreMenuPress("mouse", true);
    assert.equal(press.preventRadixToggle, true);
    assert.equal(press.toggleOnClick, false);
  });

  it("a pen press follows the mouse path", () => {
    assert.deepEqual(moreMenuPress("pen", false), moreMenuPress("mouse", false));
  });

  it("a touch press is left to Radix so the tap is not swallowed", () => {
    assert.deepEqual(moreMenuPress("touch", false), {
      preventRadixToggle: false,
      toggleOnClick: false,
    });
    assert.deepEqual(moreMenuPress("touch", true), {
      preventRadixToggle: false,
      toggleOnClick: false,
    });
  });
});
