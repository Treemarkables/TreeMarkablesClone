import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_TOKEN_TTL_SECONDS,
  voiceTokenIsDue,
  voiceTokenRefreshDelayMs,
} from "./voiceToken.ts";

describe("voice token refresh", () => {
  it("refreshes ten minutes before the one-hour token expires", () => {
    const delay = voiceTokenRefreshDelayMs(VOICE_TOKEN_TTL_SECONDS);
    assert.equal(delay, 50 * 60 * 1000);
  });

  it("is not due at 49 minutes and is due at 50", () => {
    const issued = Date.parse("2026-10-11T20:11:20.000Z");
    const ttl = VOICE_TOKEN_TTL_SECONDS;
    assert.equal(voiceTokenIsDue(issued, ttl, issued + 49 * 60 * 1000), false);
    assert.equal(voiceTokenIsDue(issued, ttl, issued + 50 * 60 * 1000), true);
  });

  it("treats a missing issue time as due, so a foreground wake re-registers", () => {
    assert.equal(voiceTokenIsDue(0, VOICE_TOKEN_TTL_SECONDS, Date.now()), true);
  });
});
