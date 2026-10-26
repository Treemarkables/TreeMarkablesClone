// Pure Stripe payout classification, payment matching, and the Xero post plan.
// Account 640 is the Stripe clearing account the bank deposit is coded to.
// Invoice payments debit 640, the fee entry credits 640, and the deposit credits
// 640, so a fully matched payout nets the account to zero.

export const STRIPE_CLEARING_ACCOUNT = "640";
export const NO_GST_TAX = "NONE";

const ACCOUNT_CODE = /^[A-Za-z0-9.-]{1,10}$/;
const CHARGE_TYPES = new Set(["charge", "payment"]);
const REFUND_TYPES = new Set(["refund", "payment_refund", "payment_failure_refund"]);
const FEE_TYPES = new Set([
  "stripe_fee",
  "stripe_fx_fee",
  "tax_fee",
  "application_fee",
  "application_fee_refund",
]);

export type PayoutLineKind = "charge" | "refund" | "fee" | "other";

export interface RawBalanceTxn {
  id: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  description?: string | null;
  source?: unknown;
  currency?: string | null;
}

export interface ClassifiedPayoutLine {
  balanceTransactionId: string;
  stripeType: string;
  kind: PayoutLineKind;
  /** Signed dollars. Charges are positive, refunds and fee transactions are negative. */
  amount: number;
  fee: number;
  net: number;
  description: string;
  stripeSourceId: string | null;
  stripeChargeId: string | null;
  stripePaymentId: string | null;
  currency: string;
  /** The payout balance transaction itself is not part of the payout's contents. */
  ignore: boolean;
}

export interface PaymentMatchKey {
  id: string;
  providerPaymentId: string | null;
  providerSessionId: string | null;
  jobId: string | null;
  invoiceId: string | null;
  customerId: string | null;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

function dollarsToCents(dollars: number): number {
  return Math.round(round2(dollars) * 100);
}

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function sourceIds(source: unknown): {
  sourceId: string | null;
  chargeId: string | null;
  paymentIntentId: string | null;
} {
  if (typeof source === "string") {
    const id = source.trim();
    return {
      sourceId: id || null,
      chargeId: id.startsWith("ch_") || id.startsWith("py_") ? id : null,
      paymentIntentId: id.startsWith("pi_") ? id : null,
    };
  }
  if (!source || typeof source !== "object") {
    return { sourceId: null, chargeId: null, paymentIntentId: null };
  }
  const obj = source as Record<string, unknown>;
  const sourceId = asId(obj.id);
  const paymentIntentId = asId(obj.payment_intent) ?? (sourceId?.startsWith("pi_") ? sourceId : null);
  const chargeFromField = asId(obj.charge);
  const chargeId =
    chargeFromField ??
    (sourceId && (sourceId.startsWith("ch_") || sourceId.startsWith("py_")) ? sourceId : null);
  return { sourceId, chargeId, paymentIntentId };
}

export function classifyBalanceTransaction(bt: RawBalanceTxn): ClassifiedPayoutLine {
  const stripeType = (bt.type || "other").toLowerCase();
  let kind: PayoutLineKind = "other";
  if (CHARGE_TYPES.has(stripeType)) kind = "charge";
  else if (REFUND_TYPES.has(stripeType)) kind = "refund";
  else if (FEE_TYPES.has(stripeType)) kind = "fee";
  const ids = sourceIds(bt.source);
  return {
    balanceTransactionId: bt.id,
    stripeType,
    kind,
    amount: centsToDollars(bt.amount),
    fee: centsToDollars(bt.fee),
    net: centsToDollars(bt.net),
    description: (bt.description ?? "").slice(0, 500),
    stripeSourceId: ids.sourceId,
    stripeChargeId: ids.chargeId,
    stripePaymentId: ids.paymentIntentId,
    currency: (bt.currency ?? "nzd").toLowerCase(),
    ignore: stripeType === "payout",
  };
}

/** Net Stripe fees in dollars. Positive means fees reduced the payout. */
export function feeDollars(lines: Array<Pick<ClassifiedPayoutLine, "kind" | "amount" | "fee">>): number {
  let cents = 0;
  for (const line of lines) {
    if (line.kind === "fee") cents += -dollarsToCents(line.amount);
    else cents += dollarsToCents(line.fee);
  }
  return cents / 100;
}

export function netDollars(lines: Array<{ net: number }>): number {
  return lines.reduce((sum, line) => sum + dollarsToCents(line.net), 0) / 100;
}

export function matchLineToPayment(
  line: Pick<ClassifiedPayoutLine, "kind" | "stripePaymentId" | "stripeChargeId" | "stripeSourceId">,
  payments: PaymentMatchKey[],
): PaymentMatchKey | null {
  if (line.kind === "fee") return null;
  const wanted = new Set(
    [line.stripePaymentId, line.stripeChargeId, line.stripeSourceId].filter((id): id is string => !!id),
  );
  if (wanted.size === 0) return null;
  const hits = payments.filter(
    (p) =>
      (p.providerPaymentId != null && wanted.has(p.providerPaymentId)) ||
      (p.providerSessionId != null && wanted.has(p.providerSessionId)),
  );
  if (hits.length === 0) return null;
  return hits.find((p) => p.invoiceId) ?? hits[0];
}

export function parseAccountCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return ACCOUNT_CODE.test(code) ? code : null;
}

