/**
 * Single source of truth for CUSTOMER-FACING document links.
 *
 * Customer links must point at pages that load through session-less public API
 * routes (allowlisted in server/tenancy/tenantMiddleware.ts) — an anonymous
 * customer following an SMS/email link has no session, so under RLS any page
 * that fetches session-authed endpoints renders "not found". That exact bug
 * shipped in July 2026 because links were built with ad-hoc template strings
 * scattered across components; build them here instead.
 *
 * Public pages (safe to send to customers):
 *   /proposal/:id/accept  → /api/proposals/:id/public   (quotes use ?type=quote)
 *   /invoice/:id/view     → /api/invoices/:id/public
 *
 * Staff-only pages (NEVER send to customers):
 *   /proposal/:id   /quote/:id   /invoice/:id   — session-authed viewers.
 *
 * `base` is the app origin: pass APP_URL (server/config/appUrl.ts) on the
 * server, window.location.origin on the client, or omit it for a relative
 * path (in-app navigation).
 */

const trimBase = (base?: string) => (base ?? "").replace(/\/+$/, "");

const withQuery = (link: string, query?: string) =>
  query ? `${link}${link.includes("?") ? "&" : "?"}${query}` : link;

export function proposalAcceptLink(
  proposalId: string,
  opts: { base?: string; quote?: boolean; query?: string } = {},
): string {
  const link = `${trimBase(opts.base)}/proposal/${proposalId}/accept${opts.quote ? "?type=quote" : ""}`;
  return withQuery(link, opts.query);
}

export function invoiceViewLink(
  invoiceId: string,
  opts: { base?: string; query?: string } = {},
): string {
  return withQuery(`${trimBase(opts.base)}/invoice/${invoiceId}/view`, opts.query);
}

/**
 * Matches a proposal link inside free text (e.g. an SMS body): captures the
 * proposal uuid and, if present, the `/accept` suffix. Returned fresh each
 * call — a shared `g`-flagged RegExp instance carries `lastIndex` state
 * between callers.
 */
export function proposalLinkPattern(): RegExp {
  return /\/proposal\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/accept)?/gi;
}
