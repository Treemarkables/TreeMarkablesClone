/**
 * Treemarkables marketing host router.
 *
 * www.treemarkables.co.nz (and the apex) must never serve the Inflow PWA
 * shell. This middleware is a no-op on every other host, including
 * www.inflowapp.co.nz and app.inflowapp.co.nz.
 *
 * On a Treemarkables marketing host:
 *   - /health, /api/*, /objects/* pass through (same-app contact form / media)
 *   - known Inflow app paths 301 to the live Inflow app origin
 *   - leftover marketing SPA routes 301 onto the new static pages
 *   - everything else is static HTML/CSS/images from treemarkables-site/
 *
 * Sitemap and robots are served from memory if the files are missing so the
 * marketing host cannot 500 those URLs.
 */
import type { Request, RequestHandler, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { APP_URL } from "./config/appUrl";

export const TREEMARKABLES_MARKETING_HOSTS = new Set([
  "www.treemarkables.co.nz",
  "treemarkables.co.nz",
]);

export const TREEMARKABLES_CANONICAL_ORIGIN = "https://www.treemarkables.co.nz";

export const INFLOW_APP_ORIGIN_FALLBACK = "https://app.inflowapp.co.nz";

/** Customer-document + staff-app path prefixes that belong on the Inflow app. */
export const INFLOW_APP_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/dispatch",
  "/dispatch-board",
  "/diary",
  "/dashboard",
  "/today",
  "/job-dashboard",
  "/job-card-preview",
  "/metrics",
  "/overview",
  "/pipeline",
  "/tasks",
  "/videos",
  "/library",
  "/help",
  "/admin",
  "/profitability-calculator",
  "/customer-portal",
  "/proposal",
  "/quote",
  "/invoice",
  "/invoices",
  "/payment-complete",
  "/review",
  "/timeline",
  "/watch",
  "/opportunities",
  "/follow-up-queue",
  "/reputation",
  "/reviews",
  "/marketing",
  "/inbox",
  "/integrations",
  "/reconciliation",
  "/communications",
  "/supplier-invoices",
  "/calls",
  "/conversation",
  "/unlinked-calls",
  "/templates",
  "/equipment",
  "/vehicle-inspection",
  "/vehicle-inspection-history",
  "/apply-signature",
  "/jha-assessment",
  "/jha-history",
  "/near-miss-report",
  "/near-miss-history",
  "/safety",
  "/calendar",
  "/staff-schedule",
  "/workflows",
  "/mulch-drops",
  "/history",
  "/clients",
  "/materials-services",
  "/settings",
  "/staff-induction",
  "/developer",
  "/time-tracking",
] as const;

/** Old React-SPA marketing URLs that are not rebuilt — collapse onto real pages. */
export const LEGACY_MARKETING_REDIRECTS: Record<string, string> = {
  "/home": "/",
  "/blog": "/",
  "/summer-offer": "/",
  "/mulch": "/contact",
  "/mulch/thanks": "/contact",
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const FALLBACK_SITEMAP = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/tree-removal</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/tree-pruning</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/gisborne-arborist</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/stump-grinding</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/hedge-trimming</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/contact</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${TREEMARKABLES_CANONICAL_ORIGIN}/privacy-policy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>
`;

const FALLBACK_ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${TREEMARKABLES_CANONICAL_ORIGIN}/sitemap.xml
`;

const MARKETING_CONTACT_ORIGINS = new Set([
  TREEMARKABLES_CANONICAL_ORIGIN,
  "https://treemarkables.co.nz",
]);

export function normalizeHostname(hostHeader: string | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0].trim().toLowerCase().replace(/\.$/, "");
}

export function isTreemarkablesMarketingHost(hostHeader: string | undefined): boolean {
  return TREEMARKABLES_MARKETING_HOSTS.has(normalizeHostname(hostHeader));
}

export function resolveInflowAppOrigin(appUrl: string = APP_URL): string {
  const override = (process.env.TREEMARKABLES_APP_REDIRECT_ORIGIN || "").trim().replace(/\/$/, "");
  const candidate = override || (appUrl || "").trim().replace(/\/$/, "");
  if (candidate) {
    try {
      const host = new URL(candidate).host.toLowerCase();
      if (host.endsWith("treemarkables.co.nz")) {
        return INFLOW_APP_ORIGIN_FALLBACK;
      }
      return candidate;
    } catch {
      // fall through
    }
  }
  return INFLOW_APP_ORIGIN_FALLBACK;
}

export function pathHasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isInflowAppPath(pathname: string): boolean {
  return INFLOW_APP_PATH_PREFIXES.some((prefix) => pathHasPrefix(pathname, prefix));
}

