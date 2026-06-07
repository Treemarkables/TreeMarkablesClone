/**
 * Inflow — subscription billing data layer (Phase 4).
 *
 * Thin DB helpers over the subscription tables. Stripe is the source of truth; these rows
 * mirror it (kept in sync by the webhook). Uses the `db` proxy: inside a tenant request it
 * runs RLS-scoped; the webhook runs outside a request (owner) and passes businessId
 * explicitly, so subscription writes always set the right owner.
 */
import { db } from "./db";
import { subscriptions, subscriptionPlans, addOns, businessAddOns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Subscription, AddOn, BusinessAddOn } from "@shared/schema";

export async function getActivePlans() {
  return db.select().from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
}

export async function getPlanByKey(key: string) {
  const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.key, key));
  return p;
}

export async function getPlanById(id: string) {
  const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  return p;
}

export async function getPlanByStripePriceId(priceId: string) {
  const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripePriceId, priceId));
  return p;
}

export async function getSubscriptionByBusiness(businessId: string) {
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
  return s;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  return s;
}

type SubscriptionWrite = Partial<Omit<Subscription, "id" | "businessId" | "createdAt">>;

/**
 * Upsert the (single) subscription row for a business. businessId is explicit — this is
 * called from the webhook where there's no tenant context, so we never rely on a default.
 */
export async function upsertSubscription(businessId: string, data: SubscriptionWrite): Promise<void> {
  const existing = await getSubscriptionByBusiness(businessId);
  if (existing) {
    await db.update(subscriptions).set({ ...data, updatedAt: new Date() }).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ businessId, ...data });
  }
}

// ── Add-ons ("extras") — cost-incurring features sold on top of a paid plan ────
// Catalog keys MUST match the capability `requires` entitlement keys in
// server/tenancy/capabilities.ts ("sms" | "call_recording" | "ai") so activating
// an add-on flips the matching `addon:<key>` entitlement on. priceNzd is ex-GST,
// a DRAFT placeholder; stripePriceId is null until the prices are created in the
// Stripe dashboard (mirrors how the plan prices are managed).
// priceNzd is ex-GST. For `flat` add-ons it's the monthly price; for `metered`
// (SMS) it's the per-message rate (15c — a ~36% margin on the 11c/msg SMS Everyone cost).
const ADDON_SEED: { key: string; name: string; priceNzd: string; billingType: string }[] = [
  { key: "sms", name: "SMS & booking reminders", priceNzd: "0.15", billingType: "metered" },
  { key: "call_recording", name: "Call recording & in-app calling", priceNzd: "55.00", billingType: "flat" },
  { key: "ai", name: "AI assist bundle", priceNzd: "15.00", billingType: "flat" },
];

/**
 * Idempotently ensure the add-on catalog rows exist. Called once at boot. Inserts
 * any missing seed row. For an existing row that has NOT yet been wired to a Stripe
 * price, it keeps name/price/billingType synced to the seed (the catalog value is
 * ours to control until a Stripe price exists). Once `stripePriceId` is set, the row
 * is left untouched so dashboard-managed prices survive. Safe to no-op if the table
 * isn't migrated yet — the caller wraps this in try/catch.
 */
export async function seedAddOnCatalog(): Promise<void> {
  for (const a of ADDON_SEED) {
    const [existing] = await db.select().from(addOns).where(eq(addOns.key, a.key));
    if (!existing) {
      await db.insert(addOns).values(a);
    } else if (!existing.stripePriceId) {
      await db
        .update(addOns)
        .set({ name: a.name, priceNzd: a.priceNzd, billingType: a.billingType })
        .where(eq(addOns.id, existing.id));
    }
  }
}

export async function getActiveAddOns(): Promise<AddOn[]> {
  return db.select().from(addOns).where(eq(addOns.isActive, true));
}

export async function getAddOnByKey(key: string): Promise<AddOn | undefined> {
  const [a] = await db.select().from(addOns).where(eq(addOns.key, key));
  return a;
}

/** The add-on keys a business currently has switched on (status='active'). */
export async function getBusinessAddOnKeys(businessId: string): Promise<string[]> {
  const rows = await db
    .select({ key: addOns.key })
    .from(businessAddOns)
    .innerJoin(addOns, eq(businessAddOns.addOnId, addOns.id))
    .where(and(eq(businessAddOns.businessId, businessId), eq(businessAddOns.status, "active")));
  return rows.map((r) => r.key);
}

/** The business_add_ons row for one add-on, if any (regardless of status). */
export async function getBusinessAddOn(businessId: string, addOnId: string): Promise<BusinessAddOn | undefined> {
  const [row] = await db
    .select()
    .from(businessAddOns)
    .where(and(eq(businessAddOns.businessId, businessId), eq(businessAddOns.addOnId, addOnId)));
  return row;
}

/**
 * Upsert the business_add_ons row for one add-on. businessId is passed explicitly;
 * inside a tenant request RLS WITH CHECK ties it to the session business.
 */
export async function setBusinessAddOn(
  businessId: string,
  addOnId: string,
  data: { status: string; stripeSubscriptionItemId?: string | null },
): Promise<void> {
  const existing = await getBusinessAddOn(businessId, addOnId);
  if (existing) {
    await db.update(businessAddOns).set(data).where(eq(businessAddOns.id, existing.id));
  } else {
    await db.insert(businessAddOns).values({ businessId, addOnId, ...data });
  }
}

/**
 * Cancel every add-on for a business — used when its subscription is deleted so
 * extras don't outlive the plan they ride on. Called from the webhook (owner
 * connection), so businessId is explicit.
 */
export async function cancelAllBusinessAddOns(businessId: string): Promise<void> {
  await db
    .update(businessAddOns)
    .set({ status: "cancelled", stripeSubscriptionItemId: null })
    .where(eq(businessAddOns.businessId, businessId));
}

/** Mirror a Stripe subscription object into our `subscriptions` row (called from the webhook). */
export async function syncFromStripeSubscription(businessId: string, sub: any): Promise<void> {
  const item = sub?.items?.data?.[0];
  const priceId = item?.price?.id as string | undefined;
  const plan = priceId ? await getPlanByStripePriceId(priceId) : undefined;
  // Stripe API ≥2025-03 moved current_period_end onto the subscription item;
  // fall back to the subscription-level field for older API versions.
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await upsertSubscription(businessId, {
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    planId: plan?.id ?? null,
    status: sub.status,                                                   // active|trialing|past_due|canceled|...
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });
}
