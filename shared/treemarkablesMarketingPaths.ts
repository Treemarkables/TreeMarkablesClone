/**
 * Public Treemarkables marketing routes. Shared so the server prerender and
 * the client boot shell agree on which URLs must not show "Opening Inflow".
 * Logged-in app routes (/dispatch, /login, …) are not in this list.
 */

export const TREEMARKABLES_MARKETING_HOSTS = [
  "www.treemarkables.co.nz",
  "treemarkables.co.nz",
] as const;

/** Legacy staff host. The iOS shell and logged-in app still enter at `/` here. */
export const TREEMARKABLES_APP_HOST = "app.treemarkables.co.nz";

export const TREEMARKABLES_WWW_ORIGIN = "https://www.treemarkables.co.nz";

/**
 * App routes that must never 301 off app.treemarkables.co.nz, even if a
 * public prefix is later widened. `/invoice` does not match `/invoices`.
 */
export const APP_HOST_NEVER_REDIRECT_PREFIXES = [
  "/login",
  "/dashboard",
  "/api",
  "/dispatch",
  "/proposal",
  "/invoice",
  "/portal",
  "/customer-portal",
  "/quote",
  "/watch",
  "/review",
  "/objects",
  "/assets",
  "/health",
  "/signup",
] as const;

export const TREEMARKABLES_PUBLIC_PREFIXES = [
  "/tree-removal",
  "/tree-pruning",
  "/stump-grinding",
  "/hedge-trimming",
  "/summer-offer",
  "/blog",
  "/contact",
  "/privacy-policy",
] as const;

export function normalisePublicPath(pathname: string): string {
  const pathOnly = (pathname.split("?")[0] || "/").trim();
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
  return pathOnly || "/";
}

export function isTreemarkablesPublicPath(pathname: string): boolean {
  const path = normalisePublicPath(pathname);
  if (path === "/" || path === "/home") return true;
  return TREEMARKABLES_PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isTreemarkablesAppHostName(hostname: string | undefined): boolean {
  if (!hostname) return false;
  const first = hostname.split(",")[0] ?? "";
  const host = first.split(":")[0].trim().toLowerCase().replace(/\.$/, "");
  return host === TREEMARKABLES_APP_HOST;
}

function hasPathPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isAppHostNeverRedirectPath(pathname: string): boolean {
  const path = normalisePublicPath(pathname);
  if (path === "/robots.txt") return true;
  return APP_HOST_NEVER_REDIRECT_PREFIXES.some((prefix) => hasPathPrefix(path, prefix));
}

/** File-like URLs (JS, images, icons). `/sitemap.xml` is a marketing document, not an asset. */
export function isStaticAssetPath(pathname: string): boolean {
  const path = normalisePublicPath(pathname);
  if (path === "/sitemap.xml") return false;
  return /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|json|webmanifest|pdf|mp4|webm|vtt|txt|xml|html)$/i.test(path);
}

/**
 * Public marketing URLs that 301 from the app host to www.
 * `/` is excluded: on this host it is the app shell (logged-in → dispatch,
 * native Capacitor → login).
 */
export function isAppHostMarketingRedirectPath(pathname: string): boolean {
  const path = normalisePublicPath(pathname);
  if (path === "/sitemap.xml") return true;
  if (path === "/") return false;
  if (isAppHostNeverRedirectPath(path)) return false;
  if (isStaticAssetPath(path)) return false;
  return isTreemarkablesPublicPath(path);
}

/** Marketing pages on the legacy app host must not be indexed. www stays indexable. */
export function marketingRobotsContent(hostname: string | undefined): "noindex, follow" | "index, follow" {
  return isTreemarkablesAppHostName(hostname) ? "noindex, follow" : "index, follow";
}
