/**
 * Inflow — subscription billing data layer (Phase 4).
 *
 * Thin DB helpers over the subscription tables. Stripe is the source of truth; these rows
 * mirror it (kept in sync by the webhook). Uses the `db` proxy: inside a tenant request it
 * runs RLS-scoped; the webhook runs outside a request (owner) and passes businessId
 * explicitly, so subscription writes always set the right owner.
 */
import { db } from "./db";
import { subscriptions, subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Subscription } from "@shared/schema";

export async function getActivePlans() {
  return db.select().from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
}

export async function getPlanByKey(key: string) {
  const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.key, key));
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

/** Mirror a Stripe subscription object into our `subscriptions` row (called from the webhook). */
export async function syncFromStripeSubscription(businessId: string, sub: any): Promise<void> {
  const priceId = sub?.items?.data?.[0]?.price?.id as string | undefined;
  const plan = priceId ? await getPlanByStripePriceId(priceId) : undefined;
  await upsertSubscription(businessId, {
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    planId: plan?.id ?? null,
    status: sub.status,                                                   // active|trialing|past_due|canceled|...
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });
}
