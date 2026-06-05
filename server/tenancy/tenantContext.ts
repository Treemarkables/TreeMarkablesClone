/**
 * Inflow tenancy — Express middleware that attaches a tenant-scoped DB client.
 *
 * Reads the tenant id from the authenticated session (the SAAS plan's locked
 * "session-derived businessId" decision), mints a short-lived JWT, and exposes a
 * per-request Drizzle client on `req.db`. Handlers then use `req.db` instead of the
 * global `db` so their queries run under RLS as the `authenticated` role.
 *
 * NOT wired into the app yet. Two prerequisites before mounting this:
 *   1. Neon Authorize configured (JWKS URL) — see INFLOW_RLS_RUNBOOK.md.
 *   2. `req.session.businessId` exists — added in Phase 1 (the businessId migration).
 *      Until then this middleware no-ops (falls through) for every request.
 */
import type { Request, Response, NextFunction } from "express";
import { signTenantJwt } from "./tenantKeys";
import { dbForRequest } from "./dbForRequest";

export async function tenantContext(req: Request, res: Response, next: NextFunction) {
  const businessId = (req.session as any)?.businessId as string | undefined;
  const employeeId = (req.session as any)?.employeeId as string | undefined;

  // Pre-tenancy / unauthenticated routes fall through untouched.
  if (!businessId) return next();

  try {
    const jwt = await signTenantJwt({ business_id: businessId, sub: employeeId });
    (req as any).tenantJwt = jwt;
    (req as any).db = dbForRequest(jwt);
    next();
  } catch (err) {
    next(err);
  }
}
