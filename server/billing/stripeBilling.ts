/**
 * Inflow — Stripe platform billing (Phase 4).
 *
 * This is PLATFORM billing: Inflow charging a subscriber their tier fee. It is
 * DISTINCT from server/stripe.ts, which is the subscriber's customers paying
 * *them* (deposits/invoices, and later the Connect-based Payments add-on). See
 * INFLOW_SAAS_PLAN.md "Two distinct Stripe roles".
 *
 * Schema note: aligns to the billing tables already on the Neon dev branch —
 * subscription_plans has a single stripe_price_id + interval per row, and
 * subscriptions/business_add_ons reference plans/add-ons by ID (plan_id /
 * add_on_id), not by key string.
 *
 * Account flexibility: reads STRIPE_BILLING_SECRET_KEY, falls back to
 * STRIPE_SECRET_KEY — one account works out of the box, splitting later is an
 * env change. The webhook secret (STRIPE_BILLING_WEBHOOK_SECRET) is always
 * distinct: /api/billing/webhook is a different endpoint from /api/stripe/webhook.
 *
 * Env vars:
 *   STRIPE_BILLING_SECRET_KEY      sk_... (optional; falls back to STRIPE_SECRET_KEY)
 *   STRIPE_BILLING_WEBHOOK_SECRET  whsec_... (required for /api/billing/webhook)
 *   STRIPE_GST_TAX_RATE_ID         txr_... (optional; NZ GST 15% — else no tax line)
 * Price IDs live in subscription_plans.stripe_price_id (already set on dev).
 *
 * STATUS: routes registered but inert until env exists — checkout/portal 503,
 * webhook 400s without its secret.
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

type StripeClient = any;

let cachedClient: StripeClient | null = null;
let cachedClientPromise: Promise<StripeClient> | null = null;

function billingSecretKey(): string | undefined {
  return process.env.STRIPE_BILLING_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
}

export function isBillingConfigured(): boolean {
  return Boolean(billingSecretKey());
}

async function getBillingStripe(): Promise<StripeClient> {
  if (cachedClient) return cachedClient;
  const key = billingSecretKey();
  if (!key) {
    throw new Error("Platform billing not configured: set STRIPE_BILLING_SECRET_KEY or STRIPE_SECRET_KEY");
  }
  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      const mod: any = await import("stripe");
      const StripeCtor = mod.default || mod;
      const client = new StripeCtor(key, { apiVersion: "2024-12-18.acacia", typescript: true });
      cachedClient = client;
      return client;
    })();
  }
  return cachedClientPromise;
}

// ── Plan helpers ────────────────────────────────────────────────────────────

async function getPlanByKey(planKey: string): Promise<schema.SubscriptionPlan | undefined> {
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(eq(schema.subscriptionPlans.key, planKey))
    .limit(1);
  return plan;
}

/** Map a Stripe price ID back to its plan row (for subscription.* events). */
async function planForPrice(priceId: string | null | undefined): Promise<schema.SubscriptionPlan | null> {
  if (!priceId) return null;
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(eq(schema.subscriptionPlans.stripePriceId, priceId))
    .limit(1);
  return plan ?? null;
}

// ── Subscription row upsert (one per business, keyed by business_id) ─────────

interface SubUpsert {
  businessId: string;
  planId?: string | null;
  status?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

async function upsertSubscription(data: SubUpsert): Promise<void> {
  // Only write the fields actually provided — never null out a column we didn't
  // mean to touch. (planId: null IS meaningful — the cancel path sets freemium.)
  const fields: Record<string, unknown> = {};
  if (data.planId !== undefined) fields.planId = data.planId;
  if (data.status !== undefined) fields.status = data.status;
  if (data.stripeCustomerId !== undefined) fields.stripeCustomerId = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) fields.stripeSubscriptionId = data.stripeSubscriptionId;
  if (data.currentPeriodEnd !== undefined) fields.currentPeriodEnd = data.currentPeriodEnd;
  if (data.trialEnd !== undefined) fields.trialEnd = data.trialEnd;
  if (data.cancelAtPeriodEnd !== undefined) fields.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

  // Atomic upsert keyed by business_id (one subscription per business). Replaces
  // the old select-then-insert/update, which could create a duplicate row under
  // the neon-http driver's read-after-write lag when Stripe delivers events in
  // rapid/out-of-order succession. Requires the UNIQUE constraint on business_id
  // (subscriptions_business_id_unique) as the conflict target — see the migration.
  await db
    .insert(schema.subscriptions)
    .values({
      businessId: data.businessId,
      status: data.status ?? "incomplete",
      ...fields,
    } as schema.InsertSubscription)
    .onConflictDoUpdate({
      target: schema.subscriptions.businessId,
      set: { ...fields, updatedAt: new Date() },
    });
}

