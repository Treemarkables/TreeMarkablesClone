/**
 * Inflow tenancy — per-request tenant context middleware (Phase 2 RLS fallback).
 *
 * Mounted right after the session middleware. For an authenticated request (with RLS
 * enabled), it pins a pooled connection scoped to the tenant (`SET ROLE app_tenant` +
 * the business GUC) and binds it to the async context, so every query in the request
 * runs under RLS. The connection is released (and reset) when the response finishes.
 *
 * Flag off (default) or pre-auth/login: binds only the businessId (owner path) — exact
 * current behaviour, no pooled connection acquired.
 */
import type { Request, Response, NextFunction } from "express";
import { acquireTenantDb } from "../db";
import { runWithBusiness, runWithTenant } from "./tenantStore";

const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";

export async function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const businessId = (req.session as { businessId?: string } | undefined)?.businessId;

  // RLS disabled, or no tenant yet (login / pre-auth): owner path, businessId only.
  if (!RLS_ENABLED || !businessId) {
    runWithBusiness(businessId, () => next());
    return;
  }

  // RLS enabled + authenticated: pin a tenant-scoped connection for this request.
  let conn;
  try {
    conn = await acquireTenantDb(businessId);
  } catch (err) {
    next(err as Error);
    return;
  }

  let released = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    void conn!.release();
  };
  res.once("finish", cleanup);
  res.once("close", cleanup);

  runWithTenant({ businessId, tenantDb: conn.tenantDb }, () => next());
}
