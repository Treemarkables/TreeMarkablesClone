import type { MfaEnforcement } from "@shared/schema";

export type MfaGate = "none" | "challenge" | "enroll";
export type PendingMfaPurpose = "challenge" | "enroll";

/** Pending MFA login cookies are short; the 30-day field session is restored after verify. */
export const MFA_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Single login gate. Enrolled users are always challenged. Unenrolled users
 * pass through unless the org has flipped mfa_enforcement to `required`
 * (enforce-later — default is optional so field login does not change).
 */
export function resolveMfaGate(
  enabled: boolean,
  enforcement: MfaEnforcement,
): "none" | "challenge" | "enroll" {
  if (enabled) return "challenge";
  if (enforcement === "required") return "enroll";
  return "none";
}
