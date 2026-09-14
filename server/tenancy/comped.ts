/**
 * Inflow — "Comped" businesses: full Business tier + every add-on + no usage
 * caps, without any subscription/Stripe rows. The single source of truth for
 * "is this tenant free for life?" — used by resolveEntitlements (feature gates)
 * and usageMeter (SMS / AI / job caps). Keep the two in lockstep by going
 * through here, never by re-deriving the rule locally.
 *
 * Three ways a business is comped, checked in order:
 *   1. Treemarkables itself (platform owner, prod + dev-branch ids) — always.
 *      Flipping enforcement on must never lock the owner out of its own product.
 *   2. INFLOW_COMPED_BUSINESS_IDS env (comma-separated) — legacy, needs a redeploy
 *      to change; kept so existing grants keep working.
 *   3. businesses.comped_at IS NOT NULL — set from the concierge page
 *      (PUT /api/admin/subscribers/:id/comp). No redeploy, audited, reversible.
 *
 * The DB flag is cached per business for a short TTL (it's read on nearly every
 * authenticated request via resolveEntitlements) and invalidated by the writer
 * (storage.setBusinessComped). A DB error fails CLOSED (not comped) — the tenant
 * then falls through to ordinary plan resolution rather than getting a free ride.
 */

import { eq } from "drizzle-orm";
import { ownerDb } from "../db";
import * as schema from "@shared/schema";
import { TREEMARKABLES_BUSINESS_IDS } from "@shared/roleChecklistAccess";
import { cacheGet, cacheSet, cacheDelete } from "../perfCache";

const ENV_COMPED = new Set(
  (process.env.INFLOW_COMPED_BUSINESS_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);

const COMPED_TTL_MS = 60_000;

/** Sync part: owner + env list. No DB. */
export function isCompedStatic(businessId: string): boolean {
  return ENV_COMPED.has(businessId) || TREEMARKABLES_BUSINESS_IDS.includes(businessId);
}

/** Full check: static rules OR the concierge DB flag. */
export async function isCompedBusiness(businessId: string): Promise<boolean> {
  if (!businessId) return false;
  if (isCompedStatic(businessId)) return true;

  const key = `comp:${businessId}`;
  const cached = cacheGet<boolean>(key);
  if (cached !== undefined) return cached;

  let comped = false;
  try {
    // businesses is the global tenant registry (no tenant scoping) — read as owner
    // so the answer is the same from a request, a cron, or a webhook context.
    const [row] = await ownerDb
      .select({ compedAt: schema.businesses.compedAt })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId))
      .limit(1);
    comped = !!row?.compedAt;
  } catch (err) {
    console.error(`[comped] lookup failed for business=${businessId}:`, err);
    return false; // fail closed, and don't cache the failure
  }
  cacheSet(key, comped, COMPED_TTL_MS);
  return comped;
}

export function invalidateCompedCache(businessId: string): void {
  cacheDelete(`comp:${businessId}`);
}
