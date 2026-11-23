/**
 * Completed jobs that still need an invoice or a send to the customer.
 *
 * A sent invoice that is not in Xero is NOT queued here. That job already
 * has one item, on the Not in Xero tab. One job, one item, at the furthest
 * step that is still missing.
 *
 * Nothing here creates an invoice or contacts a customer.
 */

import { DAY_MS, SENT_LOOKBACK_DAYS } from "./quoteFollowUps";
import { invoiceNeedsXeroSync, wasSentToClient } from "./invoiceXeroFollowUps";

export type BillingGap = "create_invoice" | "send_invoice" | "sync_xero" | "billed";
export type NotBilledStep = "create_invoice" | "send_invoice";

export interface NotBilledInvoice {
  id: string;
  status: string;
  sentDate?: string | Date | null;
  xeroInvoiceId?: string | null;
  invoiceNumber?: string | null;
}

export interface NotBilledJob {
  id: string;
  businessId: string;
  status: string;
  completedDate?: string | Date | null;
  updatedAt?: string | Date | null;
  customerId?: string | null;
  invoices: NotBilledInvoice[];
  xeroInvoiceId?: string | null;
  xeroStatus?: string | null;
}

export interface ExistingNotBilled {
  businessId: string;
  jobId: string;
  status: string;
  step: string;
}

export interface PlanJobsNotBilledInput {
  now: number;
  businessId: string;
  lookbackDays?: number;
  jobs: NotBilledJob[];
  existing: ExistingNotBilled[];
}

export interface PlannedNotBilledCreate {
  action: "create" | "reopen";
  businessId: string;
  jobId: string;
  customerId: string | null;
  step: NotBilledStep;
  invoiceId: string | null;
}

export interface PlannedNotBilledAdvance {
  action: "advance";
  businessId: string;
  jobId: string;
  step: NotBilledStep;
  invoiceId: string | null;
}

export interface PlannedNotBilledCancel {
  action: "cancel";
  businessId: string;
  jobId: string;
}

export type NotBilledPlan = PlannedNotBilledCreate | PlannedNotBilledAdvance | PlannedNotBilledCancel;

