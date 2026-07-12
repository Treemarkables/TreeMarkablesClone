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
import { TREEMARKABLES_BUSINESS_IDS } from "@shared/roleChecklistAccess";
import { cacheGet, cacheSet, cacheDelete } from "../perfCache";
import type { Entitlement, Capability } from "./capabilities";

const PLAN_RANK: Record<string, number> = { freemium: 0, crew: 1, business: 2 };

/** Every add-on entitlement in the catalog — granted wholesale to comped businesses. */
const ALL_ADDON_ENTITLEMENTS: Entitlement[] = [
  "addon:call_recording",
  "addon:ai",
  "addon:sms",
  "addon:voice_agent",
];

/**
 * Comped businesses get full Business-tier + every add-on, no subscription rows
 * needed. Treemarkables (platform owner, both prod + dev-branch ids) is always
 * comped — same footgun-avoidance as usageMeter.ts: flipping enforcement on must
 * never lock the owner out of its own product. Extra ids via env (comma-separated).
 */
const COMPED = new Set(
  (process.env.INFLOW_COMPED_BUSINESS_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);
function isComped(businessId: string): boolean {
  return COMPED.has(businessId) || TREEMARKABLES_BUSINESS_IDS.includes(businessId);
}

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

// Entitlements are read on nearly every authenticated request (auth/me, feature
// gates, permission filtering) but change only on billing events — cache the
// resolved result per business for a short TTL, invalidated by the subscription
// writers (billing.syncFromStripeSubscription, setSubscriptionPlanForBusiness).
// At ~90-100ms per cross-region query this saves up to 3 sequential round trips
// per request. NOTE: add-on rows currently change only via manual SQL (no
// purchase path yet) — those edits take up to the TTL to appear.
const ENTITLEMENTS_TTL_MS = 60_000;

export function invalidateEntitlementsCache(businessId: string): void {
  cacheDelete(`ent:${businessId}`);
}

/** Resolve a business's plan + active add-ons into its unlocked entitlement set. */
export async function resolveEntitlements(businessId: string): Promise<BusinessEntitlements> {
  if (isComped(businessId)) {
    return {
      planKey: "business",
      entitlements: new Set<Entitlement>(["plan:crew", "plan:business", ...ALL_ADDON_ENTITLEMENTS]),
    };
  }

  // Cache key binds the explicit businessId argument — safe in any context.
  // Return a defensive copy of the Set so a caller mutating its result can
  // never poison the cached entry.
  const cached = cacheGet<BusinessEntitlements>(`ent:${businessId}`);
  if (cached) {
    return { planKey: cached.planKey, entitlements: new Set(cached.entitlements) };
  }

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

  cacheSet(`ent:${businessId}`, { planKey, entitlements }, ENTITLEMENTS_TTL_MS);
  // Hand the caller its own copy — the cached Set must stay pristine.
  return { planKey, entitlements: new Set(entitlements) };
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
// Tier gates (plan:crew / plan:business) plus the first add-on gate: calls.
// Comped businesses (Treemarkables + INFLOW_COMPED_BUSINESS_IDS) get every
// add-on from resolveEntitlements, so gating an add-on here no longer strips
// the owner. Remaining add-on gates (sms, ai) are still deferred.
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
  // Advanced analytics & job costing — moved down to Crew (now on both paid
  // tiers), per the 2026-06-22 plan revision.
  "reporting.export": "plan:crew",
  "reporting.metrics": "plan:crew",
  // Calls — paid add-on on any tier (capabilities.ts "Calls / voice"). Sidebar +
  // page gate on the same entitlement via PlanGate/UpgradeGate.
  "calls.view": "addon:call_recording",
  "calls.make": "addon:call_recording",
  // NOTE (2026-06-22): marketing/reputation removed from the offering, so
  // reviews.* are no longer tier-gated here (the capability still exists in code
  // for the comped Treemarkables tenant, just isn't a sold differentiator).
  // With marketing gone and analytics moved to Crew, NO live permission key is
  // gated to plan:business — Business now differs only by job cap, SMS/AI
  // allowance, support, and card fee (none of which live in this map).
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
