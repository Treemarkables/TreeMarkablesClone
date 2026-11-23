/**
 * Owner-connection MFA persistence. Login is an owner-path (no tenant GUC), so
 * all MFA reads/writes go through ownerDb with an explicit employee/business
 * filter rather than relying on RLS.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Employee, MfaEnforcement } from "@shared/schema";
import { ownerDb } from "../db";
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode, recoveryHashesEqual } from "./mfaCrypto";
import { verifyTotp } from "./totp";
import { resolveMfaGate } from "./mfaGate";

export { resolveMfaGate };

export async function getMfaEnforcement(businessId: string | null | undefined): Promise<MfaEnforcement> {
  if (!businessId) return "optional";
  const [row] = await ownerDb
    .select({ mfaEnforcement: schema.businessSettings.mfaEnforcement })
    .from(schema.businessSettings)
    .where(eq(schema.businessSettings.businessId, businessId))
    .limit(1);
  return row?.mfaEnforcement === "required" ? "required" : "optional";
}

export async function getMfaRow(employeeId: string): Promise<schema.EmployeeMfa | undefined> {
  const [row] = await ownerDb
    .select()
    .from(schema.employeeMfa)
    .where(eq(schema.employeeMfa.employeeId, employeeId))
    .limit(1);
  return row || undefined;
}

export async function mfaLoginGate(
  employee: Pick<Employee, "id" | "businessId">,
): Promise<"none" | "challenge" | "enroll"> {
  const row = await getMfaRow(employee.id);
  const enforcement = await getMfaEnforcement(employee.businessId);
  return resolveMfaGate(Boolean(row?.enabled), enforcement);
}

export async function remainingRecoveryCodeCount(employeeId: string): Promise<number> {
  const [row] = await ownerDb
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.employeeMfaRecoveryCodes)
    .where(
      and(
        eq(schema.employeeMfaRecoveryCodes.employeeId, employeeId),
        isNull(schema.employeeMfaRecoveryCodes.usedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function enableMfa(opts: {
  employeeId: string;
  businessId: string | null | undefined;
  totpSecret: string;
}): Promise<string[]> {
  const ciphertext = encryptTotpSecret(opts.totpSecret);
  const now = new Date();
  await ownerDb
    .insert(schema.employeeMfa)
    .values({
      employeeId: opts.employeeId,
      businessId: opts.businessId ?? null,
      totpSecretCiphertext: ciphertext,
      enabled: true,
      enrolledAt: now,
      lastVerifiedAt: now,
      lastUsedCounter: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.employeeMfa.employeeId,
      set: {
        totpSecretCiphertext: ciphertext,
        enabled: true,
        enrolledAt: now,
        lastVerifiedAt: now,
        lastUsedCounter: null,
        businessId: opts.businessId ?? null,
        updatedAt: now,
      },
    });

  const codes = generateRecoveryCodes();
  await ownerDb
    .delete(schema.employeeMfaRecoveryCodes)
    .where(eq(schema.employeeMfaRecoveryCodes.employeeId, opts.employeeId));
  if (codes.length > 0) {
    await ownerDb.insert(schema.employeeMfaRecoveryCodes).values(
      codes.map((code) => ({
        employeeId: opts.employeeId,
        businessId: opts.businessId ?? null,
        codeHash: hashRecoveryCode(code),
      })),
    );
  }
  return codes;
}

export async function disableMfa(employeeId: string): Promise<void> {
  await ownerDb.delete(schema.employeeMfa).where(eq(schema.employeeMfa.employeeId, employeeId));
}

export async function replaceRecoveryCodes(opts: {
  employeeId: string;
  businessId: string | null | undefined;
}): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await ownerDb
    .delete(schema.employeeMfaRecoveryCodes)
    .where(eq(schema.employeeMfaRecoveryCodes.employeeId, opts.employeeId));
  if (codes.length > 0) {
    await ownerDb.insert(schema.employeeMfaRecoveryCodes).values(
      codes.map((code) => ({
        employeeId: opts.employeeId,
        businessId: opts.businessId ?? null,
        codeHash: hashRecoveryCode(code),
      })),
    );
  }
  return codes;
}

export async function verifyStoredTotp(
  employeeId: string,
  code: string,
): Promise<{ valid: boolean }> {
  const row = await getMfaRow(employeeId);
  if (!row?.enabled) return { valid: false };
  let secret: string;
  try {
    secret = decryptTotpSecret(row.totpSecretCiphertext);
  } catch {
    return { valid: false };
  }
  const result = verifyTotp(secret, code, { lastUsedCounter: row.lastUsedCounter });
  if (!result.valid || result.counter == null) return { valid: false };
  await ownerDb
    .update(schema.employeeMfa)
    .set({
      lastUsedCounter: result.counter,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.employeeMfa.employeeId, employeeId));
  return { valid: true };
}

export async function consumeRecoveryCode(
  employeeId: string,
  code: string,
): Promise<{ valid: boolean }> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return { valid: false };
  const row = await getMfaRow(employeeId);
  if (!row?.enabled) return { valid: false };

  const unused = await ownerDb
    .select()
    .from(schema.employeeMfaRecoveryCodes)
    .where(
      and(
        eq(schema.employeeMfaRecoveryCodes.employeeId, employeeId),
        isNull(schema.employeeMfaRecoveryCodes.usedAt),
      ),
    );

  const presentedHash = hashRecoveryCode(normalized);
  const match = unused.find((c) => recoveryHashesEqual(c.codeHash, presentedHash));
  if (!match) return { valid: false };

  await ownerDb
    .update(schema.employeeMfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(schema.employeeMfaRecoveryCodes.id, match.id));
  await ownerDb
    .update(schema.employeeMfa)
    .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.employeeMfa.employeeId, employeeId));
  return { valid: true };
}
