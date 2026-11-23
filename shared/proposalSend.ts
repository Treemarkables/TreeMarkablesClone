/**
 * One tap on Send must produce one email or one SMS.
 *
 * The counter matches `applyIncrement` in server/security/rateLimitStore.ts
 * (and the rate_limits UPSERT). A second claim inside the window is a
 * duplicate. Email and SMS are separate, so sending both still goes out once
 * each. A resend after the window is a real send.
 */

export const PROPOSAL_SEND_DEDUPE_MS = 30_000;

export type ProposalSendChannel = "email" | "sms";

export function proposalSendDedupeKey(
  proposalId: string,
  channel: ProposalSendChannel,
  recipient: string,
): string {
  const who = recipient.trim().toLowerCase().replace(/\s+/g, "");
  return `proposal-send:${proposalId}:${channel}:${who}`;
}

export function nextSendCount(
  existing: { count: number; resetAtMs: number } | undefined,
  nowMs: number,
  windowMs: number = PROPOSAL_SEND_DEDUPE_MS,
): { count: number; resetAtMs: number; send: boolean } {
  if (!existing || existing.resetAtMs <= nowMs) {
    return { count: 1, resetAtMs: nowMs + windowMs, send: true };
  }
  return { count: existing.count + 1, resetAtMs: existing.resetAtMs, send: false };
}

/** Synchronous single-flight flag. Set before the first await so a second tap cannot start. */
export function tryAcquireSend(busy: { current: boolean }): boolean {
  if (busy.current) return false;
  busy.current = true;
  return true;
}