export function resolveTreemarkablesSiteDir(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.TREEMARKABLES_SITE_DIR,
    path.join(process.cwd(), "treemarkables-site"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "treemarkables-site"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "treemarkables-site"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return path.join(process.cwd(), "treemarkables-site");
}

function requestHost(req: Request): string {
  const forwarded = req.headers["x-forwarded-host"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return normalizeHostname(forwarded.split(",")[0]);
  }
  return normalizeHostname(req.hostname || req.headers.host);
}

function safeJoin(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const cleaned = path.posix.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(root, cleaned.replace(/^\//, ""));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    return null;
  }
  return absolute;
}

function sendBuffer(
  res: Response,
  status: number,
  contentType: string,
  body: string | Buffer,
  cacheControl: string,
): void {
  res.status(status);
  res.set("Content-Type", contentType);
  res.set("Cache-Control", cacheControl);
  res.set("X-Content-Type-Options", "nosniff");
  res.send(body);
}

function sendSiteFile(res: Response, filePath: string, status = 200): boolean {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const body = fs.readFileSync(filePath);
    const cacheControl = ext === ".html" || ext === ".xml" || ext === ".txt"
      ? "public, max-age=60"
      : "public, max-age=86400, immutable";
    sendBuffer(res, status, contentType, body, cacheControl);
    return true;
  } catch (error) {
    console.error("[treemarkables-marketing] failed to send", filePath, error);
    return false;
  }
}

export function resolveMarketingFile(siteDir: string, pathname: string): { filePath: string; status: number } | "missing" {
  if (pathname === "/" || pathname === "") {
    return { filePath: path.join(siteDir, "index.html"), status: 200 };
  }

  const relative = pathname.replace(/^\//, "");
  const direct = safeJoin(siteDir, relative);
  if (direct && fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return { filePath: direct, status: 200 };
  }

  const asIndex = safeJoin(siteDir, path.posix.join(relative, "index.html"));
  if (asIndex && fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) {
    return { filePath: asIndex, status: 200 };
  }

  const asHtml = safeJoin(siteDir, `${relative}.html`);
  if (asHtml && fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) {
    return { filePath: asHtml, status: 200 };
  }

  return "missing";
}

export interface TreemarkablesMarketingOptions {
  siteDir?: string;
  inflowOrigin?: string;
}

export function createTreemarkablesMarketingMiddleware(
  options: TreemarkablesMarketingOptions = {},
): RequestHandler {
  const siteDir = resolveTreemarkablesSiteDir(options.siteDir);
  const inflowOrigin = options.inflowOrigin || resolveInflowAppOrigin();

  return function treemarkablesMarketing(req, res, next) {
    const host = requestHost(req);
    if (!TREEMARKABLES_MARKETING_HOSTS.has(host)) {
      return next();
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.path === "/api/contact" || req.path.startsWith("/api/") || req.path.startsWith("/objects/")) {
        return next();
      }
      return next();
    }

    if (host === "treemarkables.co.nz") {
      return res.redirect(301, `${TREEMARKABLES_CANONICAL_ORIGIN}${req.originalUrl}`);
    }

    const pathname = req.path || "/";

    if (
      pathname === "/health" ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/objects")
    ) {
      return next();
    }

    // Never leak the Inflow PWA manifest / service worker / app icons on www.
    if (
      pathname === "/manifest.json" ||
      pathname === "/sw.js" ||
      pathname.startsWith("/inflow-icon")
    ) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }

    if (isInflowAppPath(pathname)) {
      return res.redirect(301, `${inflowOrigin}${req.originalUrl}`);
    }

    const legacyTarget = LEGACY_MARKETING_REDIRECTS[pathname];
    if (legacyTarget) {
      return res.redirect(301, `${TREEMARKABLES_CANONICAL_ORIGIN}${legacyTarget}`);
    }
    if (pathname.startsWith("/blog/")) {
      return res.redirect(301, `${TREEMARKABLES_CANONICAL_ORIGIN}/`);
    }

    if (pathname === "/sitemap.xml") {
      const filePath = path.join(siteDir, "sitemap.xml");
      if (!sendSiteFile(res, filePath)) {
        sendBuffer(res, 200, "application/xml; charset=utf-8", FALLBACK_SITEMAP, "public, max-age=60");
      }
      return;
    }

    if (pathname === "/robots.txt") {
      const filePath = path.join(siteDir, "robots.txt");
      if (!sendSiteFile(res, filePath)) {
        sendBuffer(res, 200, "text/plain; charset=utf-8", FALLBACK_ROBOTS, "public, max-age=60");
      }
      return;
    }

    const resolved = resolveMarketingFile(siteDir, pathname);
    if (resolved !== "missing") {
      if (sendSiteFile(res, resolved.filePath, resolved.status)) {
        return;
      }
    }

    const notFound = path.join(siteDir, "404.html");
    if (sendSiteFile(res, notFound, 404)) {
      return;
    }

    sendBuffer(
      res,
      404,
      "text/html; charset=utf-8",
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found | Treemarkables</title></head><body><h1>Page not found</h1><p><a href="/">Treemarkables</a></p></body></html>`,
      "no-store",
    );
  };
}

/**
 * Allow the static www site (including a later Cloudflare Pages split) to
 * POST quotes to the Inflow app's existing /api/contact. No-op unless the
 * browser Origin is a Treemarkables marketing host.
 */
export function treemarkablesContactCors(): RequestHandler {
  return function contactCors(req, res, next) {
    if (req.path !== "/api/contact") {
      return next();
    }
    const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim().replace(/\/$/, "") : "";
    if (!origin || !MARKETING_CONTACT_ORIGINS.has(origin)) {
      return next();
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  };
}
