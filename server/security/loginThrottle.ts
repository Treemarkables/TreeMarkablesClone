/**
 * Login throttle — dual-key (per-IP + per-identifier), shared across instances.
 *
 * Limits match the 2026-07-14 audit L3 values (field-user friendly):
 *   30 attempts / IP / 15 min
 *   10 attempts / identifier / 15 min
 * A successful login clears the identifier key so one typo does not keep a
 * crew member locked after they remember the password. The IP key is not
 * cleared (spray-across-accounts still counts).
 *
 * Not applied via the public-write limiter — login keeps this dedicated
 * throttle so we do not double-limit the field login path.
 */
import { incrementRateLimit, resetRateLimitKey } from "./rateLimitStore";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_IP = 30;
export const LOGIN_MAX_PER_IDENTIFIER = 10;

export async function checkLoginThrottle(opts: {
  ip: string;
  identifier: string;
}): Promise<{ allowed: boolean }> {
  const ipResult = await incrementRateLimit(`login:ip:${opts.ip}`, LOGIN_WINDOW_MS);
  if (ipResult.count > LOGIN_MAX_PER_IP) {
    return { allowed: false };
  }
  if (opts.identifier) {
    const idResult = await incrementRateLimit(
      `login:id:${opts.identifier}`,
      LOGIN_WINDOW_MS,
    );
    if (idResult.count > LOGIN_MAX_PER_IDENTIFIER) {
      return { allowed: false };
    }
  }
  return { allowed: true };
}

export async function clearLoginIdentifierThrottle(identifier: string): Promise<void> {
  if (!identifier) return;
  await resetRateLimitKey(`login:id:${identifier}`);
}

// MFA verify/recovery is a separate window so a typo'd authenticator code does
// not burn the password-login identifier budget (and vice versa).
export const MFA_MAX_PER_IDENTIFIER = 10;

export async function checkMfaThrottle(opts: {
  ip: string;
  employeeId: string;
}): Promise<{ allowed: boolean }> {
  const ipResult = await incrementRateLimit(`mfa:ip:${opts.ip}`, LOGIN_WINDOW_MS);
  if (ipResult.count > LOGIN_MAX_PER_IP) {
    return { allowed: false };
  }
  if (opts.employeeId) {
    const idResult = await incrementRateLimit(
      `mfa:id:${opts.employeeId}`,
      LOGIN_WINDOW_MS,
    );
    if (idResult.count > MFA_MAX_PER_IDENTIFIER) {
      return { allowed: false };
    }
  }
  return { allowed: true };
}

export async function clearMfaThrottle(employeeId: string): Promise<void> {
  if (!employeeId) return;
  await resetRateLimitKey(`mfa:id:${employeeId}`);
}
