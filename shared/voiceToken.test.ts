import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_TOKEN_TTL_SECONDS,
  voiceTokenIsDue,
  voiceTokenRefreshDelayMs,
} from "./voiceToken.ts";

describe("voice token refresh", () => {
  it("lasts a day, which is Twilio's maximum, and refreshes ten minutes early", () => {
    assert.equal(VOICE_TOKEN_TTL_SECONDS, 24 * 60 * 60 - 1);
    const delay = voiceTokenRefreshDelayMs(VOICE_TOKEN_TTL_SECONDS);
    assert.equal(delay, (VOICE_TOKEN_TTL_SECONDS - 10 * 60) * 1000);
  });

  it("is not due a minute before the refresh point and is due at it", () => {
    const issued = Date.parse("2026-10-11T20:11:20.000Z");
    const ttl = VOICE_TOKEN_TTL_SECONDS;
    const refreshAt = voiceTokenRefreshDelayMs(ttl);
    assert.equal(voiceTokenIsDue(issued, ttl, issued + refreshAt - 60_000), false);
    assert.equal(voiceTokenIsDue(issued, ttl, issued + refreshAt), true);
  });

  it("treats a missing issue time as due, so a foreground wake re-registers", () => {
    assert.equal(voiceTokenIsDue(0, VOICE_TOKEN_TTL_SECONDS, Date.now()), true);
  });
});
