/**
 * Wave 3: write auth events to the existing `audit_log` table.
 *
 * Login is an owner-path (no tenant GUC), so inserts go through ownerDb with
 * an explicit businessId / employee id — same pattern as MFA (mfaService.ts).
 * Fail-open: a missing table/column after a non-fatal boot migration must not
 * lock field login. Never store passwords, TOTP secrets, or recovery codes.
 */
import * as schema from "@shared/schema";

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "login.success",
  LOGIN_FAILURE: "login.failure",
  PASSWORD_CHANGE: "password.change",
  ROLE_CHANGE: "role.change",
  PERMISSION_CHANGE: "permission.change",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const REDACT_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "totpSecret",
  "pendingTotpSecret",
  "code",
  "recoveryCode",
  "secret",
]);

export type AuditRequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string | null };
  headers?: Record<string, unknown>;
};

export type AuditLogInput = {
  action: AuditAction | string;
  success?: boolean;
  businessId?: string | null;
  actorEmployeeId?: string | null;
  targetEmployeeId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditLogWriter = (entry: AuditLogInput) => Promise<void>;

export function requestAuditContext(req: AuditRequestLike): { ip: string; userAgent: string } {
  const ua = req.headers?.["user-agent"];
  return {
    ip: req.ip || req.socket?.remoteAddress || "unknown",
    userAgent: typeof ua === "string" ? ua.slice(0, 400) : "",
  };
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACT_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

async function postgresWrite(entry: AuditLogInput): Promise<void> {
  const { ownerDb } = await import("../db");
  await ownerDb.insert(schema.auditLog).values({
    businessId: entry.businessId ?? null,
    actorEmployeeId: entry.actorEmployeeId ?? null,
    targetEmployeeId: entry.targetEmployeeId ?? null,
    action: entry.action,
    success: entry.success ?? true,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    metadata: sanitizeAuditMetadata(entry.metadata) ?? undefined,
  });
}

let writer: AuditLogWriter = postgresWrite;

export function setAuditLogWriterForTests(next: AuditLogWriter | null): void {
  writer = next ?? postgresWrite;
}

export async function writeAuditLog(entry: AuditLogInput): Promise<void> {
  try {
    await writer(entry);
  } catch (err) {
    console.error(
      "[audit_log] write failed (fail-open):",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Fire-and-forget helper for route handlers. Never throws. */
export function recordAuthEvent(
  req: AuditRequestLike,
  entry: Omit<AuditLogInput, "ip" | "userAgent">,
): void {
  void writeAuditLog({ ...entry, ...requestAuditContext(req) });
}
