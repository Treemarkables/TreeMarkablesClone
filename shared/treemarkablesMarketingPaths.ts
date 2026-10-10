/**
 * Public Treemarkables marketing routes. Shared so the server prerender and
 * the client boot shell agree on which URLs must not show "Opening Inflow".
 * Logged-in app routes (/dispatch, /login, …) are not in this list.
 */

export const TREEMARKABLES_MARKETING_HOSTS = [
  "www.treemarkables.co.nz",
  "treemarkables.co.nz",
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
