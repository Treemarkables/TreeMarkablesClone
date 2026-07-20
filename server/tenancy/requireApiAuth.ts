/**
 * Inflow — global API authentication backstop (flag-gated).
 *
 * The API historically relied on Postgres RLS to fail closed for unauthenticated
 * callers (empty GUC → 0 rows). That protects *data* isolation but not *action*
 * authorization, and it collapses entirely if TENANT_RLS_ENABLED is ever off
 * (default) — every unguarded route then runs on the BYPASSRLS owner connection.
 *
 * This middleware makes authentication explicit and independent of RLS: any
 * `/api/*` request that isn't on the public allowlist must carry a logged-in
 * employee session, else 401. Per-route requireAdmin/requirePermission still
 * layer on top for authorization.
 *
 * ROLLOUT: gated behind API_AUTH_ENFORCED (default OFF) so it can be enabled and
 * smoke-tested per-environment like TENANT_RLS_ENABLED, then turned on for good.
 * The allowlist reuses tenantMiddleware's owner-path set (webhooks, public
 * customer links, login/signup/health) plus the two session-less public POSTs
 * (customer login + the marketing contact form). If you add a new genuinely
 * public API route, add it here.
 */
import type { Request, Response, NextFunction } from "express";
import { isOwnerPath } from "./tenantMiddleware";

const ENFORCED = process.env.API_AUTH_ENFORCED === "true";

// Session-less public API endpoints that are NOT owner-path allowlisted:
// customer portal login, the public marketing contact form, the public mulch
// order form (validates + rate-limits + tenant-stamps internally), and two
// anonymous config reads — /api/payments/config (public invoice page decides whether to
// show "Pay now") and /api/captcha/config (marketing contact form decides
// whether to render Turnstile). Both return env-derived booleans/site keys
// only — no tenant data — so exempting them from auth is safe.
const PUBLIC_API_PATHS = [
  "/api/customer-auth",
  "/api/contact",
  "/api/mulch-orders",
  "/api/payments/config",
  "/api/captcha/config",
];

function isPublicApiPath(path: string): boolean {
  return isOwnerPath(path) || PUBLIC_API_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  if (!ENFORCED) {
    next();
    return;
  }
  if (!req.path.startsWith("/api/") || isPublicApiPath(req.path)) {
    next();
    return;
  }
  const employeeId = (req.session as { employeeId?: string } | undefined)?.employeeId;
  if (!employeeId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }
  next();
}
