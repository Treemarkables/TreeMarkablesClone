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

// Routes that run with cross-tenant (owner) access on purpose. Matched as prefixes
// (exact match or `path` starts with `prefix + "/"`).
const OWNER_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/dev-test-login",
  "/api/signup",
  "/api/stripe/webhook",
  "/api/health",
  "/api/firebase-config",
  // Session-less integration callbacks — external services (Twilio, Vonage, Resend,
  // Meta/Messenger) and our own contact form POST here with no user session. They
  // legitimately need cross-tenant access and resolve the tenant from the payload, so
  // they must run as owner rather than fail closed on an empty GUC. One prefix covers
  // every /api/webhooks/* route. (Without this, RLS rejected the calls INSERT in the
  // Twilio voice webhook — inbound recordings silently stopped saving.)
  "/api/webhooks",
  // Anonymous public config reads (voicemail greeting, recording disclosure).
  "/api/public",
];

// Session-less endpoints whose path carries a resource id MID-segment, so a simple prefix
// can't match them. These are anonymous customer-facing reads/actions reached from an
// emailed link: viewing or accepting a proposal/quote/invoice by its unguessable id,
// viewing a shared video/photo, and the public review-request flow. They run as owner
// (the pre-RLS behaviour) so an unauthenticated visitor can reach the single resource the
// link points to. (Without this, RLS pinned an empty-GUC connection for the anonymous
// visitor and matched zero rows — the proposal viewer link 404'd for customers.)
//
// BEFORE TENANT #2: the WRITE endpoints here (accept, review submit) currently get their
// business_id from the column DEFAULT (= Treemarkables) on the owner connection — correct
// while single-tenant, but each must resolve the owning tenant from the target resource
// before a second tenant is onboarded. Same class of gap as the customer-portal session,
// tracked in INFLOW_PHASE2_PROD_RUNBOOK.md.
const OWNER_PATH_PATTERNS: RegExp[] = [
  /^\/api\/proposals\/[^/]+\/public$/,
  /^\/api\/proposals\/[^/]+\/accept$/,
  /^\/api\/quotes\/[^/]+\/accept$/,
  /^\/api\/invoices\/[^/]+\/public$/,
  // The invoice PDF and online-payment endpoints are reached by customers from
  // the emailed invoice link / public invoice view (no session). Like /public
  // they must run as owner — otherwise RLS pins an empty-GUC connection and the
  // single-resource lookup matches zero rows ("Invoice not found" / the Download
  // PDF + Pay now buttons fail). Same anonymous-single-resource-by-id class as
  // the proposal/quote viewer links above.
  /^\/api\/invoices\/[^/]+\/pdf$/,
  /^\/api\/invoices\/[^/]+\/payment-checkout$/,
  // "Book another job" on the public invoice page (#268) — anonymous POST that
  // looks the invoice up by id, then self-scopes writes to the invoice's tenant
  // via runWithBusiness. Same anonymous-single-resource-by-id class as above;
  // without this the empty-GUC connection reads zero rows → 404 for customers.
  /^\/api\/invoices\/[^/]+\/request-service$/,
  /^\/api\/videos\/[^/]+\/public$/,
  /^\/api\/jobs\/[^/]+\/videos\/public$/,
  /^\/api\/photos\/public$/,
  /^\/api\/reviews\/request\/[^/]+$/,
  /^\/api\/reviews\/submit$/,
];

export function isOwnerPath(path: string): boolean {
  return (
    OWNER_PATHS.some((p) => path === p || path.startsWith(p + "/")) ||
    OWNER_PATH_PATTERNS.some((re) => re.test(path))
  );
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
