/**
 * Inflow tenancy — request-scoped tenant context (AsyncLocalStorage).
 *
 * Carries, per request:
 *   - businessId: the logged-in employee's business (for write-path `withTenant`)
 *   - tenantDb:   an optional Drizzle client pinned to a pooled connection that has
 *                 `SET ROLE app_tenant` + the tenant GUC applied, so Postgres RLS
 *                 enforces isolation (Phase 2 fallback). Absent on login/cron/owner paths.
 *
 * No DB imports here (keeps this leaf module cycle-free). The pinning + RLS routing
 * live in tenantMiddleware.ts and db.ts.
 */
import { AsyncLocalStorage } from "node:async_hooks";

interface TenantCtx {
  businessId?: string;
  tenantDb?: unknown; // a Drizzle instance bound to a tenant-scoped connection
}

const als = new AsyncLocalStorage<TenantCtx>();

/** Run `fn` with a full tenant context (businessId + optional pinned tenantDb). */
export function runWithTenant<T>(ctx: TenantCtx, fn: () => T): T {
  return als.run(ctx, fn);
}

/** Run `fn` with just the businessId bound (owner path — no RLS connection). */
export function runWithBusiness<T>(businessId: string | undefined, fn: () => T): T {
  return als.run({ businessId }, fn);
}

/** The current request's business id, or undefined outside a request (cron, startup). */
export function currentBusinessId(): string | undefined {
  return als.getStore()?.businessId;
}

/** The current request's RLS-scoped Drizzle client, if one was pinned for this request. */
export function currentTenantDb(): unknown {
  return als.getStore()?.tenantDb;
}

/**
 * Stamp an insert payload with the current tenant. No context → leaves it off so the
 * DB column default applies. Required so inserts satisfy the RLS WITH CHECK under the
 * app_tenant role (business_id must equal the tenant GUC).
 */
export function withTenant<T extends object>(values: T): T & { businessId?: string } {
  const businessId = currentBusinessId();
  return businessId ? { ...values, businessId } : values;
}
