/**
 * Stop app.treemarkables.co.nz from ranking for Treemarkables marketing pages.
 *
 * Google has been indexing the same public URLs on the staff host and on
 * https://www.treemarkables.co.nz. Sitemap paths (and /home, which serves the
 * same homepage) 301 to www and keep the query string.
 *
 * `/` does not redirect. On this host it is the app entry:
 *   - a logged-in browser goes to /dispatch (client/src/App.tsx)
 *   - the Capacitor shell goes to /login
 *   - a logged-out browser still paints the marketing homepage
 * The shipped iOS webview loads this host (session cookie comment). The
 * source capacitor.config.ts server URL is already https://app.inflowapp.co.nz,
 * which this middleware ignores. Either binary keeps working without a
 * TestFlight rebuild because `/` still returns the SPA.
 *
 * A staff session cookie also skips the 301, so a logged-in full page load
 * of a marketing URL stays in the app. Googlebot does not send that cookie.
 * Those responses, and `/`, carry X-Robots-Tag: noindex plus a canonical to www.
 *
 * http://www.treemarkables.co.nz → https://www.treemarkables.co.nz is outside
 * this repo. DigitalOcean App Platform upgrades HTTP to HTTPS at the edge
 * before the request reaches Node:
 * https://docs.digitalocean.com/products/app-platform/details/limits/
 * ("App Platform automatically upgrades all HTTP requests to HTTPS").
 * Production Helmet then sends HSTS. This middleware does not see plain HTTP
 * on www and does not implement that redirect.
 */
import fs from "fs";
import path from "path";
import type { RequestHandler, Response } from "express";
import { hostFromHeaders } from "./treemarkablesDocumentBrand";
import { SESSION_COOKIE_NAME } from "./security/sessionCookie";
import {
  TREEMARKABLES_WWW_ORIGIN,
  isAppHostMarketingRedirectPath,
  isTreemarkablesAppHostName,
  normalisePublicPath,
} from "../shared/treemarkablesMarketingPaths";

const NOINDEX_MARK = "<!-- app-host-noindex -->";

const APP_HOST_ROBOTS_HEADER = [
  "# app.treemarkables.co.nz is the staff app, including the iOS shell.",
  "# Public tree-care pages 301 to https://www.treemarkables.co.nz.",
  "# This file does not advertise that site's sitemap.",
  "",
].join("\n");

const APP_HOST_ROBOTS_FALLBACK = `${APP_HOST_ROBOTS_HEADER}User-agent: *
Disallow: /api/
Disallow: /login
Disallow: /dashboard
Disallow: /dispatch
`;

export function requestHasStaffSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  const name = `${SESSION_COOKIE_NAME}=`;
  return cookieHeader.split(";").some((part) => part.trim().startsWith(name));
}

/** Reject protocol-relative and absolute URLs so the redirect cannot be poisoned. */
export function safePathAndQuery(originalUrl: string): string | null {
  if (!originalUrl) return "/";
  const value = originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://")) return null;
  if (/^\/(?:%2f|%5c)/i.test(value)) return null;
  return value;
}

export function appHostCanonicalUrl(pathname: string): string {
  const pathOnly = normalisePublicPath(pathname);
  if (pathOnly === "/") return `${TREEMARKABLES_WWW_ORIGIN}/`;
  return `${TREEMARKABLES_WWW_ORIGIN}${pathOnly}`;
}

