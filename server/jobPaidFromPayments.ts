// Apply the payments ledger onto a job. Safe to call more than once.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import {
  invoiceShouldMarkPaid,
  jobPaidUpdate,
  type LedgerPayment,
} from "@shared/jobPaidFromPayments";

export async function reconcileJobPaidFromPayments(jobId: string): Promise<{
  paidAmount: string;
  balanceDue: string;
  changed: boolean;
  invoicesMarkedPaid: string[];
}> {
  const job = await storage.getJob(jobId);
  if (!job) {
    return { paidAmount: "0.00", balanceDue: "0.00", changed: false, invoicesMarkedPaid: [] };
  }

  const byJob = await storage.getPaymentsByJob(jobId);
  const invoices = await storage.getInvoicesByJob(jobId);
  const extra: typeof byJob = [];
  for (const invoice of invoices) {
    const rows = await storage.getPaymentsByInvoice(invoice.id);
    extra.push(...rows);
  }
  const payments: LedgerPayment[] = [...byJob, ...extra].map((row) => ({
    id: row.id,
    jobId: row.jobId,
    invoiceId: row.invoiceId,
    amount: row.amount,
    status: row.status,
    kind: row.kind,
    paidAt: row.paidAt,
  }));

  const update = jobPaidUpdate(
    { paidAmount: job.paidAmount, balanceDue: job.balanceDue, totalAmount: job.totalAmount },
    payments,
  );
  if (update.changed) {
    await storage.updateJob(jobId, { paidAmount: update.paidAmount, balanceDue: update.balanceDue });
    console.log(`Job ${job.jobNumber} paid amount set to ${update.paidAmount} from succeeded payments (balance ${update.balanceDue})`);
  }

  const invoicesMarkedPaid: string[] = [];
  for (const invoice of invoices) {
    const invPayments = payments.filter((p) => p.invoiceId === invoice.id);
    if (!invoiceShouldMarkPaid(invoice.status, invPayments)) continue;
    const paidAtRaw = invPayments
      .filter((p) => p.status === "succeeded" && p.kind === "payment" && p.paidAt)
      .map((p) => (p.paidAt instanceof Date ? p.paidAt : new Date(String(p.paidAt))))
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1);
    await storage.updateInvoice(invoice.id, {
      status: "paid",
      paidAt: invoice.paidAt ?? paidAtRaw ?? new Date(),
    });
    invoicesMarkedPaid.push(invoice.id);
  }

  for (const row of extra) {
    if (row.jobId || row.status !== "succeeded") continue;
    await db.update(schema.payments)
      .set({ jobId })
      .where(and(eq(schema.payments.id, row.id), isNull(schema.payments.jobId)));
  }

  return { ...update, invoicesMarkedPaid };
}
