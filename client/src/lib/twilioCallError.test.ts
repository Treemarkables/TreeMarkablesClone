import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTwilioError } from "./twilioCallError.ts";

describe("Twilio call error toast", () => {
  it("shows the 31005 code next to Connection error", () => {
    assert.equal(formatTwilioError("Connection error", "31005"), "Connection error (31005)");
    assert.equal(formatTwilioError("Connection error", 31005), "Connection error (31005)");
  });

  it("keeps a message that arrived without a code", () => {
    assert.equal(formatTwilioError("Connection error", ""), "Connection error");
    assert.equal(formatTwilioError("Connection error", "0"), "Connection error");
  });

  it("is empty when the call ended cleanly", () => {
    assert.equal(formatTwilioError("", ""), "");
    assert.equal(formatTwilioError(null, null), "");
  });
});
