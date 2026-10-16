/**
 * Run: node --experimental-strip-types --test client/src/lib/mobileKeyboardScroll.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isKeyboardField, shouldScrollFieldIntoView } from "./mobileKeyboardScroll.ts";

describe("mobile keyboard scroll", () => {
  it("scrolls text fields and skips files, buttons, and non-elements", () => {
    assert.equal(isKeyboardField("INPUT", "email", false), true);
    assert.equal(isKeyboardField("INPUT", "password", false), true);
    assert.equal(isKeyboardField("TEXTAREA", null, false), true);
    assert.equal(isKeyboardField("SELECT", null, false), true);
    assert.equal(isKeyboardField("DIV", null, true), true);
    assert.equal(isKeyboardField("INPUT", "file", false), false);
    assert.equal(isKeyboardField("INPUT", "checkbox", false), false);
    assert.equal(isKeyboardField("BUTTON", "button", false), false);
    assert.equal(shouldScrollFieldIntoView(null, 412), false);
  });
});
