import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  decodeBase32,
  encodeBase32,
  generateTotp,
  generateTotpSecret,
  hotp,
  verifyTotp,
  buildOtpauthUri,
  normalizeTotpCode,
} from "./totp.ts";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashesEqual,
} from "./mfaCrypto.ts";
import { resolveMfaGate, MFA_PENDING_MAX_AGE_MS } from "./mfaGate.ts";
import { summarizeUserAgent, toSessionListItem } from "./sessionHygiene.ts";
import {
  checkMfaThrottle,
  clearMfaThrottle,
  MFA_MAX_PER_IDENTIFIER,
} from "./loginThrottle.ts";
import {
  createMemoryRateLimitBackend,
  setRateLimitBackendForTests,
} from "./rateLimitStore.ts";

describe("TOTP (RFC 6238 SHA-1)", () => {
  // RFC 6238 Appendix B — secret is the ASCII string "12345678901234567890".
  const rfcSecret = encodeBase32(Buffer.from("12345678901234567890"));

  it("round-trips base32 without padding", () => {
    const raw = Buffer.from("hello-mfa-secret!!");
    assert.equal(decodeBase32(encodeBase32(raw)).toString("utf8").startsWith("hello-mfa-secret"), true);
  });

  it("matches RFC 6238 8-digit vectors", () => {
    assert.equal(generateTotp(rfcSecret, 59 * 1000, 30, 8), "94287082");
    assert.equal(generateTotp(rfcSecret, 1111111109 * 1000, 30, 8), "07081804");
    assert.equal(generateTotp(rfcSecret, 1234567890 * 1000, 30, 8), "89005924");
  });

  it("accepts the current 6-digit code and ±1 window", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_030_000; // aligned near a step boundary
    const current = generateTotp(secret, now);
    assert.equal(verifyTotp(secret, current, { nowMs: now }).valid, true);
    const previous = generateTotp(secret, now - 30_000);
    assert.equal(verifyTotp(secret, previous, { nowMs: now }).valid, true);
    const next = generateTotp(secret, now + 30_000);
    assert.equal(verifyTotp(secret, next, { nowMs: now }).valid, true);
    const far = generateTotp(secret, now + 120_000);
    assert.equal(verifyTotp(secret, far, { nowMs: now }).valid, false);
  });

  it("rejects a code already used in this window (replay)", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = generateTotp(secret, now);
    const first = verifyTotp(secret, code, { nowMs: now });
    assert.equal(first.valid, true);
    const replay = verifyTotp(secret, code, { nowMs: now, lastUsedCounter: first.counter });
    assert.equal(replay.valid, false);
  });

  it("rejects non-6-digit input", () => {
    assert.equal(normalizeTotpCode("12 34"), null);
    assert.equal(normalizeTotpCode("abcdef"), null);
    assert.equal(normalizeTotpCode("123456"), "123456");
    assert.equal(hotp(rfcSecret, 1).length, 6);
  });

  it("builds an otpauth URI authenticators can import", () => {
    const uri = buildOtpauthUri({
      secret: "JBSWY3DPEHPK3PXP",
      accountName: "crew@example.com",
      issuer: "Inflow",
    });
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
    assert.match(uri, /issuer=Inflow/);
  });
});

describe("MFA crypto", () => {
  it("encrypts and decrypts a TOTP secret", () => {
    const secret = generateTotpSecret();
    const cipher = encryptTotpSecret(secret);
    assert.notEqual(cipher, secret);
    assert.equal(decryptTotpSecret(cipher), secret);
  });

  it("hashes recovery codes case-insensitively", () => {
    const [code] = generateRecoveryCodes(1);
    const hashed = hashRecoveryCode(code.toLowerCase());
    assert.equal(recoveryHashesEqual(hashed, hashRecoveryCode(code.toUpperCase())), true);
    assert.equal(normalizeRecoveryCode("short"), null);
    assert.equal(normalizeRecoveryCode("not-a-hex-code!!"), null);
    assert.ok(normalizeRecoveryCode(code));
  });
});

describe("MFA login gate (field users stay open)", () => {
  it("does not challenge unenrolled users when enforcement is optional", () => {
    assert.equal(resolveMfaGate(false, "optional"), "none");
  });

  it("always challenges enrolled users", () => {
    assert.equal(resolveMfaGate(true, "optional"), "challenge");
    assert.equal(resolveMfaGate(true, "required"), "challenge");
  });

  it("can require enroll later without a rewrite", () => {
    assert.equal(resolveMfaGate(false, "required"), "enroll");
  });
});

describe("session hygiene helpers", () => {
  it("keeps pending MFA cookies short without changing 30-day field sessions", () => {
    assert.equal(MFA_PENDING_MAX_AGE_MS, 10 * 60 * 1000);
    const expire = new Date("2026-10-18T00:00:00.000Z");
    const item = toSessionListItem(
      {
        sid: "abc",
        sess: {
          employeeId: "emp-1",
          sessionCreatedAt: "2026-09-18T00:00:00.000Z",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/129.0.0.0",
          cookie: { originalMaxAge: 1000 * 60 * 60 * 24 * 30 },
        },
        expire,
      },
      "abc",
    );
    assert.equal(item.current, true);
    assert.equal(item.deviceLabel, "Chrome on iPhone");
    assert.equal(item.lastActiveAt, "2026-09-18T00:00:00.000Z");
  });

  it("labels unknown agents without throwing", () => {
    assert.equal(summarizeUserAgent(""), "Unknown device");
    assert.equal(summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0"), "Chrome on Desktop");
  });
});

describe("MFA attempt throttle", () => {
  beforeEach(() => {
    setRateLimitBackendForTests(createMemoryRateLimitBackend());
  });

  it("allows attempts up to the identifier cap, then 429s", async () => {
    for (let i = 0; i < MFA_MAX_PER_IDENTIFIER; i++) {
      const result = await checkMfaThrottle({ ip: "1.1.1.1", employeeId: "emp-1" });
      assert.equal(result.allowed, true, `attempt ${i + 1} should be allowed`);
    }
    const blocked = await checkMfaThrottle({ ip: "1.1.1.1", employeeId: "emp-1" });
    assert.equal(blocked.allowed, false);
  });

  it("clears the identifier after a successful verify", async () => {
    await checkMfaThrottle({ ip: "10.0.0.8", employeeId: "emp-field" });
    await clearMfaThrottle("emp-field");
    for (let i = 0; i < MFA_MAX_PER_IDENTIFIER; i++) {
      const result = await checkMfaThrottle({ ip: "10.0.0.8", employeeId: "emp-field" });
      assert.equal(result.allowed, true);
    }
  });
});
