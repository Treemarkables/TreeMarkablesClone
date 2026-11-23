// Tenant-scoped reads and writes for Stripe payouts. Callers pass businessId
// and also run inside that business's request context.

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { withTenant } from "./tenancy/tenantStore";
import * as schema from "@shared/schema";

export interface PayoutLineView {
  id: string;
  kind: string;
  amount: string;
  fee: string;
  net: string;
  currency: string;
  description: string | null;
  stripeType: string | null;
  stripeSourceId: string | null;
  stripeChargeId: string | null;
  stripePaymentId: string | null;
  balanceTransactionId: string;
  matchStatus: string;
  paymentId: string | null;
  jobId: string | null;
  jobNumber: string | null;
  customerName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  xeroInvoiceId: string | null;
  xeroPaymentId: string | null;
  xeroCreditNoteId: string | null;
  xeroRefundPaymentId: string | null;
  xeroStatus: string | null;
  xeroMessage: string | null;
}

export async function upsertStripePayout(input: {
  businessId: string;
  stripePayoutId: string;
  stripeAccountId: string | null;
  amount: string;
  currency: string;
  status: string;
  arrivalDate: Date | null;
  createdStripe: Date | null;
  description: string | null;
  feeTotal: string;
  chargeTotal: string;
  refundTotal: string;
}): Promise<schema.StripePayout> {
  const values = {
    businessId: input.businessId,
    stripePayoutId: input.stripePayoutId,
    stripeAccountId: input.stripeAccountId,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    arrivalDate: input.arrivalDate,
    createdStripe: input.createdStripe,
    description: input.description,
    feeTotal: input.feeTotal,
    chargeTotal: input.chargeTotal,
    refundTotal: input.refundTotal,
    fetchedAt: new Date(),
    updatedAt: new Date(),
  };
  const [row] = await db.insert(schema.stripePayouts).values(withTenant(values)).onConflictDoUpdate({
    target: [schema.stripePayouts.businessId, schema.stripePayouts.stripePayoutId],
    set: {
      stripeAccountId: values.stripeAccountId,
      amount: values.amount,
      currency: values.currency,
      status: values.status,
      arrivalDate: values.arrivalDate,
      createdStripe: values.createdStripe,
      description: values.description,
      feeTotal: values.feeTotal,
      chargeTotal: values.chargeTotal,
      refundTotal: values.refundTotal,
      fetchedAt: values.fetchedAt,
      updatedAt: values.updatedAt,
    },
  }).returning();
  if (!row) throw new Error("Could not save the Stripe payout");
  return row;
}

export async function upsertStripePayoutLine(input: {
  businessId: string;
  payoutId: string;
  balanceTransactionId: string;
  stripeType: string;
  kind: string;
  amount: string;
  fee: string;
  net: string;
  currency: string;
  description: string | null;
  stripeSourceId: string | null;
  stripeChargeId: string | null;
  stripePaymentId: string | null;
  matchStatus: string;
  paymentId: string | null;
  jobId: string | null;
  invoiceId: string | null;
  customerId: string | null;
}): Promise<void> {
  const values = { ...input, updatedAt: new Date() };
  await db.insert(schema.stripePayoutLines).values(withTenant(values)).onConflictDoUpdate({
    target: [schema.stripePayoutLines.payoutId, schema.stripePayoutLines.balanceTransactionId],
    set: {
      stripeType: values.stripeType,
      kind: values.kind,
      amount: values.amount,
      fee: values.fee,
      net: values.net,
      currency: values.currency,
      description: values.description,
      stripeSourceId: values.stripeSourceId,
      stripeChargeId: values.stripeChargeId,
      stripePaymentId: values.stripePaymentId,
      matchStatus: values.matchStatus,
      paymentId: values.paymentId,
      jobId: values.jobId,
      invoiceId: values.invoiceId,
      customerId: values.customerId,
      updatedAt: values.updatedAt,
    },
  });
}

export async function listStripePayouts(businessId: string): Promise<schema.StripePayout[]> {
  return db.select().from(schema.stripePayouts)
    .where(eq(schema.stripePayouts.businessId, businessId))
    .orderBy(desc(schema.stripePayouts.arrivalDate), desc(schema.stripePayouts.createdStripe));
}

