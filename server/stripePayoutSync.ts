// Pull payouts from the business's Stripe account and match each balance
// transaction to a payments row by charge id or payment intent id.

import { businessOwnsStripeAccount, isStripeConfigured, listPayoutBalanceTransactions, listStripePayouts, type ListedStripePayout } from "./stripe";
import { storage } from "./storage";
import { ownerDb } from "./db";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { TREEMARKABLES_BUSINESS_IDS } from "@shared/roleChecklistAccess";
import { runWithBusiness } from "./tenancy/tenantStore";
import {
  choosePlatformBusinessId,
  classifyBalanceTransaction,
  feeDollars,
  matchLineToPayment,
  resolvePayoutStripeAccount,
  round2,
  type PaymentMatchKey,
} from "@shared/stripePayouts";
import {
  customersForJobs,
  findPaymentsForStripeIds,
  invoicesForJobs,
  upsertStripePayout,
  upsertStripePayoutLine,
} from "./stripePayoutStore";

export class PayoutSyncError extends Error {}

function money(n: number): string {
  return round2(n).toFixed(2);
}

function sum(values: number[]): number {
  return values.reduce((cents, value) => cents + Math.round(round2(value) * 100), 0) / 100;
}

async function businessIdForPayoutEvent(stripeAccountId: string | null): Promise<string | null> {
  if (stripeAccountId) {
    const [row] = await ownerDb.select({ businessId: schema.businessSettings.businessId })
      .from(schema.businessSettings)
      .where(eq(schema.businessSettings.stripeConnectAccountId, stripeAccountId))
      .limit(1);
    return row?.businessId ?? null;
  }
  const rows = await ownerDb.select({ businessId: schema.businessSettings.businessId })
    .from(schema.businessSettings)
    .where(and(
      inArray(schema.businessSettings.businessId, [...TREEMARKABLES_BUSINESS_IDS]),
    ));
  return choosePlatformBusinessId(
    rows.map((row) => row.businessId).filter((id): id is string => !!id),
    TREEMARKABLES_BUSINESS_IDS,
  );
}

export async function syncOneStripePayout(
  businessId: string,
  payout: ListedStripePayout,
  stripeAccountId: string | null,
): Promise<number> {
  const transactions = await listPayoutBalanceTransactions({
    payoutId: payout.id,
    stripeAccountId,
  });
  const lines = transactions.map(classifyBalanceTransaction).filter((line) => !line.ignore && line.balanceTransactionId);
  const ids = lines.flatMap((line) => [line.stripePaymentId, line.stripeChargeId, line.stripeSourceId])
    .filter((id): id is string => !!id);
  const paymentRows = await findPaymentsForStripeIds(businessId, ids);
  const payments: PaymentMatchKey[] = paymentRows.map((row) => ({
    id: row.id,
    providerPaymentId: row.providerPaymentId,
    providerSessionId: row.providerSessionId,
    jobId: row.jobId,
    invoiceId: row.invoiceId,
    customerId: row.customerId,
  }));
  const jobIds = payments.map((row) => row.jobId).filter((id): id is string => !!id);
  const [invoiceRows, jobRows] = await Promise.all([
    invoicesForJobs(businessId, jobIds),
    customersForJobs(businessId, jobIds),
  ]);
  const invoicesByJob = new Map<string, typeof invoiceRows>();
  for (const invoice of invoiceRows) {
    if (!invoice.jobId) continue;
    const list = invoicesByJob.get(invoice.jobId) ?? [];
    list.push(invoice);
    invoicesByJob.set(invoice.jobId, list);
  }
  const customerByJob = new Map(jobRows.map((job) => [job.id, job.customerId]));

  const saved = await upsertStripePayout({
    businessId,
    stripePayoutId: payout.id,
    stripeAccountId,
    amount: money(payout.amountCents / 100),
    currency: (payout.currency || "nzd").toUpperCase(),
    status: payout.status,
    arrivalDate: payout.arrivalDate,
    createdStripe: payout.created,
    description: payout.description,
    feeTotal: money(feeDollars(lines)),
    chargeTotal: money(sum(lines.filter((line) => line.kind === "charge").map((line) => line.amount))),
    refundTotal: money(sum(lines.filter((line) => line.kind === "refund").map((line) => Math.abs(line.amount)))),
  });

  for (const line of lines) {
    const payment = matchLineToPayment(line, payments);
    let invoiceId = payment?.invoiceId ?? null;
    let customerId = payment?.customerId ?? null;
    const jobId = payment?.jobId ?? null;
    if (jobId && !customerId) customerId = customerByJob.get(jobId) ?? null;
    if (jobId && !invoiceId) {
      const choices = invoicesByJob.get(jobId) ?? [];
      const best = [...choices].sort((a, b) => {
        const ax = a.xeroInvoiceId ? 1 : 0;
        const bx = b.xeroInvoiceId ? 1 : 0;
        if (ax !== bx) return bx - ax;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      })[0];
      invoiceId = best?.id ?? null;
      if (!customerId) customerId = best?.customerId ?? null;
    }
    const matchStatus = line.kind === "fee" ? "fee" : payment ? "matched" : "unmatched";
    await upsertStripePayoutLine({
      businessId,
      payoutId: saved.id,
      balanceTransactionId: line.balanceTransactionId,
      stripeType: line.stripeType,
      kind: line.kind,
      amount: money(line.amount),
      fee: money(line.fee),
      net: money(line.net),
      currency: (line.currency || payout.currency || "nzd").toUpperCase(),
      description: line.description || null,
      stripeSourceId: line.stripeSourceId,
      stripeChargeId: line.stripeChargeId,
      stripePaymentId: line.stripePaymentId,
      matchStatus,
      paymentId: payment?.id ?? null,
      jobId,
      invoiceId,
      customerId,
    });
  }
  return lines.length;
}

