/**
 * Ops auth: a logged-in employee of one business, or an API key that already
 * has that business id stored on it. The caller never supplies a business id.
 * A key with no business id is rejected so a lookup cannot run unscoped.
 */
import { createHash } from "node:crypto";

export interface OpsEmployee {
  id: string;
  role: string;
  businessId: string | null;
}

export interface OpsApiKey {
  id: string;
  businessId: string | null;
  isActive: boolean;
}

export type OpsAccess =
  | {
      ok: true;
      businessId: string;
      canSetDailyRevenueTarget: boolean;
      via: "session" | "apiKey";
    }
  | { ok: false; status: number; message: string };

export interface ResolveOpsAccessInput {
  sessionEmployeeId?: string;
  sessionBusinessId?: string;
  authorizationHeader?: string;
  lookupEmployee: (id: string) => Promise<OpsEmployee | undefined>;
  lookupApiKey: (keyHash: string) => Promise<OpsApiKey | undefined>;
  touchApiKey?: (id: string) => Promise<void>;
}

export function hashOpsApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

export async function resolveOpsAccess(input: ResolveOpsAccessInput): Promise<OpsAccess> {
  const header = input.authorizationHeader;
  let apiKey: OpsApiKey | undefined;
  if (header && /^Bearer\b/i.test(header)) {
    const token = bearerToken(header);
    if (!token) {
      return { ok: false, status: 401, message: "API key is empty" };
    }
    apiKey = await input.lookupApiKey(hashOpsApiKey(token));
    if (!apiKey) {
      return { ok: false, status: 401, message: "Invalid API key" };
    }
    if (!apiKey.isActive) {
      return { ok: false, status: 401, message: "API key is inactive" };
    }
    if (!apiKey.businessId) {
      return { ok: false, status: 401, message: "API key is not scoped to a business" };
    }
  }

  const employeeId = input.sessionEmployeeId;
  if (employeeId) {
    const employee = await input.lookupEmployee(employeeId);
    if (!employee?.businessId) {
      return { ok: false, status: 401, message: "Authentication required" };
    }
    if (input.sessionBusinessId && input.sessionBusinessId !== employee.businessId) {
      return { ok: false, status: 403, message: "Session is not scoped to this business" };
    }
    if (apiKey && apiKey.businessId !== employee.businessId) {
      return { ok: false, status: 403, message: "API key is scoped to a different business" };
    }
    if (apiKey && input.touchApiKey) {
      await input.touchApiKey(apiKey.id).catch(() => undefined);
    }
    return {
      ok: true,
      businessId: employee.businessId,
      canSetDailyRevenueTarget: employee.role === "admin" || apiKey != null,
      via: apiKey ? "apiKey" : "session",
    };
  }

  if (apiKey?.businessId) {
    if (input.touchApiKey) {
      await input.touchApiKey(apiKey.id).catch(() => undefined);
    }
    return {
      ok: true,
      businessId: apiKey.businessId,
      canSetDailyRevenueTarget: true,
      via: "apiKey",
    };
  }

  return { ok: false, status: 401, message: "Authentication required" };
}
