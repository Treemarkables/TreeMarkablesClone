/**
 * Host-aware document branding for www.treemarkables.co.nz / treemarkables.co.nz.
 *
 * Google (and other crawlers) see the Inflow PWA shell's <title>/meta/icons
 * on the Treemarkables domain because client/index.html is the Inflow app.
 * This middleware rewrites that first HTML byte — and the web manifest /
 * Inflow icon URLs — on Treemarkables hosts only.
 *
 * Intentionally NOT the PR #516 cutover:
 *   - React UI / layout is unchanged (same SPA)
 *   - no static treemarkables-site/ marketing HTML
 *   - no 301 of /login, /dispatch, etc. off www
 *
 * No-op on Inflow hosts (app.inflowapp.co.nz, www.inflowapp.co.nz) and on
 * the legacy app host (app.treemarkables.co.nz).
 */
import type { IncomingHttpHeaders } from "http";
import type { Request, RequestHandler, Response } from "express";
import fs from "fs";

export const TREEMARKABLES_DOCUMENT_HOSTS = new Set([
  "www.treemarkables.co.nz",
  "treemarkables.co.nz",
]);

export const TREEMARKABLES_CANONICAL_ORIGIN = "https://www.treemarkables.co.nz";

const BRAND_START = "<!-- treemarkables-document-brand -->";
const BRAND_END = "<!-- /treemarkables-document-brand -->";

const ICON_BY_SIZE: Record<string, string> = {
  "180": "/treemarkables-logo-green-180.png",
  "192": "/treemarkables-logo-green-192.png",
  "512": "/treemarkables-logo-green-512.png",
};

export interface DocumentBrandMeta {
  title: string;
  description: string;
  canonicalPath: string;
  ogImage: string;
  ogTitle?: string;
  ogDescription?: string;
}

/** Copy already used by client/src/pages/* SEO components — keep first-byte in sync. */
export const DEFAULT_TREEMARKABLES_META: DocumentBrandMeta = {
  title: "Treemarkables — Gisborne's Number 1 Arborist & Tree Care",
  description:
    "Gisborne's trusted arborists for safe tree removals, expert pruning, stump grinding and hedge trimming across Tairāwhiti and the East Coast.",
  canonicalPath: "/",
  ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
};

