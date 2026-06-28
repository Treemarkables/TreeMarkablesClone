// Stripe wrapper. Lazy-loads the `stripe` package so the rest of the app can
// boot in environments where the dependency isn't installed yet or the keys
// aren't configured — paid features just return helpful errors at call time
// instead of crashing module loading.
//
// Production env vars (set in DO App Platform):
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_PUBLISHABLE_KEY   pk_live_... or pk_test_... (only sent to client)
//   STRIPE_WEBHOOK_SECRET    whsec_... — required for signature verification
//   STRIPE_GST_TAX_RATE_ID   txr_... — optional; a 15% tax-exclusive NZ GST rate added
//                            to subscription checkouts (prices are GST-exclusive). Unset = no GST added.

import { TREEMARKABLES_BUSINESS_IDS } from "../shared/roleChecklistAccess";

type StripeClient = any; // typed via runtime import to avoid hard dep

// ── Who may take online CARD payments (invoice / deposit / job checkout) ─────
// There is ONE Stripe account (STRIPE_SECRET_KEY) and — until Stripe Connect
// exists — it belongs to Treemarkables. Every `mode: 'payment'` checkout settles
// into it, so only Treemarkables may take card payments online; any other tenant's
// customer would otherwise pay into TM's account (misdirected funds). Every other
// tenant collects by bank transfer instead — their own bank details render on the
// invoice (see business_settings.bankAccount*). Subscription billing is NOT gated
// by this: a tenant subscribing to Inflow is *meant* to pay the platform account.
//
// STRIPE_PAYMENT_BUSINESS_IDS (comma-separated) opts extra businessIds in without a
// code change — e.g. once Connect lands and routing becomes per-tenant.
export function businessOwnsStripeAccount(businessId: string | null | undefined): boolean {
  if (!businessId) return false;
  if (TREEMARKABLES_BUSINESS_IDS.includes(businessId)) return true;
  const extra = (process.env.STRIPE_PAYMENT_BUSINESS_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(businessId);
}

let cachedClient: StripeClient | null = null;
let cachedClientPromise: Promise<StripeClient> | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

async function getStripe(): Promise<StripeClient> {
  if (cachedClient) return cachedClient;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured: missing STRIPE_SECRET_KEY env var');
  }
  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      const mod: any = await import('stripe');
      const StripeCtor = mod.default || mod;
      const client = new StripeCtor(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: '2024-12-18.acacia',
        typescript: true,
      });
      cachedClient = client;
      return client;
    })();
  }
  return cachedClientPromise;
}

export interface DepositCheckoutInput {
  proposalId: string;
  proposalNumber: string;
  amountCents: number; // already in cents, NZD
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  businessName?: string;
  connectedAccountId?: string; // Stripe Connect: when set, the charge is created ON this connected account (direct charge → funds go to the tenant).
}

// Creates a Stripe Checkout Session for a proposal deposit. Returns the
// hosted-checkout URL the customer is redirected to. The session metadata
// carries proposalId + kind='deposit' so the webhook can finalize the
// matching proposal acceptance when payment succeeds.
export async function createDepositCheckoutSession(input: DepositCheckoutInput): Promise<{
  id: string;
  url: string;
}> {
  const stripe = await getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    currency: 'nzd',
    customer_email: input.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'nzd',
          product_data: {
            name: `Deposit — Proposal ${input.proposalNumber}`,
            description: input.businessName
              ? `Upfront deposit for work proposed by ${input.businessName}`
              : 'Upfront deposit',
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      kind: 'deposit',
      proposalId: input.proposalId,
      proposalNumber: input.proposalNumber,
    },
    payment_intent_data: {
      metadata: {
        kind: 'deposit',
        proposalId: input.proposalId,
        proposalNumber: input.proposalNumber,
      },
    },
  }, input.connectedAccountId ? { stripeAccount: input.connectedAccountId } : undefined);

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a redirect URL');
  }
  return { id: session.id, url: session.url };
}

export interface InvoiceCheckoutInput {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number; // outstanding amount in cents, NZD (GST-inclusive)
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  businessName?: string;
  connectedAccountId?: string; // Stripe Connect: when set, the charge is created ON this connected account (direct charge → funds go to the tenant).
}

