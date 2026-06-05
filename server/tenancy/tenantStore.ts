/**
 * Inflow tenancy — request-scoped tenant context (write-path).
 *
 * Uses AsyncLocalStorage so the current request's business id is available deep in
 * the data layer WITHOUT threading a parameter through hundreds of storage methods.
 * `tenantStoreMiddleware` binds it from the session; `withTenant()` stamps it onto
 * insert payloads.
 *
 * Single-tenant today: every logged-in employee resolves to the Treemarkables id, so
 * this matches the DB column default. Its real job is correctness once tenant #2 exists
 * — then each request runs inside its own tenant context and inserts get the right owner
 * instead of silently defaulting to Treemarkables.
 *
 * Read isolation is handled separately by RLS (Phase 2), not here.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";

interface TenantCtx {
  businessId?: string;
}

const als = new AsyncLocalStorage<TenantCtx>();

/** Run `fn` with `businessId` bound to the async context. */
export function runWithBusiness<T>(businessId: string | undefined, fn: () => T): T {
  return als.run({ businessId }, fn);
}

/** The current request's business id, or undefined outside a request (cron, startup). */
export function currentBusinessId(): string | undefined {
  return als.getStore()?.businessId;
}

/**
 * Stamp an insert payload with the current tenant. If there's no context (background
 * work), leaves `businessId` off so the DB column default (Treemarkables, single-tenant
 * period) applies — never guesses a wrong owner.
 */
export function withTenant<T extends object>(values: T): T & { businessId?: string } {
  const businessId = currentBusinessId();
  return businessId ? { ...values, businessId } : values;
}

/** Express middleware: bind the logged-in employee's business to the async context. */
export function tenantStoreMiddleware(req: Request, _res: Response, next: NextFunction): void {
  runWithBusiness(req.session?.businessId, () => next());
}