export function xeroReference(parts: string[]): string {
  return parts
    .join(" ")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

export function resolvePayoutStripeAccount(input: {
  stripeConnectAccountId?: string | null;
  ownsPlatformAccount: boolean;
}): { stripeAccountId: string | null } | { error: string } {
  const acct = (input.stripeConnectAccountId ?? "").trim();
  if (acct.startsWith("acct_")) return { stripeAccountId: acct };
  if (acct) return { error: "The saved Stripe account id is not a connected account." };
  if (input.ownsPlatformAccount) return { stripeAccountId: null };
  return { error: "Connect Stripe under Settings, Billing, before payouts can be loaded." };
}

export function choosePlatformBusinessId(found: string[], preferred: readonly string[]): string | null {
  const ids = found.filter((id) => !!id);
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];
  for (const id of preferred) {
    if (ids.includes(id)) return id;
  }
  return ids[0];
}

export function clearingAccountProblem(
  code: string,
  account: { type?: string | null; enablePaymentsToAccount?: boolean | null } | null,
): string | null {
  if (!account) {
    return `Account ${code} was not found in Xero. Stripe Clearing needs to exist as that account code.`;
  }
  const type = (account.type ?? "").toUpperCase();
  if (type === "BANK" || account.enablePaymentsToAccount) return null;
  return `Account ${code} cannot receive payments. In Xero, open the account and turn on Enable payments to this account.`;
}

export function clearingAccountIsBank(account: { type?: string | null } | null): boolean {
  return (account?.type ?? "").toUpperCase() === "BANK";
}

export interface PostableLine {
  lineId: string;
  kind: PayoutLineKind;
  amount: number;
  fee: number;
  net: number;
  matched: boolean;
  xeroInvoiceId: string | null;
  /** Xero invoice status, uppercase. Null when Xero has not been read yet. */
  xeroStatus: string | null;
  amountDue: number | null;
  xeroPaymentId: string | null;
  xeroRefundPaymentId: string | null;
  jobNumber: string | null;
  invoiceNumber: string | null;
  stripeSourceId: string | null;
  balanceTransactionId: string;
}

export interface XeroPaymentAction {
  lineId: string;
  xeroInvoiceId: string;
  amount: number;
  reference: string;
  jobNumber: string | null;
  invoiceNumber: string | null;
  alreadyPosted: boolean;
  xeroPaymentId: string | null;
  shortfall: number;
}

export interface XeroRefundAction {
  lineId: string;
  xeroInvoiceId: string;
  amount: number;
  reference: string;
  jobNumber: string | null;
  invoiceNumber: string | null;
  alreadyPosted: boolean;
  xeroRefundPaymentId: string | null;
  stripeSourceId: string | null;
}

