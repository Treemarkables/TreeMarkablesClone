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
// Tier gates (plan:crew / plan:business) AND add-on gates (sms, call_recording).
// Add-on gates flip the SMS/Calls UI on/off with the matching add-on. They only
// bite when ENTITLEMENT_ENFORCEMENT is ON — before flipping that flag, every
// business that uses these features (incl. comped Treemarkables) must have the
// add-on activated, or it loses them. The AI add-on has no RBAC key and is gated
// at the route level via requireEntitlement("addon:ai") instead.
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
  // Add-ons — cost-incurring extras. Each key is intersected away unless the
  // business has switched the matching add-on on.
  "sms.send": "addon:sms",
  "calls.view": "addon:call_recording",
  "calls.make": "addon:call_recording",
};

/**
 * Intersect a resolved permission set with a business's entitlements: drop any
 * permission key whose required tier the business hasn't unlocked. Ungated keys
 * (not in PERMISSION_ENTITLEMENTS) always pass. A Business subscriber keeps
 * everything (satisfies plan:crew + plan:business); a Freemium one loses all
 * gated keys.
 *
 * SUPERSEDED by filterPermissionsByFeatureSet (matrix-driven). Kept for reference.
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

// ============================================================================
// MATRIX-DRIVEN gating (the tier feature-matrix is the source of truth).
//
// Maps each gated LIVE RBAC key (shared/permissions.ts) to the CAPABILITY key
// (server/tenancy/capabilities.ts) whose presence in a business's plan feature
// set unlocks it. The two key spaces were authored separately, so the names
// don't always match 1:1 — this is the bridge. Keys NOT in this map are core
// (available on every tier) and never gated.
//
// A whole feature AREA can be gated by one capability: every live `safety.*`
// key maps to `safety.view`, so ticking/unticking Safety for a tier flips the
// entire safety surface for that tier.
// ============================================================================
export const PERMISSION_TO_CAPABILITY: Record<string, string> = {
  // Jobs & Dispatch
  "dispatch.view": "dispatch.view",
  "dispatch.manage": "dispatch.manage",
  // Finance (advanced)
  "reconciliation.view": "reconciliation.view",
  "reconciliation.manage": "reconciliation.manage",
  "profitability.view": "profitability.view",
  // Staff & scheduling
  "staff.manage_permissions": "permissions.manage",
  "schedule.view": "staffSchedule.view",
  "schedule.manage": "staffSchedule.manage",
  "timetracking.view_all": "timeTracking.view",
  "timetracking.edit": "timeTracking.manage",
  // Safety & compliance — whole area gated by the Safety hub capability
  "safety.jha.view": "safety.view",
  "safety.jha.create": "safety.view",
  "safety.jha.manage_templates": "safety.view",
  "safety.nearmiss.view": "safety.view",
  "safety.nearmiss.report": "safety.view",
  "safety.inductions.view": "safety.view",
  "safety.inductions.manage": "safety.view",
  "safety.inspections.view": "safety.view",
  "safety.inspections.create": "safety.view",
  "safety.inspections.manage_templates": "safety.view",
  // Communications
  "inbox.view": "inbox.view",
  "inbox.send": "inbox.reply",
  "sms.send": "sms.send",
  "calls.view": "calls.view",
  "calls.make": "calls.record",
  "reviews.view": "reputation.view",
  "reviews.respond": "reviews.manage",
  "templates.manage": "commTemplates.manage",
  // Inventory & Equipment
  "materials.manage": "materials.manage",
  "equipment.view": "equipment.view",
  "equipment.manage": "equipment.manage",
  // Reporting & Analytics (advanced)
  "reporting.metrics": "analytics.advanced",
  "reporting.export": "analytics.advanced",
  // Settings
  "settings.integrations": "integrations.view",
  "settings.templates": "documents.build",
};

/**
 * Drop any RBAC permission key whose mapped capability is NOT in the business's
 * plan feature set (from the tier matrix). Unmapped keys are core → always kept.
 * `featureSet` is capability keys (server/tierMatrix.getBusinessFeatureSet).
 */
export function filterPermissionsByFeatureSet(
  perms: Set<string>,
  featureSet: Set<string>,
): Set<string> {
  const out = new Set<string>();
  for (const key of perms) {
    const cap = PERMISSION_TO_CAPABILITY[key];
    if (!cap || featureSet.has(cap)) out.add(key);
  }
  return out;
}