export async function getStripePayout(businessId: string, id: string): Promise<schema.StripePayout | undefined> {
  const [row] = await db.select().from(schema.stripePayouts).where(and(
    eq(schema.stripePayouts.id, id),
    eq(schema.stripePayouts.businessId, businessId),
  )).limit(1);
  return row;
}

export async function listStripePayoutLines(businessId: string, payoutId: string): Promise<PayoutLineView[]> {
  return db.select({
    id: schema.stripePayoutLines.id,
    kind: schema.stripePayoutLines.kind,
    amount: schema.stripePayoutLines.amount,
    fee: schema.stripePayoutLines.fee,
    net: schema.stripePayoutLines.net,
    currency: schema.stripePayoutLines.currency,
    description: schema.stripePayoutLines.description,
    stripeType: schema.stripePayoutLines.stripeType,
    stripeSourceId: schema.stripePayoutLines.stripeSourceId,
    stripeChargeId: schema.stripePayoutLines.stripeChargeId,
    stripePaymentId: schema.stripePayoutLines.stripePaymentId,
    balanceTransactionId: schema.stripePayoutLines.balanceTransactionId,
    matchStatus: schema.stripePayoutLines.matchStatus,
    paymentId: schema.stripePayoutLines.paymentId,
    jobId: schema.stripePayoutLines.jobId,
    jobNumber: schema.jobs.jobNumber,
    customerName: schema.customers.name,
    invoiceId: schema.stripePayoutLines.invoiceId,
    invoiceNumber: schema.invoices.invoiceNumber,
    xeroInvoiceId: schema.invoices.xeroInvoiceId,
    xeroPaymentId: schema.stripePayoutLines.xeroPaymentId,
    xeroCreditNoteId: schema.stripePayoutLines.xeroCreditNoteId,
    xeroRefundPaymentId: schema.stripePayoutLines.xeroRefundPaymentId,
    xeroStatus: schema.stripePayoutLines.xeroStatus,
    xeroMessage: schema.stripePayoutLines.xeroMessage,
  }).from(schema.stripePayoutLines)
    .leftJoin(schema.jobs, eq(schema.stripePayoutLines.jobId, schema.jobs.id))
    .leftJoin(schema.customers, eq(schema.stripePayoutLines.customerId, schema.customers.id))
    .leftJoin(schema.invoices, eq(schema.stripePayoutLines.invoiceId, schema.invoices.id))
    .where(and(
      eq(schema.stripePayoutLines.payoutId, payoutId),
      eq(schema.stripePayoutLines.businessId, businessId),
    ));
}

export async function findPaymentsForStripeIds(businessId: string, ids: string[]): Promise<schema.Payment[]> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) return [];
  const rows = await db.select().from(schema.payments).where(or(
    inArray(schema.payments.providerPaymentId, unique),
    inArray(schema.payments.providerSessionId, unique),
  ));
  const jobIds = [...new Set(rows.map((row) => row.jobId).filter((id): id is string => !!id))];
  const invoiceIds = [...new Set(rows.map((row) => row.invoiceId).filter((id): id is string => !!id))];
  const jobBusiness = new Map<string, string | null>();
  const invoiceBusiness = new Map<string, string | null>();
  if (jobIds.length > 0) {
    const jobs = await db.select({ id: schema.jobs.id, businessId: schema.jobs.businessId })
      .from(schema.jobs)
      .where(inArray(schema.jobs.id, jobIds));
    for (const job of jobs) jobBusiness.set(job.id, job.businessId);
  }
  if (invoiceIds.length > 0) {
    const invoices = await db.select({ id: schema.invoices.id, businessId: schema.invoices.businessId })
      .from(schema.invoices)
      .where(inArray(schema.invoices.id, invoiceIds));
    for (const invoice of invoices) invoiceBusiness.set(invoice.id, invoice.businessId);
  }
  return rows.filter((row) => {
    if (row.businessId === businessId) return true;
    if (row.businessId) return false;
    if (row.jobId && jobBusiness.get(row.jobId) === businessId) return true;
    if (row.invoiceId && invoiceBusiness.get(row.invoiceId) === businessId) return true;
    return false;
  });
}