export interface XeroSkip {
  lineId: string;
  reason: "unmatched" | "no_xero_invoice" | "already_paid" | "not_authorised" | "other";
  message: string;
  amount: number;
  jobNumber: string | null;
  invoiceNumber: string | null;
}

export interface XeroPostPlan {
  currencyBlocked: string | null;
  payments: XeroPaymentAction[];
  refunds: XeroRefundAction[];
  fee: { amount: number; reference: string; alreadyPosted: boolean } | null;
  skips: XeroSkip[];
  clearing: {
    payoutDollars: number;
    paymentDollars: number;
    refundDollars: number;
    feeDollars: number;
    gapDollars: number;
    netsToPayout: boolean;
    gapMessage: string | null;
  };
}

function sumAmounts(amounts: number[]): number {
  return amounts.reduce((sum, n) => sum + dollarsToCents(n), 0) / 100;
}

export function planXeroPost(input: {
  stripePayoutId: string;
  payoutDollars: number;
  currency: string;
  lines: PostableLine[];
  feeAlreadyPosted: boolean;
}): XeroPostPlan {
  const currency = (input.currency || "nzd").toLowerCase();
  const fees = feeDollars(input.lines);
  const emptyClearing = {
    payoutDollars: round2(input.payoutDollars),
    paymentDollars: 0,
    refundDollars: 0,
    feeDollars: fees,
    gapDollars: round2(input.payoutDollars),
    netsToPayout: false,
    gapMessage: null as string | null,
  };
  if (currency !== "nzd") {
    return {
      currencyBlocked: `This payout is ${currency.toUpperCase()}. Inflow only posts NZD payouts to Xero.`,
      payments: [],
      refunds: [],
      fee: null,
      skips: [],
      clearing: { ...emptyClearing, gapMessage: `This payout is ${currency.toUpperCase()}, so nothing was posted.` },
    };
  }

  const payments: XeroPaymentAction[] = [];
  const refunds: XeroRefundAction[] = [];
  const skips: XeroSkip[] = [];

  for (const line of input.lines) {
    if (line.kind === "fee") continue;
    if (line.kind === "other") {
      skips.push({
        lineId: line.lineId,
        reason: "other",
        message: "This Stripe balance line is not a charge, refund, or fee, so it was not posted.",
        amount: round2(line.net),
        jobNumber: line.jobNumber,
        invoiceNumber: line.invoiceNumber,
      });
      continue;
    }
    if (line.kind === "charge") {
      const gross = round2(line.amount);
      if (!line.matched) {
        skips.push({
          lineId: line.lineId,
          reason: "unmatched",
          message: "No Inflow payment matches this Stripe charge.",
          amount: gross,
          jobNumber: null,
          invoiceNumber: null,
        });
        continue;
      }
      if (!line.xeroInvoiceId) {
        skips.push({
          lineId: line.lineId,
          reason: "no_xero_invoice",
          message: "Matched a job, but that invoice is not in Xero.",
          amount: gross,
          jobNumber: line.jobNumber,
          invoiceNumber: line.invoiceNumber,
        });
        continue;
      }
      const reference = xeroReference(["Stripe", line.stripeSourceId ?? line.balanceTransactionId, "payout", input.stripePayoutId]);
      if (line.xeroPaymentId) {
        payments.push({
          lineId: line.lineId,
          xeroInvoiceId: line.xeroInvoiceId,
          amount: gross,
          reference,
          jobNumber: line.jobNumber,
          invoiceNumber: line.invoiceNumber,
          alreadyPosted: true,
          xeroPaymentId: line.xeroPaymentId,
          shortfall: 0,
        });
        continue;
      }
      const status = (line.xeroStatus ?? "").toUpperCase();
      if (status === "PAID" || (line.amountDue != null && line.amountDue <= 0.009)) {
        skips.push({
          lineId: line.lineId,
          reason: "already_paid",
          message: "Invoice is already paid in Xero. Skipped so it is not paid twice.",
          amount: gross,
          jobNumber: line.jobNumber,
          invoiceNumber: line.invoiceNumber,
        });
        continue;
      }
      if (status && status !== "AUTHORISED") {
        skips.push({
          lineId: line.lineId,
          reason: "not_authorised",
          message: `Invoice is ${status} in Xero. Authorise it, then post again.`,
          amount: gross,
          jobNumber: line.jobNumber,
          invoiceNumber: line.invoiceNumber,
        });
        continue;
      }
      const due = line.amountDue == null ? gross : round2(line.amountDue);
      const pay = round2(Math.min(gross, Math.max(0, due)));
      if (pay <= 0) {
        skips.push({
          lineId: line.lineId,
          reason: "already_paid",
          message: "Invoice has nothing left owing in Xero.",
          amount: gross,
          jobNumber: line.jobNumber,
          invoiceNumber: line.invoiceNumber,
        });
        continue;
      }
      payments.push({
        lineId: line.lineId,
        xeroInvoiceId: line.xeroInvoiceId,
        amount: pay,
        reference,
        jobNumber: line.jobNumber,
        invoiceNumber: line.invoiceNumber,
        alreadyPosted: false,
        xeroPaymentId: null,
        shortfall: round2(Math.max(0, gross - pay)),
      });
      continue;
    }

    const refundGross = round2(Math.abs(line.amount));
    if (refundGross <= 0) continue;
    if (!line.matched) {
      skips.push({
        lineId: line.lineId,
        reason: "unmatched",
        message: "No Inflow payment matches this Stripe refund.",
        amount: refundGross,
        jobNumber: null,
        invoiceNumber: null,
      });
      continue;
    }
    if (!line.xeroInvoiceId) {
      skips.push({
        lineId: line.lineId,
        reason: "no_xero_invoice",
        message: "Matched a job, but that invoice is not in Xero, so the refund was not posted.",
        amount: refundGross,
        jobNumber: line.jobNumber,
        invoiceNumber: line.invoiceNumber,
      });
      continue;
    }
    const reference = xeroReference([
      "Stripe refund",
      line.stripeSourceId ?? line.balanceTransactionId,
      "payout",
      input.stripePayoutId,
    ]);
    refunds.push({
      lineId: line.lineId,
      xeroInvoiceId: line.xeroInvoiceId,
      amount: refundGross,
      reference,
      jobNumber: line.jobNumber,
      invoiceNumber: line.invoiceNumber,
      alreadyPosted: !!line.xeroRefundPaymentId,
      xeroRefundPaymentId: line.xeroRefundPaymentId,
      stripeSourceId: line.stripeSourceId,
    });
  }

  const paymentDollars = sumAmounts(payments.map((p) => p.amount));
  const refundDollars = sumAmounts(refunds.map((p) => p.amount));
  const fee = Math.abs(fees) >= 0.009
    ? {
        amount: fees,
        reference: xeroReference(["Stripe fees", input.stripePayoutId]),
        alreadyPosted: input.feeAlreadyPosted,
      }
    : null;
  const accounted = round2(paymentDollars - refundDollars - fees);
  const gapDollars = round2(round2(input.payoutDollars) - accounted);
  const netsToPayout = Math.abs(gapDollars) < 0.009;
  return {
    currencyBlocked: null,
    payments,
    refunds,
    fee,
    skips,
    clearing: {
      payoutDollars: round2(input.payoutDollars),
      paymentDollars,
      refundDollars,
      feeDollars: fees,
      gapDollars,
      netsToPayout,
      gapMessage: netsToPayout
        ? "After this post, the Stripe clearing account nets to zero once the payout deposit is coded to it."
        : `The Stripe clearing account will be off by $${Math.abs(gapDollars).toFixed(2)} against this payout. Unmatched or skipped lines were not posted.`,
    },
  };
}
