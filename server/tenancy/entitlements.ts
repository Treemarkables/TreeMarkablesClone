/**
 * Inflow — Entitlements layer (Phase 4 billing).
 *
 * Resolves a business's active subscription + add-ons into the set of unlocked
 * `Entitlement` strings, then answers "does this business satisfy a capability's
 * `requires` gate?". This is the bridge between billing (what the business PAID
 * for) and RBAC (what a staff member CAN do): effective permission =
 * role grants ∩ business entitlements (SAAS plan §"Entitlements vs permissions").
 *
 * Source of truth for what each gate means is server/tenancy/capabilities.ts.
 *
 * STATUS: built but not yet enforced — requireCapability() wiring is Phase 3/4
 * follow-up. Importing this changes no runtime behaviour on its own.
 *
 * Tier model: freemium < crew < business. A higher tier satisfies lower-tier
 * plan gates (a Business subscriber satisfies `plan:crew` too). Add-ons are flat
 * `addon:<key>` grants, independent of tier.
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Entitlement, Capability } from "./capabilities";

const PLAN_RANK: Record<string, number> = { freemium: 0, crew: 1, business: 2 };

export interface BusinessEntitlements {
  planKey: string;
  entitlements: Set<Entitlement>;
}

/**
 * A subscription status counts as "entitled" through dunning: entitlements stay
 * ON during `past_due` (transient bank glitch shouldn't punish), per the plan's
 * billing-lifecycle. Only `canceled`/`incomplete` drop to freemium.
 */
function isEntitledStatus(status: string): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Resolve a business's plan + active add-ons into its unlocked entitlement set. */
export async function resolveEntitlements(businessId: string): Promise<BusinessEntitlements> {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.businessId, businessId))
    .limit(1);

  // Resolve the plan via the FK (subscriptions.plan_id → subscription_plans.key).
  // No subscription / dead status / missing plan → freemium. Fail-closed.
  let planKey = "freemium";
  if (sub && isEntitledStatus(sub.status) && sub.planId) {
    const [plan] = await db
      .select({ key: schema.subscriptionPlans.key })
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, sub.planId))
      .limit(1);
    if (plan?.key) planKey = plan.key;
  }

  const entitlements = new Set<Entitlement>();
  const rank = PLAN_RANK[planKey] ?? 0;
  if (rank >= PLAN_RANK.crew) entitlements.add("plan:crew");
  if (rank >= PLAN_RANK.business) entitlements.add("plan:business");

  // Active add-ons → addon:<key>, resolved through add_ons.id.
  const addons = await db
    .select({ key: schema.addOns.key })
    .from(schema.businessAddOns)
    .innerJoin(schema.addOns, eq(schema.businessAddOns.addOnId, schema.addOns.id))
    .where(
      and(
        eq(schema.businessAddOns.businessId, businessId),
        eq(schema.businessAddOns.status, "active"),
      ),
    );
  for (const a of addons) entitlements.add(`addon:${a.key}` as Entitlement);

  return { planKey, entitlements };
}

/** Does an entitlement set satisfy a capability's `requires` gate? null = always available. */
export function hasEntitlement(entitlements: Set<Entitlement>, requires: Entitlement | null): boolean {
  if (requires === null) return true;
  return entitlements.has(requires);
}

/**
 * The subset of the capability catalog a business has unlocked — i.e. what the
 * RBAC settings page is allowed to grant. Gated-but-locked caps are everything
 * in `catalog` minus this.
 */
export function unlockedCapabilities(entitlements: Set<Entitlement>, catalog: Capability[]): Capability[] {
  return catalog.filter((c) => hasEntitlement(entitlements, c.requires));
}

// ============================================================================
// Entitlement gating of the LIVE permission system (shared/permissions.ts keys).
//
// The live RBAC keys (~50) are a different, smaller set than capabilities.ts.
// This maps the live keys that should be gated behind a subscription tier to
// the entitlement that unlocks them. Keys NOT in this map are ungated (core
// features available on every tier — jobs, customers, quotes, invoices, etc.).
//
// TIER GATES ONLY for now (plan:crew / plan:business). Add-on gates (calls,
// sms, ai, payments) are intentionally DEFERRED — gating them would strip the
// comped Treemarkables (Business, no add-ons) of features it uses today.
// Placement follows the feature→tier mapping in INFLOW_SAAS_PLAN.md.
// ============================================================================
export const PERMISSION_ENTITLEMENTS: Record<string, Entitlement> = {
  // Crew tier — dispatch board, equipment register, advanced finance,
  // custom RBAC, integrations.
  "dispatch.view": "plan:crew",
  "dispatch.manage": "plan:crew",
  "equipment.view": "plan:crew",
  "equipment.manage": "plan:crew",
  "reconciliation.view": "plan:crew",
  "reconciliation.manage": "plan:crew",
  "profitability.view": "plan:crew",
  "staff.manage_permissions": "plan:crew",
  "settings.integrations": "plan:crew",
  // Business tier — marketing/reputation + advanced analytics.
  "reviews.view": "plan:business",
  "reviews.respond": "plan:business",
  "reporting.export": "plan:business",
  "reporting.metrics": "plan:business",
};

/**
 * Intersect a resolved permission set with a business's entitlements: drop any
 * permission key whose required tier the business hasn't unlocked. Ungated keys
 * (not in PERMISSION_ENTITLEMENTS) always pass. A Business subscriber keeps
 * everything (satisfies plan:crew + plan:business); a Freemium one loses all
 * gated keys.
 */
export function filterPermissionsByEntitlements(
  perms: Set<string>,
  entitlements: Set<Entitlement>,
): Set<string> {
  const out = new Set<string>();
  for (const key of perms) {
    const required = PERMISSION_ENTITLEMENTS[key];
    if (!required || entitlements.has(required)) out.add(key);
  }
  return out;
}