export function appHostMarketingRedirectLocation(input: {
  host: string;
  originalUrl: string;
  method?: string;
  cookie?: string;
}): string | null {
  if (!isTreemarkablesAppHostName(input.host)) return null;
  const method = (input.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if (requestHasStaffSessionCookie(input.cookie)) return null;
  const pathAndQuery = safePathAndQuery(input.originalUrl);
  if (!pathAndQuery) return null;
  const pathOnly = pathAndQuery.split("?")[0] || "/";
  if (!isAppHostMarketingRedirectPath(pathOnly)) return null;
  return `${TREEMARKABLES_WWW_ORIGIN}${pathAndQuery}`;
}

/** Same private-route rules as robots.txt, without a Sitemap: line. */
export function appHostRobotsTxt(wwwRobots: string): string {
  const lines = wwwRobots.split(/\r?\n/).filter((line) => {
    if (/^\s*sitemap\s*:/i.test(line)) return false;
    if (/^\s*#.*sitemap/i.test(line)) return false;
    return true;
  });
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  const body = lines.join("\n").trim();
  return `${APP_HOST_ROBOTS_HEADER}${body}\n`;
}

function looksLikeHtmlDocument(body: string): boolean {
  const start = body.slice(0, 512).trimStart().toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function upsertMetaRobots(html: string, content: string): string {
  const tag = `<meta name="robots" content="${escapeAttr(content)}" />`;
  const namedFirst = /<meta\s+(?:[^>]*?\s)?name=["']robots["'][^>]*>/i;
  if (namedFirst.test(html)) return html.replace(namedFirst, tag);
  const contentFirst = /<meta\s+(?:[^>]*?\s)?content=["'][^"']*["'][^>]*name=["']robots["'][^>]*>/i;
  if (contentFirst.test(html)) return html.replace(contentFirst, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertCanonical(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeAttr(href)}" />`;
  const pattern = /<link\s+(?:[^>]*?\s)?rel=["']canonical["'][^>]*>/i;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

/** First HTML byte on the app host: noindex, and point Google at the www URL. */
export function applyAppHostNoindex(html: string, canonicalUrl: string): string {
  if (!looksLikeHtmlDocument(html)) return html;
  if (html.includes(NOINDEX_MARK)) return html;
  let next = upsertMetaRobots(html, "noindex, follow");
  next = upsertCanonical(next, canonicalUrl);
  if (!next.includes(NOINDEX_MARK)) {
    next = next.replace(/<\/head>/i, `    ${NOINDEX_MARK}\n  </head>`);
  }
  return next;
}

function readWwwRobots(override: string | undefined): string {
  if (override !== undefined) return override;
  try {
    return fs.readFileSync(path.resolve(process.cwd(), "robots.txt"), "utf8");
  } catch {
    return "";
  }
}

function invokeSendFileCallback(optionsOrCb: unknown, maybeCb: unknown, err?: Error): void {
  const cb = typeof maybeCb === "function" ? maybeCb : typeof optionsOrCb === "function" ? optionsOrCb : undefined;
  if (typeof cb === "function") {
    (cb as (error?: Error) => void)(err);
  }
}

function interceptHtml(res: Response, canonicalUrl: string): void {
  const originalSend = res.send.bind(res);
  const originalSendFile = res.sendFile.bind(res);
  const originalEnd = res.end.bind(res);
  const rewrite = (html: string) => applyAppHostNoindex(html, canonicalUrl);

  res.send = ((body?: unknown) => {
    if (typeof body === "string" && looksLikeHtmlDocument(body)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return originalSend(rewrite(body));
    }
    return originalSend(body as Parameters<Response["send"]>[0]);
  }) as Response["send"];

  res.sendFile = ((filePath: string, options?: unknown, callback?: unknown) => {
    const normalised = String(filePath).replace(/\\/g, "/");
    if (normalised.endsWith("index.html")) {
      try {
        const html = fs.readFileSync(filePath, "utf8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        originalSend(rewrite(html));
        invokeSendFileCallback(options, callback);
        return res;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        invokeSendFileCallback(options, callback, err);
        return res;
      }
    }
    return originalSendFile(
      filePath,
      options as Parameters<Response["sendFile"]>[1],
      callback as Parameters<Response["sendFile"]>[2],
    );
  }) as Response["sendFile"];

  res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
    if (typeof chunk === "string" && looksLikeHtmlDocument(chunk)) {
      return originalEnd(rewrite(chunk), encoding as BufferEncoding, cb as () => void);
    }
    if (Buffer.isBuffer(chunk)) {
      const asText = chunk.toString("utf8");
      if (looksLikeHtmlDocument(asText)) {
        return originalEnd(Buffer.from(rewrite(asText), "utf8"), encoding as BufferEncoding, cb as () => void);
      }
    }
    return originalEnd(chunk as never, encoding as never, cb as never);
  }) as Response["end"];
}

export function createTreemarkablesAppHostSeoMiddleware(options?: { robotsTxt?: string }): RequestHandler {
  return function treemarkablesAppHostSeo(req, res, next) {
    const host = hostFromHeaders(req.headers, req.hostname);
    if (!isTreemarkablesAppHostName(host)) return next();

    const method = (req.method || "GET").toUpperCase();
    const pathOnly = (req.path || "/").split("?")[0] || "/";
    const originalUrl = req.originalUrl || pathOnly;
    const cookie = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;

    if ((method === "GET" || method === "HEAD") && normalisePublicPath(pathOnly) === "/robots.txt") {
      const source = readWwwRobots(options?.robotsTxt);
      const body = source.trim() ? appHostRobotsTxt(source) : APP_HOST_ROBOTS_FALLBACK;
      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex");
      if (method === "HEAD") {
        res.end();
        return;
      }
      res.send(body);
      return;
    }

    const location = appHostMarketingRedirectLocation({
      host,
      originalUrl,
      method,
      cookie,
    });
    if (location) {
      res.redirect(301, location);
      return;
    }

    const normalised = normalisePublicPath(pathOnly);
    const indexableMarketingLeftInPlace =
      (method === "GET" || method === "HEAD") &&
      (normalised === "/" || isAppHostMarketingRedirectPath(pathOnly));
    if (indexableMarketingLeftInPlace) {
      res.setHeader("X-Robots-Tag", "noindex, follow");
      interceptHtml(res, appHostCanonicalUrl(pathOnly));
    }

    next();
  };
}