// Creates a Stripe Checkout Session for an invoice payment. Mirrors the
// deposit flow but tags the session metadata with kind='payment' + invoiceId
// so the webhook records the payment against the right invoice and marks it
// paid when the charge succeeds.
export async function createInvoiceCheckoutSession(input: InvoiceCheckoutInput): Promise<{
  id: string;
  url: string;
}> {
  const stripe = await getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    currency: 'nzd',
    customer_email: input.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'nzd',
          product_data: {
            name: `Invoice ${input.invoiceNumber}`,
            description: input.businessName
              ? `Payment for invoice ${input.invoiceNumber} — ${input.businessName}`
              : `Payment for invoice ${input.invoiceNumber}`,
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      kind: 'payment',
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
    },
    payment_intent_data: {
      metadata: {
        kind: 'payment',
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
      },
    },
  }, input.connectedAccountId ? { stripeAccount: input.connectedAccountId } : undefined);

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a redirect URL');
  }
  return { id: session.id, url: session.url };
}

export interface JobCheckoutInput {
  jobId: string;
  jobNumber?: string | null;
  amountCents: number; // outstanding amount in cents, NZD (GST-inclusive)
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  businessName?: string;
  connectedAccountId?: string; // Stripe Connect: when set, the charge is created ON this connected account (direct charge → funds go to the tenant).
}

// Creates a Stripe Checkout Session for an on-the-spot job payment (staff
// takes payment at job completion). metadata kind='payment' + jobId so the
// webhook records the payment against the job and updates its paid/balance.
export async function createJobCheckoutSession(input: JobCheckoutInput): Promise<{
  id: string;
  url: string;
}> {
  const stripe = await getStripe();
  const label = input.jobNumber ? `Job ${input.jobNumber}` : 'Job payment';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    currency: 'nzd',
    customer_email: input.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'nzd',
          product_data: {
            name: label,
            description: input.businessName
              ? `Payment for ${label} — ${input.businessName}`
              : `Payment for ${label}`,
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      kind: 'payment',
      jobId: input.jobId,
      jobNumber: input.jobNumber || '',
    },
    payment_intent_data: {
      metadata: {
        kind: 'payment',
        jobId: input.jobId,
        jobNumber: input.jobNumber || '',
      },
    },
  }, input.connectedAccountId ? { stripeAccount: input.connectedAccountId } : undefined);

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a redirect URL');
  }
  return { id: session.id, url: session.url };
}

// ── SaaS subscription billing (Inflow — Phase 4) ────────────────────────────

export interface SubscriptionCheckoutInput {
  businessId: string;
  priceId: string;             // recurring price (subscription_plans.stripe_price_id)
  planKey: string;
  customerId?: string | null;  // existing Stripe customer to reuse (avoids dupes)
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}

// Creates a subscription-mode Checkout Session. The subscriber enters their card on
// Stripe's hosted page and a recurring monthly subscription begins; Stripe auto-charges
// each month and handles retries. businessId rides on client_reference_id + subscription
// metadata so the webhook can map the resulting subscription back to the tenant.
export async function createSubscriptionCheckoutSession(input: SubscriptionCheckoutInput): Promise<{ id: string; url: string }> {
  const stripe = await getStripe();
  // The plan prices are GST-EXCLUSIVE (the billing page says so + Jules set them as
  // $89/$150 + GST). Apply a NZ GST tax rate so Stripe adds 15% on top of each charge
  // and the Stripe invoice doubles as a GST tax receipt. STRIPE_GST_TAX_RATE_ID is the
  // id (txr_…) of a 15%, tax-exclusive "GST" rate created in the Stripe dashboard.
  // Unset → no tax added (current behaviour), so this is safe to ship before the rate
  // exists. NB: only subscriptions need this — invoice/deposit/job checkouts already
  // charge GST-inclusive amounts (the tenant's own invoicing).
  const gstRate = process.env.STRIPE_GST_TAX_RATE_ID?.trim();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1, ...(gstRate ? { tax_rates: [gstRate] } : {}) }],
    customer: input.customerId || undefined,
    customer_email: input.customerId ? undefined : (input.customerEmail || undefined),
    client_reference_id: input.businessId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    subscription_data: { metadata: { businessId: input.businessId, planKey: input.planKey } },
    metadata: { kind: 'subscription', businessId: input.businessId, planKey: input.planKey },
  });
  if (!session.url) throw new Error('Stripe subscription checkout session did not return a redirect URL');
  return { id: session.id, url: session.url };
}