export async function syncStripePayoutsForBusiness(businessId: string, limit: number): Promise<{ payouts: number; lines: number }> {
  if (!isStripeConfigured()) {
    throw new PayoutSyncError("Stripe is not configured on this server.");
  }
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const resolved = resolvePayoutStripeAccount({
    stripeConnectAccountId: settings?.stripeConnectAccountId,
    ownsPlatformAccount: businessOwnsStripeAccount(businessId),
  });
  if ("error" in resolved) throw new PayoutSyncError(resolved.error);
  const payouts = await listStripePayouts({ stripeAccountId: resolved.stripeAccountId, limit });
  let lines = 0;
  for (const payout of payouts) {
    lines += await syncOneStripePayout(businessId, payout, resolved.stripeAccountId);
  }
  return { payouts: payouts.length, lines };
}

export async function ingestStripePayoutWebhook(event: {
  account?: string;
  data?: { object?: Record<string, unknown> };
}): Promise<void> {
  const payout = event.data?.object;
  const id = payout && typeof payout.id === "string" ? payout.id : "";
  if (!id.startsWith("po_")) return;
  const stripeAccountId = typeof event.account === "string" && event.account.startsWith("acct_") ? event.account : null;
  const businessId = await businessIdForPayoutEvent(stripeAccountId);
  if (!businessId) {
    console.log(`Stripe payout webhook: no business for ${stripeAccountId ?? "platform account"}`);
    return;
  }
  const record: ListedStripePayout = {
    id,
    amountCents: typeof payout?.amount === "number" ? payout.amount : 0,
    currency: typeof payout?.currency === "string" ? payout.currency : "nzd",
    status: typeof payout?.status === "string" ? payout.status : "pending",
    arrivalDate: typeof payout?.arrival_date === "number" ? new Date(payout.arrival_date * 1000) : null,
    created: typeof payout?.created === "number" ? new Date(payout.created * 1000) : null,
    description: typeof payout?.description === "string" ? payout.description : null,
  };
  await runWithBusiness(businessId, () => syncOneStripePayout(businessId, record, stripeAccountId));
}
