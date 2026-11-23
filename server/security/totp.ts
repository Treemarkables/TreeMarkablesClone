/**
 * RFC 6238 TOTP (SHA-1, 30s, 6 digits) using Node crypto.
 *
 * No new npm dependency (package.json is off-limits). Compatible with
 * Google Authenticator / 1Password / Authy via a standard otpauth:// URI.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1; // ±30s clock skew
export const TOTP_SECRET_BYTES = 20;

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) {
      throw new Error("Invalid base32 secret");
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(TOTP_SECRET_BYTES));
}

export function totpCounter(nowMs = Date.now(), period = TOTP_PERIOD_SECONDS): number {
  return Math.floor(nowMs / 1000 / period);
}

export function hotp(secretBase32: string, counter: number, digits = TOTP_DIGITS): string {
  const key = decodeBase32(secretBase32);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter. JS numbers are safe for TOTP counters.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = bin % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

export function generateTotp(
  secretBase32: string,
  nowMs = Date.now(),
  period = TOTP_PERIOD_SECONDS,
  digits = TOTP_DIGITS,
): string {
  return hotp(secretBase32, totpCounter(nowMs, period), digits);
}

function codesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function normalizeTotpCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return null;
  return trimmed;
}

export interface TotpVerifyResult {
  valid: boolean;
  counter?: number;
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  opts?: { nowMs?: number; window?: number; lastUsedCounter?: number | null },
): TotpVerifyResult {
  const normalized = normalizeTotpCode(code);
  if (!normalized) return { valid: false };

  const nowMs = opts?.nowMs ?? Date.now();
  const window = opts?.window ?? TOTP_WINDOW;
  const lastUsed = opts?.lastUsedCounter;
  const centre = totpCounter(nowMs);

  for (let delta = -window; delta <= window; delta++) {
    const counter = centre + delta;
    if (lastUsed != null && counter === lastUsed) continue;
    const expected = hotp(secretBase32, counter);
    if (codesEqual(expected, normalized)) {
      return { valid: true, counter };
    }
  }
  return { valid: false };
}

export function buildOtpauthUri(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer || "Inflow";
  const account = opts.accountName || "user";
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
