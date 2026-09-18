/**
 * Encrypt TOTP secrets at rest and hash recovery codes.
 * Key material is derived from SESSION_SECRET so we do not need a new env var.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

function sessionSecret(): string {
  return process.env.SESSION_SECRET || "treemarkables-dev-secret-change-in-production";
}

function aesKey(): Buffer {
  return createHash("sha256").update(`inflow-mfa-totp-v1:${sessionSecret()}`).digest();
}

function recoveryKey(): Buffer {
  return createHash("sha256").update(`inflow-mfa-recovery-v1:${sessionSecret()}`).digest();
}

export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptTotpSecret(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported MFA secret format");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const enc = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCode(): string {
  // 8 hex chars grouped ABCD-EFGH. Case-insensitive when entered.
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateRecoveryCode());
  }
  return Array.from(codes);
}

export function normalizeRecoveryCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const cleaned = code.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (cleaned.length !== 8) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) {
    throw new Error("Invalid recovery code");
  }
  return createHmac("sha256", recoveryKey()).update(normalized).digest("hex");
}

export function recoveryHashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
