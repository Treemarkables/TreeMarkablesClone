/**
 * Run: node --experimental-strip-types --test client/src/lib/openExternalUrl.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldAssignInPlace } from "./openExternalUrl.ts";

const page = "https://app.inflowapp.co.nz/dispatch";

describe("shouldAssignInPlace", () => {
  it("sends maps, tel, and mailto through the WebView on Android", () => {
    assert.equal(
      shouldAssignInPlace("https://www.google.com/maps/search/?api=1&query=1", page, true),
      true,
    );
    assert.equal(shouldAssignInPlace("tel:+6421123456", page, true), true);
    assert.equal(shouldAssignInPlace("mailto:crew@example.co.nz", page, true), true);
  });

  it("leaves same-origin and desktop browsing alone", () => {
    assert.equal(shouldAssignInPlace("https://app.inflowapp.co.nz/api/invoices/1/pdf", page, true), false);
    assert.equal(shouldAssignInPlace("https://www.google.com/maps/search/?api=1&query=1", page, false), false);
    assert.equal(shouldAssignInPlace("tel:+6421123456", page, false), false);
  });
});
