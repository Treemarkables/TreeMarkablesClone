// ============================================================================
// perfCache — tiny in-process TTL cache for read-mostly per-request lookups.
//
// WHY: the app runs in Singapore against a Sydney database, so every query is a
// ~90-100ms round trip, and the hottest lookups (entitlements, business
// settings, role tiers) are re-queried on nearly every authenticated request —
// /api/auth/me alone re-resolved all three. Caching them for a short TTL
// removes several sequential round trips from most requests.
//
// TENANT SAFETY: this process serves multiple tenants over the same code path.
// Every key MUST bind the tenant (an explicit businessId, or the request's
// AsyncLocalStorage businessId). Call sites that run WITHOUT a tenant context
// (webhooks, crons, owner/concierge paths) must skip the cache entirely rather
// than guess a key — a wrong key is a cross-tenant leak, a skipped cache is
// just a query.
//
// STALENESS: writers invalidate synchronously in this process, so same-instance
// reads are fresh immediately. If a second app instance is ever run against the
// same DB, its staleness is bounded by the TTL (worst case: a revoked
// permission/plan change takes up to TTL to apply there). TTLs are kept short
// for that reason.
// ============================================================================

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

// Opportunistic sweep so long-idle processes don't accumulate dead entries.
// (Map size is tiny — a few entries per active tenant — so this is hygiene,
// not memory pressure.)
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, e] of store) {
    if (e.expiresAt <= now) store.delete(k);
  }
}

export function cacheGet<T>(key: string): T | undefined {
  const now = Date.now();
  sweep(now);
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

/** Drop every key starting with `prefix` — for writers that can't name the exact key. */
export function cacheDeletePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
