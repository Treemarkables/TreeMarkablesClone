// Paid amount and balance due are derived from the payments ledger.
// The Stripe invoice webhook used to insert a payments row and mark the
// invoice paid, then return without touching jobs.paid_amount / balance_due.
// Both the webhook and the one-off backfill use this so a second run is a no-op.

export interface LedgerPayment {
  id?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
  amount: string | number | null;
  status: string | null;
  kind: string | null;
  paidAt?: string | Date | null;
}

export function paymentAmount(amount: string | number | null | undefined): number {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount ?? ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function toCents(amount: string | number | null | undefined): number {
  return Math.round(paymentAmount(amount) * 100);
}

/** Succeeded money in, minus succeeded refunds. Pending, failed, and refunded rows do not count. */
export function netSucceededPaid(rows: LedgerPayment[]): number {
  const seen = new Set<string>();
  let cents = 0;
  for (const row of rows) {
    if (row.id) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    if (row.status !== "succeeded") continue;
    const centsAmt = Math.abs(toCents(row.amount));
    if (row.kind === "refund") cents -= centsAmt;
    else cents += centsAmt;
  }
  return cents / 100;
}

export function balanceDueForTotal(
  totalAmount: string | number | null | undefined,
  paid: number,
): number {
  const total = paymentAmount(totalAmount);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export function jobPaidUpdate(
  job: {
    paidAmount?: string | number | null;
    balanceDue?: string | number | null;
    totalAmount?: string | number | null;
  },
  payments: LedgerPayment[],
): { paidAmount: string; balanceDue: string; changed: boolean } {
  const paid = netSucceededPaid(payments);
  const balance = balanceDueForTotal(job.totalAmount, paid);
  const paidAmount = paid.toFixed(2);
  const balanceDue = balance.toFixed(2);
  const changed =
    paymentAmount(job.paidAmount).toFixed(2) !== paidAmount ||
    paymentAmount(job.balanceDue).toFixed(2) !== balanceDue;
  return { paidAmount, balanceDue, changed };
}

const CLOSED_INVOICE = new Set(["paid", "cancelled", "canceled", "void", "voided"]);

/**
 * A succeeded invoice checkout (kind payment) marks the invoice paid.
 * Deposits and refunds do not. Paid and cancelled invoices are left as they are.
 */
export function invoiceShouldMarkPaid(
  status: string | null | undefined,
  payments: LedgerPayment[],
): boolean {
  const current = (status ?? "").toLowerCase();
  if (CLOSED_INVOICE.has(current)) return false;
  return payments.some((p) => p.status === "succeeded" && p.kind === "payment" && p.invoiceId);
}

export interface BackfillRow {
  paymentId: string;
  paymentJobId: string | null;
  invoiceId: string | null;
  invoiceJobId: string | null;
  invoiceStatus: string | null;
  invoiceNumber: string | null;
  invoiceBusinessId: string | null;
  amount: string | number | null;
  status: string | null;
  kind: string | null;
  paidAt: string | null;
  jobId: string | null;
  jobBusinessId: string | null;
  jobNumber: string | null;
  totalAmount: string | number | null;
  paidAmount: string | number | null;
  balanceDue: string | number | null;
}

export interface BackfillPlan {
  jobs: Array<{
    jobId: string;
    businessId: string | null;
    jobNumber: string | null;
    paidAmount: string;
    balanceDue: string;
    previousPaid: string;
    previousBalance: string;
  }>;
  invoices: Array<{
    invoiceId: string;
    businessId: string | null;
    invoiceNumber: string | null;
    paidAt: string | null;
  }>;
  paymentJobLinks: Array<{ paymentId: string; jobId: string }>;
  unchangedJobs: number;
  skippedPayments: number;
}

/** Idempotent plan. A second call with the results applied returns no writes. */
export function planPaidBackfill(rows: BackfillRow[]): BackfillPlan {
  const byJob = new Map<string, BackfillRow[]>();
  let skippedPayments = 0;
  for (const row of rows) {
    if (!row.jobId) {
      skippedPayments += 1;
      continue;
    }
    const list = byJob.get(row.jobId) ?? [];
    list.push(row);
    byJob.set(row.jobId, list);
  }

  const jobs: BackfillPlan["jobs"] = [];
  const invoices: BackfillPlan["invoices"] = [];
  const paymentJobLinks: BackfillPlan["paymentJobLinks"] = [];
  let unchangedJobs = 0;
  const seenInvoices = new Set<string>();
  const seenLinks = new Set<string>();

  for (const [jobId, group] of byJob) {
    const sample = group[0];
    const payments: LedgerPayment[] = group.map((row) => ({
      id: row.paymentId,
      jobId: row.jobId,
      invoiceId: row.invoiceId,
      amount: row.amount,
      status: row.status,
      kind: row.kind,
      paidAt: row.paidAt,
    }));
    const update = jobPaidUpdate(
      {
        paidAmount: sample.paidAmount,
        balanceDue: sample.balanceDue,
        totalAmount: sample.totalAmount,
      },
      payments,
    );
    if (update.changed) {
      jobs.push({
        jobId,
        businessId: sample.jobBusinessId,
        jobNumber: sample.jobNumber,
        paidAmount: update.paidAmount,
        balanceDue: update.balanceDue,
        previousPaid: paymentAmount(sample.paidAmount).toFixed(2),
        previousBalance: paymentAmount(sample.balanceDue).toFixed(2),
      });
    } else {
      unchangedJobs += 1;
    }

    for (const row of group) {
      if (row.invoiceId && !seenInvoices.has(row.invoiceId)) {
        const invPayments = payments.filter((p) => p.invoiceId === row.invoiceId);
        if (invoiceShouldMarkPaid(row.invoiceStatus, invPayments)) {
          seenInvoices.add(row.invoiceId);
          const paidAt = group
            .filter((p) => p.invoiceId === row.invoiceId && p.status === "succeeded" && p.kind === "payment")
            .map((p) => p.paidAt)
            .filter((p): p is string => !!p)
            .sort()
            .at(-1) ?? null;
          invoices.push({
            invoiceId: row.invoiceId,
            businessId: row.invoiceBusinessId ?? sample.jobBusinessId,
            invoiceNumber: row.invoiceNumber,
            paidAt,
          });
        }
      }
      if (row.paymentJobId == null && row.invoiceJobId && row.status === "succeeded" && !seenLinks.has(row.paymentId)) {
        seenLinks.add(row.paymentId);
        paymentJobLinks.push({ paymentId: row.paymentId, jobId: row.invoiceJobId });
      }
    }
  }

  return { jobs, invoices, paymentJobLinks, unchangedJobs, skippedPayments };
}