export async function invoicesForJobs(businessId: string, jobIds: string[]) {
  const unique = [...new Set(jobIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return [];
  return db.select({
    id: schema.invoices.id,
    jobId: schema.invoices.jobId,
    businessId: schema.invoices.businessId,
    xeroInvoiceId: schema.invoices.xeroInvoiceId,
    invoiceNumber: schema.invoices.invoiceNumber,
    customerId: schema.invoices.customerId,
    createdAt: schema.invoices.createdAt,
  }).from(schema.invoices).where(and(
    inArray(schema.invoices.jobId, unique),
    or(eq(schema.invoices.businessId, businessId), isNull(schema.invoices.businessId)),
  ));
}

export async function customersForJobs(businessId: string, jobIds: string[]) {
  const unique = [...new Set(jobIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return [];
  return db.select({
    id: schema.jobs.id,
    customerId: schema.jobs.customerId,
    businessId: schema.jobs.businessId,
  }).from(schema.jobs).where(and(
    inArray(schema.jobs.id, unique),
    or(eq(schema.jobs.businessId, businessId), isNull(schema.jobs.businessId)),
  ));
}

export async function tryLockStripePayout(businessId: string, id: string): Promise<boolean> {
  const [row] = await db.update(schema.stripePayouts)
    .set({ xeroPostingAt: new Date() })
    .where(and(
      eq(schema.stripePayouts.id, id),
      eq(schema.stripePayouts.businessId, businessId),
      or(
        isNull(schema.stripePayouts.xeroPostingAt),
        sql`${schema.stripePayouts.xeroPostingAt} < now() - interval '2 minutes'`,
      ),
    ))
    .returning({ id: schema.stripePayouts.id });
  return !!row;
}

export async function unlockStripePayout(businessId: string, id: string): Promise<void> {
  await db.update(schema.stripePayouts)
    .set({ xeroPostingAt: null })
    .where(and(eq(schema.stripePayouts.id, id), eq(schema.stripePayouts.businessId, businessId)));
}

export async function savePayoutLineXero(businessId: string, lineId: string, patch: {
  xeroPaymentId?: string | null;
  xeroCreditNoteId?: string | null;
  xeroRefundPaymentId?: string | null;
  xeroStatus?: string | null;
  xeroMessage?: string | null;
}): Promise<void> {
  const set: {
    updatedAt: Date;
    xeroPaymentId?: string | null;
    xeroCreditNoteId?: string | null;
    xeroRefundPaymentId?: string | null;
    xeroStatus?: string | null;
    xeroMessage?: string | null;
  } = { updatedAt: new Date() };
  if (patch.xeroPaymentId) set.xeroPaymentId = patch.xeroPaymentId;
  if (patch.xeroCreditNoteId) set.xeroCreditNoteId = patch.xeroCreditNoteId;
  if (patch.xeroRefundPaymentId) set.xeroRefundPaymentId = patch.xeroRefundPaymentId;
  if (patch.xeroStatus !== undefined) set.xeroStatus = patch.xeroStatus;
  if (patch.xeroMessage !== undefined) set.xeroMessage = patch.xeroMessage;
  await db.update(schema.stripePayoutLines)
    .set(set)
    .where(and(eq(schema.stripePayoutLines.id, lineId), eq(schema.stripePayoutLines.businessId, businessId)));
}

export async function savePayoutXero(businessId: string, payoutId: string, patch: {
  xeroFeeId?: string | null;
  xeroFeeKind?: string | null;
  xeroFeeMessage?: string | null;
  xeroPostedAt?: Date | null;
  xeroSummary?: unknown;
}): Promise<void> {
  await db.update(schema.stripePayouts)
    .set({
      ...(patch.xeroFeeId ? { xeroFeeId: patch.xeroFeeId } : {}),
      ...(patch.xeroFeeKind ? { xeroFeeKind: patch.xeroFeeKind } : {}),
      ...(patch.xeroFeeMessage !== undefined ? { xeroFeeMessage: patch.xeroFeeMessage } : {}),
      ...(patch.xeroPostedAt !== undefined ? { xeroPostedAt: patch.xeroPostedAt } : {}),
      ...(patch.xeroSummary !== undefined ? { xeroSummary: patch.xeroSummary } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.stripePayouts.id, payoutId), eq(schema.stripePayouts.businessId, businessId)));
}
