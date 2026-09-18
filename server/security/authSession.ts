/**
 * Shared login-session helpers for password login and the MFA follow-up.
 * 30-day rolling cookies stay as configured in server/index.ts — this only
 * stamps metadata and (for pending MFA) shortens THAT cookie to 10 minutes.
 */
import type { Request, Response } from "express";
import type { Employee } from "@shared/schema";
import { resolveEntitlements } from "../tenancy/entitlements";
import { ensureRoleTiersSeeded, getEmployeePermissions } from "../permissions";
import { MFA_PENDING_MAX_AGE_MS, type PendingMfaPurpose } from "./mfaGate";

export { MFA_PENDING_MAX_AGE_MS };
export type { PendingMfaPurpose };

export function stampSessionClientMeta(req: Request): void {
  if (!req.session.sessionCreatedAt) {
    req.session.sessionCreatedAt = new Date().toISOString();
  }
  const ua = req.headers["user-agent"];
  req.session.userAgent = typeof ua === "string" ? ua.slice(0, 400) : "";
  req.session.ip = req.ip || req.socket.remoteAddress || "";
}

export function clearLegacyDomainSessionCookie(res: Response): void {
  res.clearCookie("treemarkables.sid", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "none",
    domain: ".treemarkables.co.nz",
  });
}

export function clearHostSessionCookie(res: Response): void {
  res.clearCookie("treemarkables.sid", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
}

export async function buildAuthPayload(
  employee: Employee,
  extras?: { mfaEnabled?: boolean },
): Promise<Record<string, unknown>> {
  await ensureRoleTiersSeeded().catch(() => {});
  const loginPermsSet = await getEmployeePermissions(employee).catch(() => new Set<string>());
  let loginPlanKey = "freemium";
  let loginEntitlements: string[] = [];
  if (employee.businessId) {
    try {
      const ent = await resolveEntitlements(employee.businessId);
      loginPlanKey = ent.planKey;
      loginEntitlements = Array.from(ent.entitlements);
    } catch {
      /* fail-open: empty entitlements */
    }
  }
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    role: employee.role,
    phone: employee.phone,
    status: employee.status,
    businessId: employee.businessId ?? null,
    permissions: Array.from(loginPermsSet),
    planKey: loginPlanKey,
    entitlements: loginEntitlements,
    mfaEnabled: extras?.mfaEnabled ?? false,
  };
}

function saveAndRespond(
  req: Request,
  res: Response,
  body: Record<string, unknown>,
): void {
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create session",
      });
      return;
    }
    clearLegacyDomainSessionCookie(res);
    res.json(body);
  });
}

export function beginPendingMfaSession(
  req: Request,
  res: Response,
  employee: Pick<Employee, "id" | "businessId">,
  purpose: PendingMfaPurpose,
): void {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error("Session regenerate error:", regenErr);
      res.status(500).json({
        success: false,
        message: "Failed to create session",
      });
      return;
    }
    req.session.pendingMfaEmployeeId = employee.id;
    req.session.pendingMfaBusinessId = employee.businessId ?? undefined;
    req.session.pendingMfaPurpose = purpose;
    req.session.cookie.maxAge = MFA_PENDING_MAX_AGE_MS;
    stampSessionClientMeta(req);
    saveAndRespond(req, res, {
      success: true,
      mfaRequired: purpose === "challenge",
      mfaEnrollmentRequired: purpose === "enroll",
    });
  });
}

export async function establishEmployeeSession(
  req: Request,
  res: Response,
  employee: Employee,
  opts?: { mfaVerified?: boolean; mfaEnabled?: boolean; recoveryCodes?: string[] },
): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = await buildAuthPayload(employee, { mfaEnabled: opts?.mfaEnabled });
    if (opts?.recoveryCodes) {
      payload = { ...payload, recoveryCodes: opts.recoveryCodes };
    }
  } catch (error) {
    console.error("Auth payload error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
    return;
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error("Session regenerate error:", regenErr);
      res.status(500).json({
        success: false,
        message: "Failed to create session",
      });
      return;
    }
    req.session.employeeId = employee.id;
    req.session.businessId = employee.businessId ?? undefined;
    req.session.mfaVerified = Boolean(opts?.mfaVerified);
    delete req.session.pendingMfaEmployeeId;
    delete req.session.pendingMfaBusinessId;
    delete req.session.pendingMfaPurpose;
    delete req.session.pendingTotpSecret;
    stampSessionClientMeta(req);
    saveAndRespond(req, res, { success: true, data: payload });
  });
}

export function pendingMfaActor(req: Request): {
  employeeId: string;
  businessId?: string;
  purpose: PendingMfaPurpose;
} | null {
  const employeeId = req.session.pendingMfaEmployeeId;
  const purpose = req.session.pendingMfaPurpose;
  if (!employeeId || (purpose !== "challenge" && purpose !== "enroll")) {
    return null;
  }
  return {
    employeeId,
    businessId: req.session.pendingMfaBusinessId,
    purpose,
  };
}
