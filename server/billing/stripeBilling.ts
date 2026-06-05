/**
 * Inflow — Stripe platform billing (Phase 4).
 *
 * This is PLATFORM billing: Inflow charging a subscriber their monthly/annual
 * tier fee. It is DISTINCT from server/stripe.ts, which is the subscriber's
 * customers paying *them* (deposits/invoices, and later the Connect-based
 * Payments add-on). See INFLOW_SAAS_PLAN.md "Two distinct Stripe roles".
 *
 * Account flexibility: platform billing may run on its own Stripe account or
 * share the one used for customer payments. It reads STRIPE_BILLING_SECRET_KEY
 * and falls back to STRIPE_SECRET_KEY — so one account works out of the box, and
 * splitting them later is an env change, not a code change. The webhook secret
 * (STRIPE_BILLING_WEBHOOK_SECRET) is always distinct: webhook secrets are
 * per-endpoint, and /api/billing/webhook is a different endpoint from the
 * existing /api/stripe/webhook.
 *
 * Env vars (set in DO App Platform once the Stripe products exist):
 *   STRIPE_BILLING_SECRET_KEY      sk_... (optional; falls back to STRIPE_SECRET_KEY)
 *   STRIPE_BILLING_WEBHOOK_SECRET  whsec_... (required for /api/billing/webhook)
 *   STRIPE_GST_TAX_RATE_ID         txr_... (optional; NZ GST 15% — else no tax line)
 * Price IDs live in the subscription_plans rows (stripe_price_id_monthly/yearly),
 * not env — set them via UPDATE once the Stripe Prices are created.
 *
 * STATUS: routes are registered but inert until the env + price IDs exist —
 * checkout/portal return a clear 503, the webhook 400s without its secret.
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

/** Map a Stripe price ID back to a plan key (for subscription.updated events). */
async function planKeyForPrice(priceId: string | null | undefined): Promise<string | null> {
  if (!priceId) return null;
  const plans = await db.select().from(schema.subscriptionPlans);
  const match = plans.find(
    (p) => p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId,
  );
  return match?.key ?? null;
}

// ── Subscription row upsert (one per business) ──────────────────────────────

interface SubUpsert {
  businessId: string;
  planKey?: string;
  status?: string;
  billingInterval?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

async function upsertSubscription(data: SubUpsert): Promise<void> {
  const [existing] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.businessId, data.businessId))
    .limit(1);

  const fields = {
    planKey: data.planKey,
    status: data.status,
    billingInterval: data.billingInterval,
    stripeCustomerId: data.stripeCustomerId ?? undefined,
    stripeSubscriptionId: data.stripeSubscriptionId ?? undefined,
    currentPeriodEnd: data.currentPeriodEnd ?? undefined,
    trialEnd: data.trialEnd ?? undefined,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
  };
  // strip undefined so we never null out a column we didn't mean to touch
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({ ...clean, updatedAt: new Date() })
      .where(eq(schema.subscriptions.id, existing.id));
  } else {
    await db.insert(schema.subscriptions).values({
      businessId: data.businessId,
      planKey: data.planKey ?? "freemium",
      status: data.status ?? "incomplete",
      billingInterval: data.billingInterval ?? "month",
      ...clean,
    } as schema.InsertSubscription);
  }
}

// ── Checkout (start/upgrade a subscription) ─────────────────────────────────

export interface CheckoutInput {
  businessId: string;
  planKey: string; // 'crew' | 'business' (freemium needs no checkout)
  interval: "month" | "year";
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

/** Create a Stripe Checkout Session (subscription mode) for a paid plan. */
export async function createSubscriptionCheckout(input: CheckoutInput): Promise<{ url: string }> {
  const plan = await getPlanByKey(input.planKey);
  if (!plan) throw new Error(`Unknown plan: ${input.planKey}`);
  const priceId = input.interval === "year" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
  if (!priceId) {
    throw new Error(
      `Plan '${input.planKey}' has no Stripe ${input.interval} price configured — set subscription_plans.stripe_price_id_${input.interval === "year" ? "yearly" : "monthly"}`,
    );
  }

  const stripe = await getBillingStripe();
  const taxRateId = process.env.STRIPE_GST_TAX_RATE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1, ...(taxRateId ? { tax_rates: [taxRateId] } : {}) }],
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    subscription_data: {
      metadata: { businessId: input.businessId, planKey: input.planKey },
      ...(input.trialDays ? { trial_period_days: input.trialDays } : {}),
    },
    metadata: { businessId: input.businessId, planKey: input.planKey },
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
      await upsertSubscription({
        businessId,
        planKey: s.metadata?.planKey,
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
      const priceId = sub.items?.data?.[0]?.price?.id;
      const planKey = (await planKeyForPrice(priceId)) ?? sub.metadata?.planKey;
      const interval = sub.items?.data?.[0]?.price?.recurring?.interval; // 'month' | 'year'
      await upsertSubscription({
        businessId,
        planKey,
        status: sub.status, // active | trialing | past_due | canceled | incomplete
        billingInterval: interval,
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: toDate(sub.current_period_end),
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
      await upsertSubscription({ businessId, planKey: "freemium", status: "canceled" });
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const businessId = inv.subscription_details?.metadata?.businessId || inv.lines?.data?.[0]?.metadata?.businessId;
      if (!businessId) return;
      // Stay entitled through dunning (the resolver treats past_due as entitled).
      await upsertSubscription({ businessId, status: "past_due" });
      return;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const businessId = inv.subscription_details?.metadata?.businessId || inv.lines?.data?.[0]?.metadata?.businessId;
      if (!businessId) return;
      await upsertSubscription({ businessId, status: "active" });
      return;
    }
    default:
      return; // ignore unhandled event types
  }
}
