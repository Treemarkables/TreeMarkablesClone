import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSignupPrefill } from "./signupPrefill.ts";

describe("readSignupPrefill", () => {
  it("reads the fields the commercial site sends", () => {
    const prefill = readSignupPrefill(
      "?businessName=Sustainable+Scapes+Limited&firstName=Nigel&lastName=Abercrombie&email=nigel%40sustainablescapes.co.nz&plan=crew",
    );
    assert.equal(prefill.businessName, "Sustainable Scapes Limited");
    assert.equal(prefill.firstName, "Nigel");
    assert.equal(prefill.lastName, "Abercrombie");
    assert.equal(prefill.email, "nigel@sustainablescapes.co.nz");
    assert.equal(prefill.planKey, "crew");
  });

  it("falls back to freemium when plan is missing or unknown", () => {
    assert.equal(readSignupPrefill("").planKey, "freemium");
    assert.equal(readSignupPrefill("?plan=owner").planKey, "freemium");
  });
});
