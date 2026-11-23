/**
 * Cache policy and build checks for the Vite shell that wraps the
 * Treemarkables prerender.
 *
 * The marketing snapshot is injected per request into this instance's
 * index.html. The script and stylesheet names in that file come from the
 * Vite build that produced the file. They are not stored in a memory cache.
 * A rolling deploy still mixes two images, so a page from one build can ask
 * for a hashed file that only the other build has. Missing /assets responses
 * must not be HTML, and HTML itself must not be stored by the edge.
 */
import fs from "fs";
import path from "path";

export const HTML_CACHE_CONTROL = "no-cache, no-store, must-revalidate";
export const HASHED_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const MISSING_ASSET_CACHE_CONTROL = "no-store";

const MISSING_ASSET_URL = /\.(js|css|map|woff|woff2|ttf|png|jpg|svg|ico)(\?.*)?$/;

export interface HeaderWriter {
  setHeader(name: string, value: string): void;
}

export interface ManifestChunk {
  file?: string;
  isEntry?: boolean;
  css?: string[];
  imports?: string[];
}

export function applyHtmlCacheHeaders(res: HeaderWriter): void {
  res.setHeader("Cache-Control", HTML_CACHE_CONTROL);
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

export function applyHashedAssetCacheHeaders(res: HeaderWriter): void {
  res.setHeader("Cache-Control", HASHED_ASSET_CACHE_CONTROL);
  res.setHeader("CDN-Cache-Control", HASHED_ASSET_CACHE_CONTROL);
  res.setHeader("Cloudflare-CDN-Cache-Control", HASHED_ASSET_CACHE_CONTROL);
}

export function isMissingStaticAsset(originalUrl: string): boolean {
  return originalUrl.startsWith("/assets/") || MISSING_ASSET_URL.test(originalUrl);
}

export function contentTypeForAsset(pathname: string): string {
  const pathOnly = pathname.split("?")[0].split("#")[0].toLowerCase();
  if (pathOnly.endsWith(".js") || pathOnly.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (pathOnly.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathOnly.endsWith(".map")) return "application/json; charset=utf-8";
  if (pathOnly.endsWith(".woff2")) return "font/woff2";
  if (pathOnly.endsWith(".woff")) return "font/woff";
  if (pathOnly.endsWith(".ttf")) return "font/ttf";
  if (pathOnly.endsWith(".png")) return "image/png";
  if (pathOnly.endsWith(".jpg") || pathOnly.endsWith(".jpeg")) return "image/jpeg";
  if (pathOnly.endsWith(".svg")) return "image/svg+xml";
  if (pathOnly.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

export function missingAssetBody(pathname: string): string {
  const type = contentTypeForAsset(pathname);
  if (type.startsWith("application/javascript") || type.startsWith("text/css")) {
    return "/* asset not found */\n";
  }
  if (type.startsWith("application/json")) return "{}\n";
  return "";
}

export interface AssetResponseWriter extends HeaderWriter {
  status(code: number): unknown;
  end(chunk?: unknown, encoding?: unknown, cb?: unknown): unknown;
}

/** 404 for a hashed file this process does not have. Never an HTML document. */
export function writeMissingAsset(res: AssetResponseWriter, pathname: string): void {
  res.status(404);
  res.setHeader("Content-Type", contentTypeForAsset(pathname));
  res.setHeader("Cache-Control", MISSING_ASSET_CACHE_CONTROL);
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const body = missingAssetBody(pathname);
  if (looksLikeHtmlDocument(body)) {
    throw new Error("Refusing to send an HTML body for a missing asset");
  }
  res.end(body);
}

export function looksLikeHtmlDocument(body: string): boolean {
  const start = body.slice(0, 512).trimStart().toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}

export function extractAssetRefs(html: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const pattern = /(?:src|href)\s*=\s*["'](\/assets\/[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const ref = match[1].split("?")[0].split("#")[0];
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

export function safeAssetBasename(ref: string): string | null {
  const name = ref.split("?")[0].split("#")[0].split("/").pop() || "";
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(name)) return null;
  return name;
}

export function hasStylesheetLink(html: string): boolean {
  return (
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\/assets\/[^"']+\.css["'][^>]*>/i.test(html) ||
    /<link\b[^>]*href=["']\/assets\/[^"']+\.css["'][^>]*rel=["']stylesheet["'][^>]*>/i.test(html)
  );
}

export function toAssetHref(file: string): string {
  return `/${file.replace(/^\/+/, "")}`;
}

export function collectEntryAssetHrefs(manifest: Record<string, ManifestChunk>): { js: string[]; css: string[] } {
  const entryKeys = Object.keys(manifest).filter((key) => manifest[key]?.isEntry);
  if (entryKeys.length === 0) {
    throw new Error("Vite manifest has no entry chunk, so the prerender cannot be tied to this build.");
  }
  const js: string[] = [];
  const css: string[] = [];
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    if (chunk.file) js.push(toAssetHref(chunk.file));
    for (const file of chunk.css || []) css.push(toAssetHref(file));
    for (const imported of chunk.imports || []) visit(imported);
  };
  for (const key of entryKeys) visit(key);
  return { js, css };
}

function htmlReferences(html: string, href: string): boolean {
  return html.includes(href) || html.includes(href.replace(/^\//, ""));
}

const MODULE_SCRIPT = /<script\b[^>]*type=["']module["'][^>]*>/i;
const ASSET_STYLESHEET = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\/assets\/[^"']+\.css["'][^>]*>|<link\b[^>]*href=["']\/assets\/[^"']+\.css["'][^>]*rel=["']stylesheet["'][^>]*>/i;

/** True when the built stylesheet is in the document before the entry module. */
export function stylesheetPrecedesEntryScript(html: string): boolean {
  const linkAt = html.search(ASSET_STYLESHEET);
  if (linkAt === -1) return false;
  const scriptAt = html.search(MODULE_SCRIPT);
  if (scriptAt === -1) return true;
  return linkAt < scriptAt;
}

/**
 * Put this build's stylesheet before the deferred entry module. A link after
 * that script is discovered late, and the first paint can be unstyled HTML.
 */
export function placeAssetStylesheet(html: string, href: string): string {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = new RegExp(`\\n?\\s*<link\\b[^>]*href=["']${escaped}["'][^>]*>\\s*`, "gi");
  const without = html.replace(existing, "\n");
  const link = `    <link rel="stylesheet" crossorigin href="${href}">`;
  if (MODULE_SCRIPT.test(without)) {
    return without.replace(MODULE_SCRIPT, `${link}\n    $&`);
  }
  if (!/<\/head>/i.test(without)) {
    throw new Error("index.html has no </head>, so the stylesheet link cannot be added.");
  }
  return without.replace(/<\/head>/i, `${link}\n  </head>`);
}

/**
 * Make index.html name the same JS and CSS files as the Vite manifest from
 * this build. Inserts a stylesheet link when Vite emitted CSS but the HTML
 * has no tag for it, and moves that link ahead of the entry module. Refuses
 * a shell whose entry script is a different file.
 */
export function alignIndexHtmlWithManifest(html: string, manifest: Record<string, ManifestChunk>): string {
  const { js, css } = collectEntryAssetHrefs(manifest);
  const entryJs: string[] = [];
  for (const chunk of Object.values(manifest)) {
    if (chunk.isEntry && chunk.file) entryJs.push(toAssetHref(chunk.file));
  }
  for (const href of entryJs) {
    if (!htmlReferences(html, href)) {
      throw new Error(
        `index.html does not reference this build's entry script ${href}. Refusing to serve a prerender from a different Vite build.`,
      );
    }
  }
  let next = html;
  for (const href of css) {
    next = placeAssetStylesheet(next, href);
  }
  if (!hasStylesheetLink(next)) {
    const listed = css.length ? css.join(", ") : "(none listed on the entry)";
    throw new Error(
      `Prerendered index.html has no /assets stylesheet link (manifest CSS: ${listed}). The page would be unstyled until JavaScript runs.`,
    );
  }
  if (MODULE_SCRIPT.test(next) && !stylesheetPrecedesEntryScript(next)) {
    throw new Error(
      "Prerendered index.html loads the entry script before the /assets stylesheet. The first paint would be unstyled.",
    );
  }
  if (js.length === 0) {
    throw new Error("Vite manifest entry has no JavaScript file.");
  }
  return next;
}

export function missingBuiltAssets(html: string, fileNamesOnDisk: ReadonlySet<string>): string[] {
  const missing: string[] = [];
  for (const ref of extractAssetRefs(html)) {
    const name = safeAssetBasename(ref);
    if (!name || !fileNamesOnDisk.has(name)) missing.push(ref);
  }
  return missing;
}

export function assertPrerenderHtmlAssets(html: string, fileNamesOnDisk: ReadonlySet<string>): void {
  if (!hasStylesheetLink(html)) {
    throw new Error(
      "Prerendered HTML has no /assets stylesheet link. The marketing page would be unstyled until JavaScript runs.",
    );
  }
  const missing = missingBuiltAssets(html, fileNamesOnDisk);
  if (missing.length > 0) {
    throw new Error(`Prerendered HTML references files that are not in this build: ${missing.join(", ")}`);
  }
}

export function assetFileNames(staticDir: string): Set<string> {
  const assetsDir = path.join(staticDir, "assets");
  const names = new Set<string>();
  if (!fs.existsSync(assetsDir)) return names;
  for (const name of fs.readdirSync(assetsDir)) {
    if (safeAssetBasename(name)) names.add(name);
  }
  return names;
}

/** Fail startup when this image's index.html points at files it did not ship. */
export function assertBuiltPrerenderDir(staticDir: string, brand?: (html: string) => string): void {
  const indexPath = path.join(staticDir, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const branded = brand ? brand(html) : html;
  try {
    assertPrerenderHtmlAssets(branded, assetFileNames(staticDir));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Prerender asset check failed for ${staticDir}: ${message}`);
  }
}