// Returns `existingId` if given, else creates a Stripe customer for the business.
export async function getOrCreateStripeCustomer(
  businessId: string,
  opts: { email?: string | null; name?: string | null; existingId?: string | null },
): Promise<string> {
  if (opts.existingId) return opts.existingId;
  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: opts.email || undefined,
    name: opts.name || undefined,
    metadata: { businessId },
  });
  return customer.id;
}

// Retrieves a subscription from Stripe (to sync its status into the DB).
export async function retrieveStripeSubscription(subscriptionId: string): Promise<any> {
  const stripe = await getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

// Billing-portal session so a subscriber can update their card / cancel.
export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return { url: session.url };
}

// ── Stripe Connect (Express) — per-tenant card payments ─────────────────────
// Lets a tenant accept card payments from THEIR customers into THEIR OWN Stripe
// account. Direct-charge model: an invoice/deposit/job checkout is created ON the
// tenant's connected account (Phase 2 passes { stripeAccount }), so funds land in
// their account and they are the merchant of record. Onboarding is Stripe-hosted via
// Account Links. NOTE: the platform Stripe account must have Connect enabled in the
// dashboard for accounts.create to work.

/** Create an Express connected account for a tenant. Returns the acct_… id. */
export async function createConnectAccount(opts: { email?: string | null; businessName?: string | null }): Promise<string> {
  const stripe = await getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'NZ',
    email: opts.email || undefined,
    business_profile: opts.businessName ? { name: opts.businessName } : undefined,
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });
  return account.id;
}

/** A Stripe-hosted onboarding link for a connected account (or to resume onboarding). */
export async function createConnectAccountLink(accountId: string, opts: { returnUrl: string; refreshUrl: string }): Promise<string> {
  const stripe = await getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: opts.returnUrl,
    refresh_url: opts.refreshUrl,
  });
  return link.url;
}

/** Current onboarding/capability status of a connected account. */
export async function retrieveConnectAccount(accountId: string): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const stripe = await getStripe();
  const acct = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: !!acct.charges_enabled,
    payoutsEnabled: !!acct.payouts_enabled,
    detailsSubmitted: !!acct.details_submitted,
  };
}

/** A Stripe Express dashboard login link, so a connected tenant can view their payouts. */
export async function createConnectLoginLink(accountId: string): Promise<string> {
  const stripe = await getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

// Verifies a Stripe webhook signature against the raw request body and
// returns the parsed event. Throws on signature mismatch — caller should
// 400 the response so Stripe will retry.
export async function constructWebhookEvent(rawBody: Buffer, signature: string | undefined): Promise<any> {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook is not configured: missing STRIPE_WEBHOOK_SECRET env var');
  }
  if (!signature) {
    throw new Error('Missing Stripe signature header');
  }
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

// Computes deposit amount (in dollars) from a proposal's deposit settings +
// total. Returns 0 when no deposit is required. Centralised so the accept
// endpoint, the checkout endpoint, and the customer modal all agree on the
// number.
export function computeDepositAmount(
  depositType: string | null | undefined,
  depositValue: string | number | null | undefined,
  totalAmount: string | number | null | undefined,
): number {
  if (!depositType || depositType === 'none') return 0;
  const value = typeof depositValue === 'string' ? parseFloat(depositValue) : (depositValue || 0);
  const total = typeof totalAmount === 'string' ? parseFloat(totalAmount) : (totalAmount || 0);
  if (!isFinite(value) || value <= 0 || !isFinite(total) || total <= 0) return 0;
  if (depositType === 'percent') {
    const pct = Math.min(100, Math.max(0, value));
    return Math.round(total * (pct / 100) * 100) / 100;
  }
  if (depositType === 'fixed') {
    // Cap at the total so subscribers can't accidentally over-collect
    return Math.round(Math.min(value, total) * 100) / 100;
  }
  return 0;
}
