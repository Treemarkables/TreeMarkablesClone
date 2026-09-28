/**
 * Quote follow-up detection and draft copy.
 *
 * Pure functions: the hourly job (quoteFollowUpDetection) loads one tenant's
 * quotes, diary replies, and existing rows, then persists whatever this plans.
 * Nothing here sends a message.
 *
 * A follow-up is one row per quote and nudge step. Step 0 is the expiry
 * re-quote. Steps 3, 7 and 14 (or the tenant's own days) are check-ins.
 * Skipped steps are still recorded so a later run cannot draft them again.
 */

export const DEFAULT_NUDGE_DAYS = [3, 7, 14] as const;
export const EXPIRY_NUDGE_STEP = 0;
export const SENT_LOOKBACK_DAYS = 120;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpKind = "check_in" | "requote";
export type FollowUpChannel = "sms" | "email";
export type FollowUpStopReason = "accepted" | "declined" | "customer_reply";