export interface BillingLine {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface DraftInvoicePreview {
  source: "quote" | "job";
  quoteId: string | null;
  invoiceNumber: string;
  description: string;
  lines: BillingLine[];
  subtotal: number;
  gst: number;
  total: number;
  currency: "NZD";
  blockingReason: string | null;
}

const ABSENT_INVOICE = new Set(["cancelled", "void", "voided"]);
const OPEN_ROW = new Set(["draft", "snoozed", "working"]);
const REOPENABLE = new Set(["done", "cancelled"]);
const GST = 0.15;

function timeOf(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
}

export function activeInvoices(invoices: NotBilledInvoice[]): NotBilledInvoice[] {
  return invoices.filter((invoice) => !ABSENT_INVOICE.has(invoice.status.trim().toLowerCase()));
}

function clientHasInvoice(invoice: NotBilledInvoice): boolean {
  const status = invoice.status.trim().toLowerCase();
  if (status === "paid" || status === "overdue") return true;
  return wasSentToClient({ status: invoice.status, sentDate: invoice.sentDate ?? null });
}

export function billingGap(job: Pick<NotBilledJob, "status" | "invoices" | "xeroInvoiceId" | "xeroStatus">): BillingGap {
  if (job.status.trim().toLowerCase() !== "completed") return "billed";
  const active = activeInvoices(job.invoices);
  const xeroStatus = (job.xeroStatus ?? "").trim().toLowerCase();
  const jobAlreadyInXero = (job.xeroInvoiceId ?? "").trim().length > 0
    && xeroStatus !== "pending"
    && xeroStatus !== "failed"
    && xeroStatus !== "error";
  // Older sends wrote the Xero id on the job and did not always leave an invoices row.
  if (active.length === 0) return jobAlreadyInXero ? "billed" : "create_invoice";
  if (jobAlreadyInXero && active.every((invoice) => !clientHasInvoice(invoice))) return "billed";
  const sent = active.filter(clientHasInvoice);
  if (sent.length === 0) return "send_invoice";
  const synced = sent.some((invoice) => !invoiceNeedsXeroSync({
    xeroInvoiceId: invoice.xeroInvoiceId,
    jobXeroInvoiceId: job.xeroInvoiceId,
    xeroStatus: job.xeroStatus,
  }));
  if (synced) return "billed";
  return "sync_xero";
}

function inWindow(job: NotBilledJob, now: number, lookbackDays: number): boolean {
  const anchor = timeOf(job.completedDate) ?? timeOf(job.updatedAt);
  if (anchor == null) return false;
  return now - anchor <= lookbackDays * DAY_MS;
}

function sentInvoiceId(job: NotBilledJob): string | null {
  const sent = activeInvoices(job.invoices).find(clientHasInvoice);
  return sent?.id ?? activeInvoices(job.invoices)[0]?.id ?? null;
}

export function planJobsNotBilled(input: PlanJobsNotBilledInput): NotBilledPlan[] {
  const plans: NotBilledPlan[] = [];
  const lookbackDays = input.lookbackDays ?? SENT_LOOKBACK_DAYS;
  for (const job of input.jobs) {
    if (job.businessId !== input.businessId) continue;
    const existing = input.existing.find((row) => row.businessId === input.businessId && row.jobId === job.id);
    const gap = inWindow(job, input.now, lookbackDays) ? billingGap(job) : "billed";
    const step: NotBilledStep | null = gap === "create_invoice" || gap === "send_invoice" ? gap : null;
    if (!step) {
      if (existing && OPEN_ROW.has(existing.status)) {
        plans.push({ action: "cancel", businessId: input.businessId, jobId: job.id });
      }
      continue;
    }
    const invoiceId = step === "send_invoice" ? sentInvoiceId(job) : null;
    if (!existing) {
      plans.push({
        action: "create",
        businessId: input.businessId,
        jobId: job.id,
        customerId: job.customerId ?? null,
        step,
        invoiceId,
      });
      continue;
    }
    if (existing.status === "dismissed") continue;
    if (OPEN_ROW.has(existing.status) && existing.step !== step) {
      plans.push({ action: "advance", businessId: input.businessId, jobId: job.id, step, invoiceId });
      continue;
    }
    if (REOPENABLE.has(existing.status)) {
      plans.push({
        action: "reopen",
        businessId: input.businessId,
        jobId: job.id,
        customerId: job.customerId ?? null,
        step,
        invoiceId,
      });
    }
  }
  return plans;
}

function linesFrom(items: unknown): BillingLine[] {
  return asRecords(items).map((item) => {
    const quantityRaw = Number(item.quantity);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw !== 0 ? quantityRaw : 1;
    const explicit = Number(item.rate ?? item.unitPrice);
    const total = Number(item.total ?? item.amount ?? item.totalPrice);
    const rate = Number.isFinite(explicit) ? explicit : (Number.isFinite(total) ? total / quantity : 0);
    const description = typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : "Tree service";
    return {
      description,
      quantity,
      rate: roundMoney(rate),
      amount: roundMoney(quantity * rate),
    };
  }).filter((line) => line.description.length > 0);
}

function oneLine(description: string, amount: number): BillingLine[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const rounded = roundMoney(amount);
  return [{ description, quantity: 1, rate: rounded, amount: rounded }];
}

export function buildDraftInvoice(input: {
  jobNumber: string;
  jobTitle?: string | null;
  jobDescription?: string | null;
  quotes: {
    id: string;
    status: string;
    description?: string | null;
    amount?: string | number | null;
    lineItems?: unknown;
  }[];
  jobLineItems?: unknown;
  jobTotal?: string | number | null;
}): DraftInvoicePreview {
  const accepted = input.quotes.find((quote) => quote.status.trim().toLowerCase() === "accepted");
  const quoteLines = accepted ? linesFrom(accepted.lineItems) : [];
  const quoteAmount = Number(accepted?.amount);
  const fromQuote = quoteLines.length > 0
    ? quoteLines
    : (accepted ? oneLine(accepted.description?.trim() || input.jobTitle?.trim() || "Tree service", quoteAmount) : []);
  const jobLines = linesFrom(input.jobLineItems);
  const jobAmount = Number(input.jobTotal);
  const lines = fromQuote.length > 0
    ? fromQuote
    : (jobLines.length > 0
      ? jobLines
      : oneLine(input.jobDescription?.trim() || input.jobTitle?.trim() || "Tree service", jobAmount));
  const source = fromQuote.length > 0 ? "quote" : "job";
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const gst = roundMoney(subtotal * GST);
  const total = roundMoney(subtotal + gst);
  const description = (accepted?.description || input.jobDescription || input.jobTitle || "Tree service").trim();
  return {
    source,
    quoteId: fromQuote.length > 0 && accepted ? accepted.id : null,
    invoiceNumber: input.jobNumber,
    description,
    lines,
    subtotal,
    gst,
    total,
    currency: "NZD",
    blockingReason: lines.length === 0 || subtotal <= 0
      ? "Add a price on the accepted quote or the job before creating the invoice."
      : null,
  };
}

export function buildInvoiceSendDraft(input: {
  customerName?: string | null;
  invoiceNumber: string;
  invoiceUrl: string;
  businessName: string;
}): { subject: string; message: string } {
  const name = input.customerName?.trim();
  const hello = name ? `Hi ${name.split(" ")[0]}` : "Hi";
  const message = `${hello}, your invoice ${input.invoiceNumber} from ${input.businessName} is ready: ${input.invoiceUrl}`;
  return {
    subject: `Invoice ${input.invoiceNumber}`,
    message,
  };
}

export function isWaitingNotBilled(status: string, snoozeUntil: string | Date | null | undefined, now: number): boolean {
  if (status === "draft") return true;
  if (status === "snoozed") {
    const until = timeOf(snoozeUntil);
    return until == null || until <= now;
  }
  return false;
}

export function jobsNotBilledQueuePath(followUpId?: string | null): string {
  if (!followUpId) return "/quote-follow-ups?tab=billed";
  return `/quote-follow-ups?tab=billed&id=${encodeURIComponent(followUpId)}`;
}

export function jobCardPath(jobId: string): string {
  return `/dispatch?job=${encodeURIComponent(jobId)}`;
}
