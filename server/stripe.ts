// Stripe wrapper. Lazy-loads the `stripe` package so the rest of the app can
// boot in environments where the dependency isn't installed yet or the keys
// aren't configured — paid features just return helpful errors at call time
// instead of crashing module loading.
//
// Production env vars (set in DO App Platform):
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_PUBLISHABLE_KEY   pk_live_... or pk_test_... (only sent to client)
//   STRIPE_WEBHOOK_SECRET    whsec_... — required for signature verification

type StripeClient = any; // typed via runtime import to avoid hard dep

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
  });

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
  });

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a redirect URL');
  }
  return { id: session.id, url: session.url };
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
