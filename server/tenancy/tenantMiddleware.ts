/**
 * Inflow tenancy — per-request tenant context middleware (Phase 2 RLS fallback).
 *
 * Mounted right after the session middleware. For an authenticated API request (with RLS
 * enabled), it pins a pooled connection scoped to the tenant (`SET ROLE app_tenant` +
 * the business GUC) and binds it to the async context, so every query in the request
 * runs under RLS. The connection is released (and reset) when the response finishes.
 *
 * FAIL-CLOSED: if RLS is on and an API request reaches here without a businessId (e.g. a
 * dropped/expired session), we still pin an app_tenant connection but with an EMPTY GUC,
 * so RLS matches zero rows. We must NOT fall through to the owner (BYPASSRLS) connection,
 * which would return every tenant's data — that was the cross-tenant leak.
 *
 * Owner-context routes (login, signup, Stripe webhook, health) legitimately need
 * cross-tenant access, so they're allowlisted onto the owner path. Non-API requests
 * (static assets, the SPA shell) never touch tenant tables, so they skip pinning entirely
 * — which also keeps the tenant connection pool from being exhausted by asset traffic.
 *
 * Flag off (default): binds only the businessId (owner path) — exact prior behaviour.
 */
import type { Request, Response, NextFunction } from "express";
import { acquireTenantDb } from "../db";
import { runWithBusiness, runWithTenant } from "./tenantStore";

const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";

// Routes that run with cross-tenant (owner) access on purpose. Matched as prefixes.
const OWNER_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/dev-test-login",
  "/api/signup",
  "/api/stripe/webhook",
  "/api/health",
  "/api/firebase-config",
];

function isOwnerPath(path: string): boolean {
  return OWNER_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const businessId = (req.session as { businessId?: string } | undefined)?.businessId;

  // Only API routes query tenant tables. Static/SPA/owner routes: bind businessId only,
  // no pinned connection (cheaper, and avoids holding pool connections for asset traffic).
  const needsTenantConn =
    RLS_ENABLED && req.path.startsWith("/api/") && !isOwnerPath(req.path);

  if (!needsTenantConn) {
    runWithBusiness(businessId, () => next());
    return;
  }

  // Authenticated → scope to the tenant. No businessId (dropped session) → empty GUC,
  // which fails closed (zero rows) rather than leaking via the owner connection.
  const guc = businessId ?? "";
  let conn;
  try {
    conn = await acquireTenantDb(guc);
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
