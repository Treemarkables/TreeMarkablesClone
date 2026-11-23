/**
 * 301 the bare domain onto www.
 *
 * https://treemarkables.co.nz currently fails TLS and http://treemarkables.co.nz
 * does not resolve: the apex has no DNS record, so requests never reach this
 * process until Cloudflare + DigitalOcean are updated (see the PR). Once they
 * do, this preserves the path and query and forces https://www.
 *
 * www and Inflow hosts are unchanged. app.treemarkables.co.nz marketing
 * paths are a separate middleware (treemarkablesAppHostSeo.ts): `/` on that
 * host is the iOS and logged-in app entry and must not 301. /health stays
 * on the apex so a platform health check is not turned into a redirect.
 */
import type { RequestHandler } from "express";
import { hostFromHeaders } from "./treemarkablesDocumentBrand";

export const TREEMARKABLES_APEX_HOST = "treemarkables.co.nz";
export const TREEMARKABLES_WWW_ORIGIN = "https://www.treemarkables.co.nz";

export function apexRedirectLocation(host: string, originalUrl: string): string | null {
  if (host !== TREEMARKABLES_APEX_HOST) return null;
  const pathAndQuery = originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`;
  return `${TREEMARKABLES_WWW_ORIGIN}${pathAndQuery}`;
}

export function createTreemarkablesApexRedirectMiddleware(): RequestHandler {
  return function treemarkablesApexRedirect(req, res, next) {
    const pathOnly = (req.path || "/").split("?")[0] || "/";
    if (pathOnly === "/health") return next();

    const host = hostFromHeaders(req.headers, req.hostname);
    const location = apexRedirectLocation(host, req.originalUrl || "/");
    if (!location) return next();

    res.redirect(301, location);
  };
}