const PAGE_META: Record<string, DocumentBrandMeta> = {
  "/": DEFAULT_TREEMARKABLES_META,
  "/tree-removal": {
    title: "Tree Removal Gisborne – Safe, Certified & 24/7",
    description:
      "Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices.",
    canonicalPath: "/tree-removal",
    ogTitle: "Tree Removal Gisborne – Safe & Efficient Service",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/hazardous-tree-removal.jpg`,
  },
  "/tree-pruning": {
    title: "Tree Pruning Gisborne – Qualified Arborists",
    description:
      "Improve tree health and safety with our expert tree pruning services. Treemarkables offers crown reduction and shaping across Gisborne and the wider East Coast. Free assessments available.",
    canonicalPath: "/tree-pruning",
    ogTitle: "Tree Pruning Gisborne – Professional Arborists",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/tree-pruning.jpg`,
  },
  "/stump-grinding": {
    title: "Stump Grinding Gisborne – Complete Stump Removal",
    description:
      "Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today.",
    canonicalPath: "/stump-grinding",
    ogTitle: "Stump Grinding Gisborne – Fast & Tidy Stump Removal",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/stump-grinding.jpg`,
  },
  "/hedge-trimming": {
    title: "Hedge Trimming Gisborne – Expert Shaping & Care",
    description:
      "Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote.",
    canonicalPath: "/hedge-trimming",
    ogTitle: "Hedge Trimming Gisborne – Neat & Healthy Hedges",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/hedge-trimming.jpg`,
  },
  "/contact": {
    title: "Contact Us – Get a Free Quote | Treemarkables",
    description:
      "Contact Treemarkables for professional tree removal, pruning, stump grinding and hedge trimming services in Gisborne. Get a free quote within 24 hours.",
    canonicalPath: "/contact",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
  "/privacy-policy": {
    title: "Privacy Policy | Treemarkables - Tree Removal Gisborne",
    description:
      "Privacy Policy for Treemarkables tree removal services. Learn how we collect, use, and protect your personal information under the New Zealand Privacy Act 2020.",
    canonicalPath: "/privacy-policy",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
  "/blog": {
    title: "Tree Care Blog – Gisborne Arborist Tips | Treemarkables",
    description:
      "Expert tree care advice from Gisborne's professional arborists. Get tips on tree pruning, removal, and maintenance for your property's safety and health.",
    canonicalPath: "/blog",
    ogTitle: "Tree Care Blog - Expert Tips from Gisborne Arborists",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
  "/mulch": {
    title: "Order Mulch — Treemarkables",
    description: "Aged arborist mulch delivered across Gisborne. $35/m³ + GST plus $80 delivery, minimum 4 m³.",
    canonicalPath: "/mulch",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
  "/mulch/thanks": {
    title: "Mulch order received — Treemarkables",
    description: "Thanks for your mulch order. We'll be in touch to confirm delivery.",
    canonicalPath: "/mulch/thanks",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
  "/summer-offer": {
    title: "Win $1000 Back - Summer Tree Care Offer | Treemarkables Gisborne",
    description:
      "Book any tree care service this summer and win up to $1000 back! 1-in-90 chance to win. Professional tree removal, pruning & emergency services in Gisborne.",
    canonicalPath: "/summer-offer",
    ogTitle: "Win $1000 Back on Tree Care - Summer Offer",
    ogDescription:
      "Book any tree service this summer for your chance to win $1000 back! Professional arborists serving Gisborne and surrounding areas.",
    ogImage: `${TREEMARKABLES_CANONICAL_ORIGIN}/team-photo.jpg`,
  },
};

export const TREEMARKABLES_WEB_MANIFEST = {
  name: "Treemarkables",
  short_name: "Treemarkables",
  description: DEFAULT_TREEMARKABLES_META.description,
  start_url: "/",
  display: "browser",
  background_color: "#000000",
  theme_color: "#39FF14",
  icons: [
    {
      src: "/treemarkables-logo-green-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/treemarkables-logo-green-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};

export function normalizeHostname(hostHeader: string | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0].trim().toLowerCase().replace(/\.$/, "");
}

export function hostFromHeaders(headers: IncomingHttpHeaders, fallbackHost?: string): string {
  const forwarded = headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const raw = forwardedHost || headers.host || fallbackHost || "";
  return normalizeHostname(typeof raw === "string" ? raw : "");
}

export function isTreemarkablesDocumentHost(hostHeader: string | undefined): boolean {
  return TREEMARKABLES_DOCUMENT_HOSTS.has(normalizeHostname(hostHeader));
}

export function requestIsTreemarkablesDocumentHost(req: Pick<Request, "headers" | "hostname">): boolean {
  return TREEMARKABLES_DOCUMENT_HOSTS.has(hostFromHeaders(req.headers, req.hostname));
}

export function isInflowIconPath(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0].toLowerCase();
  return /^\/inflow-icon(?:-[\w.]+)?\.png$/.test(pathOnly);
}

export function isWebManifestPath(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0].toLowerCase();
  return pathOnly === "/manifest.json" || pathOnly === "/manifest.webmanifest";
}

export function metaForPath(pathname: string): DocumentBrandMeta {
  const pathOnly = pathname.split("?")[0];
  const normalised = pathOnly.length > 1 && pathOnly.endsWith("/") ? pathOnly.slice(0, -1) : pathOnly || "/";
  return PAGE_META[normalised] || DEFAULT_TREEMARKABLES_META;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function canonicalUrl(canonicalPath: string): string {
  if (canonicalPath === "/") return `${TREEMARKABLES_CANONICAL_ORIGIN}/`;
  return `${TREEMARKABLES_CANONICAL_ORIGIN}${canonicalPath}`;
}

function looksLikeHtmlDocument(body: string): boolean {
  const start = body.slice(0, 512).toLowerCase();
  return start.includes("<!doctype html") || start.includes("<html");
}

function replaceOrInsertMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
): string {
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${key}["']\\s+content=["'][^"']*["']\\s*\\/?>`,
    "i",
  );
  const tag = `<meta ${attribute}="${key}" content="${escapeAttr(content)}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  const altPattern = new RegExp(
    `<meta\\s+content=["'][^"']*["']\\s+${attribute}=["']${key}["']\\s*\\/?>`,
    "i",
  );
  if (altPattern.test(html)) {
    return html.replace(altPattern, tag);
  }
  return html;
}

function brandHeadBlock(meta: DocumentBrandMeta): string {
  const canonical = canonicalUrl(meta.canonicalPath);
  const ogTitle = meta.ogTitle || meta.title;
  const ogDescription = meta.ogDescription || meta.description;
  return `${BRAND_START}
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Treemarkables" />
    <meta property="og:title" content="${escapeAttr(ogTitle)}" />
    <meta property="og:description" content="${escapeAttr(ogDescription)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(meta.ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_NZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(ogDescription)}" />
    <meta name="twitter:image" content="${escapeAttr(meta.ogImage)}" />
    <meta name="author" content="Treemarkables" />
    <meta name="robots" content="index, follow" />
    ${BRAND_END}`;
}

/**
 * Rewrite an Inflow index.html so the first byte on a Treemarkables host
 * presents Treemarkables branding. Idempotent (safe if applied twice).
 */
export function applyTreemarkablesDocumentHead(html: string, pathname: string = "/"): string {
  const meta = metaForPath(pathname);
  let next = html;

  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  next = replaceOrInsertMeta(next, "name", "description", meta.description);
  next = replaceOrInsertMeta(next, "name", "apple-mobile-web-app-title", "Treemarkables");

  next = next.replace(
    /\/inflow-icon-(\d+)\.png(?:\?[^"'\s>]*)?/gi,
    (_match, size: string) => ICON_BY_SIZE[size] || "/treemarkables-logo-green-192.png",
  );

  if (!/rel=["']icon["'][^>]*treemarkables-icon-black\.png/i.test(next)) {
    next = next.replace(
      /<link\s+rel=["']icon["'][^>]*>/i,
      '<link rel="icon" type="image/png" href="/treemarkables-icon-black.png">',
    );
  }

  const block = brandHeadBlock(meta);
  if (next.includes(BRAND_START)) {
    next = next.replace(
      new RegExp(`${BRAND_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${BRAND_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      block,
    );
  } else {
    next = next.replace(/<\/head>/i, `    ${block}\n  </head>`);
  }

  return next;
}

function invokeSendFileCallback(optionsOrCb: unknown, maybeCb: unknown, err?: Error): void {
  const cb = typeof maybeCb === "function" ? maybeCb : typeof optionsOrCb === "function" ? optionsOrCb : undefined;
  if (typeof cb === "function") {
    (cb as (error?: Error) => void)(err);
  }
}

function interceptHtmlResponses(res: Response, pathname: string): void {
  const originalSend = res.send.bind(res);
  const originalSendFile = res.sendFile.bind(res);
  const originalEnd = res.end.bind(res);

  const brand = (html: string) => applyTreemarkablesDocumentHead(html, pathname);

  res.send = ((body?: unknown) => {
    if (typeof body === "string" && looksLikeHtmlDocument(body)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      return originalSend(brand(body));
    }
    return originalSend(body as Parameters<Response["send"]>[0]);
  }) as Response["send"];

  res.sendFile = ((filePath: string, options?: unknown, callback?: unknown) => {
    const normalised = filePath.replace(/\\/g, "/");
    if (normalised.endsWith("/index.html") || normalised.endsWith("index.html")) {
      try {
        const html = fs.readFileSync(filePath, "utf8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        originalSend(brand(html));
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
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      }
      return originalEnd(brand(chunk), encoding as BufferEncoding, cb as () => void);
    }
    if (Buffer.isBuffer(chunk)) {
      const asText = chunk.toString("utf8");
      if (looksLikeHtmlDocument(asText)) {
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        }
        return originalEnd(Buffer.from(brand(asText), "utf8"), encoding as BufferEncoding, cb as () => void);
      }
    }
    return originalEnd(chunk as never, encoding as never, cb as never);
  }) as Response["end"];
}

export function createTreemarkablesDocumentBrandMiddleware(): RequestHandler {
  return function treemarkablesDocumentBrand(req, res, next) {
    if (!requestIsTreemarkablesDocumentHost(req)) {
      return next();
    }

    const pathname = (req.path || "/").split("?")[0] || "/";

    if (isWebManifestPath(pathname)) {
      res.status(200);
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(JSON.stringify(TREEMARKABLES_WEB_MANIFEST));
      return;
    }

    if (isInflowIconPath(pathname)) {
      res.status(404);
      res.setHeader("Cache-Control", "no-store");
      res.type("text/plain").send("Not found");
      return;
    }

    interceptHtmlResponses(res, pathname);
    next();
  };
}