// ── Checkout (start/upgrade a subscription) ─────────────────────────────────

export interface CheckoutInput {
  businessId: string;
  planKey: string; // 'crew' | 'business' (freemium needs no checkout)
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

/** Create a Stripe Checkout Session (subscription mode) for a paid plan. */
export async function createSubscriptionCheckout(input: CheckoutInput): Promise<{ url: string }> {
  const plan = await getPlanByKey(input.planKey);
  if (!plan) throw new Error(`Unknown plan: ${input.planKey}`);
  if (!plan.stripePriceId) {
    throw new Error(`Plan '${input.planKey}' has no Stripe price configured (subscription_plans.stripe_price_id)`);
  }

  const stripe = await getBillingStripe();
  const taxRateId = process.env.STRIPE_GST_TAX_RATE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1, ...(taxRateId ? { tax_rates: [taxRateId] } : {}) }],
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    subscription_data: {
      metadata: { businessId: input.businessId, planKey: input.planKey, planId: plan.id },
      ...(input.trialDays ? { trial_period_days: input.trialDays } : {}),
    },
    metadata: { businessId: input.businessId, planKey: input.planKey, planId: plan.id },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

/** Create a Stripe Billing customer-portal session (update card, cancel, etc.). */
export async function createCustomerPortalSession(input: {
  businessId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.businessId, input.businessId))
    .limit(1);
  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer for this business yet — subscribe first");
  }
  const stripe = await getBillingStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}

// ── Webhook handling ────────────────────────────────────────────────────────

/** Verify + parse a billing webhook (own endpoint secret). */
export async function constructBillingEvent(rawBody: Buffer, signature: string | undefined): Promise<any> {
  if (!process.env.STRIPE_BILLING_WEBHOOK_SECRET) {
    throw new Error("Billing webhook not configured: missing STRIPE_BILLING_WEBHOOK_SECRET");
  }
  if (!signature) throw new Error("Missing Stripe signature header");
  const stripe = await getBillingStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_BILLING_WEBHOOK_SECRET);
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

function businessIdFromInvoice(inv: any): string | undefined {
  return inv.subscription_details?.metadata?.businessId || inv.lines?.data?.[0]?.metadata?.businessId;
}

/**
 * Apply a verified billing event to the subscriptions table. Idempotent: every
 * handler is a full upsert keyed by businessId, so Stripe retries are safe.
 */
export async function handleBillingEvent(event: any): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const businessId = s.metadata?.businessId;
      if (!businessId) return;
      const planId = s.metadata?.planId ?? (s.metadata?.planKey ? (await getPlanByKey(s.metadata.planKey))?.id : undefined);
      await upsertSubscription({
        businessId,
        planId,
        status: "active",
        stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id,
        stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
      });
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const businessId = sub.metadata?.businessId;
      if (!businessId) return;
      const item = sub.items?.data?.[0];
      const priceId = item?.price?.id;
      const plan = await planForPrice(priceId);
      const planId = plan?.id ?? sub.metadata?.planId;
      await upsertSubscription({
        businessId,
        planId,
        status: sub.status, // active | trialing | past_due | canceled | incomplete
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
        // Stripe API ≥2025-03 moved current_period_end onto the subscription item;
        // fall back to the subscription-level field for older versions.
        currentPeriodEnd: toDate(item?.current_period_end ?? sub.current_period_end),
        trialEnd: toDate(sub.trial_end),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      });
      return;
    }
    case "customer.subscription.deleted": {
      // Cancellation → drop to freemium (data retained; resolver fails closed).
      const sub = event.data.object;
      const businessId = sub.metadata?.businessId;
      if (!businessId) return;
      const freemium = await getPlanByKey("freemium");
      await upsertSubscription({ businessId, planId: freemium?.id ?? null, status: "canceled" });
      return;
    }
    case "invoice.payment_failed": {
      const businessId = businessIdFromInvoice(event.data.object);
      if (!businessId) return;
      // Stay entitled through dunning (the resolver treats past_due as entitled).
      await upsertSubscription({ businessId, status: "past_due" });
      return;
    }
    case "invoice.paid": {
      const businessId = businessIdFromInvoice(event.data.object);
      if (!businessId) return;
      await upsertSubscription({ businessId, status: "active" });
      return;
    }
    default:
      return; // ignore unhandled event types
  }
}
