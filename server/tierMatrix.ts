/**
 * Inflow — tier feature-matrix.
 *
 * Powers the platform-operator UI for deciding which features each subscription tier
 * includes. Rows = the code-defined capability catalog (server/tenancy/capabilities.ts);
 * columns = the active subscription plans; cells = a per-tier checkbox.
 *
 * Storage is the isolated `plan_features` table (one row per plan, a jsonb array of
 * capability keys). It's queried ONLY here — never by the billing/checkout path — so a
 * missing table degrades gracefully: the matrix still renders off the code defaults
 * (derived from each capability's `requires` gate), you just can't SAVE until the table
 * exists (run INFLOW_TIER_MATRIX.sql).
 */
import { db } from "./db";
import { planFeatures, planLimits, type SubscriptionPlan } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { CAPABILITY_CATALOG, type Capability } from "./tenancy/capabilities";
import { resolveEntitlements } from "./tenancy/entitlements";
import { getActivePlans, getSubscriptionByBusiness, getPlanById } from "./billing";

// Code-defined capacity dimensions (the rows of the usage-limits grid). value
// semantics in plan_limits: NULL = unlimited, 0 = none, n = the cap.
export interface LimitDimension { key: string; label: string; unit: string }
export const LIMIT_CATALOG: LimitDimension[] = [
  { key: "activeJobs", label: "Active jobs / month", unit: "jobs" },
  { key: "seats", label: "Users / seats", unit: "users" },
  { key: "photosPerJob", label: "Photos / job", unit: "photos" },
  { key: "smsPerMonth", label: "SMS / month", unit: "messages" },
  { key: "aiPerMonth", label: "AI requests / month", unit: "requests" },
];
const VALID_LIMIT_KEYS = new Set(LIMIT_CATALOG.map((l) => l.key));

// Rank by stable plan key (matches entitlements.ts). Unknown keys fall back to sortOrder.
const PLAN_RANK: Record<string, number> = { freemium: 0, crew: 1, business: 2 };
const VALID_KEYS = new Set(CAPABILITY_CATALOG.map((c) => c.key));

function planRank(plan: Pick<SubscriptionPlan, "key" | "sortOrder">): number {
  return PLAN_RANK[plan.key] ?? plan.sortOrder ?? 0;
}

/**
 * The DEFAULT feature set for a plan, derived from each capability's `requires` gate —
 * what the checkboxes show before anyone has saved an override. Tier gates fill down
 * (a Business plan includes plan:crew features); add-on-gated features are OFF by default
 * (they're bought separately, tier-agnostic) but still appear as rows so a tier CAN
 * choose to bundle one.
 */
export function defaultFeaturesForPlan(plan: Pick<SubscriptionPlan, "key" | "sortOrder">): string[] {
  const rank = planRank(plan);
  return CAPABILITY_CATALOG.filter((c) => {
    if (c.requires === null) return true;
    if (c.requires === "plan:crew") return rank >= PLAN_RANK.crew;
    if (c.requires === "plan:business") return rank >= PLAN_RANK.business;
    return false; // addon:* — not a tier default
  }).map((c) => c.key);
}

/** Saved overrides keyed by plan key. Empty map if the table doesn't exist yet. */
async function getSavedFeatures(): Promise<Map<string, string[]>> {
  try {
    const rows = await db.select().from(planFeatures);
    return new Map(rows.map((r) => [r.planKey, r.features ?? []]));
  } catch {
    return new Map(); // table not migrated yet → fall back to code defaults
  }
}

/** Saved usage caps keyed by plan, then dimension. Empty if the table isn't migrated. */
async function getSavedLimits(): Promise<Map<string, Record<string, number | null>>> {
  try {
    const rows = await db.select().from(planLimits);
    const map = new Map<string, Record<string, number | null>>();
    for (const r of rows) {
      const m = map.get(r.planKey) ?? {};
      m[r.limitKey] = r.value;
      map.set(r.planKey, m);
    }
    return map;
  } catch {
    return new Map();
  }
}

export interface TierMatrix {
  modules: { module: string; capabilities: Capability[] }[];
  limitDimensions: LimitDimension[];
  tiers: { key: string; name: string; priceNzd: string; features: string[]; limits: Record<string, number | null> }[];
}

