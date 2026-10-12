// Twilio Voice access tokens. The iOS SDK does not refresh these itself.
// Twilio's mobile best-practice is to re-register before the token expires;
// an expired token still lets a push through, then the signaling connection
// dies with error 31005 ("Connection error") and the caller is dropped.

export const VOICE_TOKEN_TTL_SECONDS = 3600;

// Refresh this long before expiry. 30 seconds (Twilio's latest-safe point)
// races a call that arrives on the boundary. Ten minutes leaves room for a
// suspended iOS timer and a slow token request.
export const VOICE_TOKEN_REFRESH_MARGIN_SECONDS = 10 * 60;

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 24 * 60 * 60 - 1;

export function clampVoiceTokenTtl(ttlSeconds: number | null | undefined): number {
  if (typeof ttlSeconds !== "number" || !Number.isFinite(ttlSeconds)) {
    return VOICE_TOKEN_TTL_SECONDS;
  }
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(ttlSeconds)));
}

/** Milliseconds to wait after a token is issued before fetching the next one. */
export function voiceTokenRefreshDelayMs(
  ttlSeconds: number = VOICE_TOKEN_TTL_SECONDS,
): number {
  const ttl = clampVoiceTokenTtl(ttlSeconds);
  const margin = Math.min(VOICE_TOKEN_REFRESH_MARGIN_SECONDS, Math.floor(ttl / 5));
  return Math.max(15_000, (ttl - margin) * 1000);
}

/** True once the token is inside the refresh window, or was never issued. */
export function voiceTokenIsDue(
  issuedAtMs: number,
  ttlSeconds: number,
  nowMs: number,
): boolean {
  if (!issuedAtMs) return true;
  return nowMs >= issuedAtMs + voiceTokenRefreshDelayMs(ttlSeconds);
}