/** Build the full matrix payload: catalog grouped by module + each tier's effective set. */
export async function buildTierMatrix(): Promise<TierMatrix> {
  const [plans, saved, savedLimits] = await Promise.all([getActivePlans(), getSavedFeatures(), getSavedLimits()]);

  // Group the catalog by module, preserving first-seen module order.
  const modules: TierMatrix["modules"] = [];
  const byModule = new Map<string, Capability[]>();
  for (const cap of CAPABILITY_CATALOG) {
    if (!byModule.has(cap.module)) {
      byModule.set(cap.module, []);
      modules.push({ module: cap.module, capabilities: byModule.get(cap.module)! });
    }
    byModule.get(cap.module)!.push(cap);
  }

  const tiers = plans.map((p) => {
    // Each dimension defaults to null (unlimited) when nothing is saved for it.
    const lim = savedLimits.get(p.key) ?? {};
    const limits: Record<string, number | null> = {};
    for (const d of LIMIT_CATALOG) limits[d.key] = d.key in lim ? lim[d.key] : null;
    return {
      key: p.key,
      name: p.name,
      priceNzd: p.priceNzd,
      features: saved.get(p.key) ?? defaultFeaturesForPlan(p),
      limits,
    };
  });

  return { modules, limitDimensions: LIMIT_CATALOG, tiers };
}

/** Reject any unknown capability keys (keeps the store consistent with the catalog). */
export function invalidFeatureKeys(features: string[]): string[] {
  return features.filter((k) => !VALID_KEYS.has(k));
}

/** Upsert a plan's saved feature set. Throws if the table isn't migrated (caller 503s). */
export async function savePlanFeatures(planKey: string, features: string[]): Promise<void> {
  const existing = await db.select().from(planFeatures).where(eq(planFeatures.planKey, planKey));
  if (existing.length) {
    await db.update(planFeatures).set({ features, updatedAt: new Date() }).where(eq(planFeatures.planKey, planKey));
  } else {
    await db.insert(planFeatures).values({ planKey, features });
  }
}

/** Reject unknown dimension keys or non-integer/negative values (null = unlimited is allowed). */
export function invalidLimits(limits: Record<string, number | null>): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(limits)) {
    if (!VALID_LIMIT_KEYS.has(k)) bad.push(k);
    else if (v !== null && (!Number.isInteger(v) || v < 0)) bad.push(`${k}=${v}`);
  }
  return bad;
}

// ── Live-enforcement resolvers: a business → what its plan unlocks ───────────
// These are the bridge that makes the matrix the source of truth. A subscription
// status counts as entitled through dunning (active/trialing/past_due); anything
// else falls back to freemium. Mirrors entitlements.ts isEntitledStatus.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

async function resolveBusinessPlanKey(businessId: string): Promise<string> {
  const sub = await getSubscriptionByBusiness(businessId);
  if (sub && ENTITLED_STATUSES.has(sub.status) && sub.planId) {
    const plan = await getPlanById(sub.planId);
    if (plan?.key) return plan.key;
  }
  return "freemium";
}

/** The capability-key set a business has unlocked = its plan's matrix row (or the
 *  catalog defaults) UNION the capabilities its active add-ons unlock (e.g. buying
 *  the call-recording add-on re-grants calls.* even though no tier bundles it). */
export async function getBusinessFeatureSet(businessId: string): Promise<Set<string>> {
  const planKey = await resolveBusinessPlanKey(businessId);
  const saved = await getSavedFeatures();
  const set = saved.has(planKey)
    ? new Set(saved.get(planKey))
    : new Set(defaultFeaturesForPlan({ key: planKey, sortOrder: PLAN_RANK[planKey] ?? 0 }));

  // Add capabilities unlocked by the business's active add-ons (addon:* gates).
  const { entitlements } = await resolveEntitlements(businessId);
  for (const cap of CAPABILITY_CATALOG) {
    if (cap.requires?.startsWith("addon:") && entitlements.has(cap.requires)) set.add(cap.key);
  }
  return set;
}

/** The usage caps for a business's plan (null = unlimited, 0 = none). */
export async function getBusinessLimits(businessId: string): Promise<Record<string, number | null>> {
  const planKey = await resolveBusinessPlanKey(businessId);
  const saved = await getSavedLimits();
  const lim = saved.get(planKey) ?? {};
  const out: Record<string, number | null> = {};
  for (const d of LIMIT_CATALOG) out[d.key] = d.key in lim ? lim[d.key] : null;
  return out;
}

/** Upsert a plan's usage caps (one row per dimension). null = unlimited. */
export async function savePlanLimits(planKey: string, limits: Record<string, number | null>): Promise<void> {
  for (const [limitKey, value] of Object.entries(limits)) {
    const existing = await db
      .select()
      .from(planLimits)
      .where(and(eq(planLimits.planKey, planKey), eq(planLimits.limitKey, limitKey)));
    if (existing.length) {
      await db.update(planLimits).set({ value }).where(and(eq(planLimits.planKey, planKey), eq(planLimits.limitKey, limitKey)));
    } else {
      await db.insert(planLimits).values({ planKey, limitKey, value });
    }
  }
}
