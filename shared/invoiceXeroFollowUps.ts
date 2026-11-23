/**
 * Invoices that were sent to the customer and are not in Xero yet.
 *
 * Pure planning and the preview of what Approve & Sync will create.
 * Nothing here talks to Xero.
 *
 * The hourly job (invoiceXeroDetection) loads one tenant's sent invoices
 * and existing rows, then persists whatever this plans. One row per invoice.
 */

import { SENT_LOOKBACK_DAYS, DAY_MS } from "./quoteFollowUps";

export const XERO_SYNCED_OK = "sent";

export interface InvoiceXeroSignal {
  id: string;
  businessId: string;
  jobId: string | null;
  customerId: string | null;
  invoiceNumber: string;
  status: string;
  sentDate: string | Date | null;
  updatedAt?: string | Date | null;
  amount?: string | number | null;
  description?: string | null;
  dueDate?: string | Date | null;
  address?: string | null;
  items?: unknown;
  xeroInvoiceId?: string | null;
  jobXeroInvoiceId?: string | null;
  xeroStatus?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  jobNumber?: string | null;
  jobTitle?: string | null;
}

export interface ExistingInvoiceXeroFollowUp {
  businessId: string;
  invoiceId: string;
  status: string;
}

export interface PlanInvoiceXeroInput {
  now: number;
  businessId: string;
  lookbackDays?: number;
  invoices: InvoiceXeroSignal[];
  existing: ExistingInvoiceXeroFollowUp[];
}

export interface PlannedInvoiceXeroCreate {
  action: "create" | "reopen";
  businessId: string;
  invoiceId: string;
  jobId: string | null;
  customerId: string | null;
}

export interface PlannedInvoiceXeroCancel {
  action: "cancel";
  businessId: string;
  invoiceId: string;
}

export type InvoiceXeroPlan = PlannedInvoiceXeroCreate | PlannedInvoiceXeroCancel;

export interface XeroPreviewLine {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  lineTotal: number;
}

export interface XeroSyncPreview {
  currency: "NZD";
  contact: { name: string; email: string | null; phone: string | null };
  invoiceNumber: string;
  reference: string | null;
  dueDate: string | null;
  statusInXero: "AUTHORISED";
  accountCode: string;
  taxType: string;
  gstRate: number;
  lineItems: XeroPreviewLine[];
  subtotal: number;
  gst: number;
  total: number;
  blockingReason: string | null;
}

const CLOSED = new Set(["cancelled", "void", "voided", "draft"]);
const FAILED_SYNC = new Set(["pending", "failed", "error"]);
const OPEN_FOLLOW_UP = new Set(["draft", "snoozed", "syncing"]);
const REOPENABLE = new Set(["synced", "cancelled"]);

function timeOf(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function wasSentToClient(invoice: Pick<InvoiceXeroSignal, "status" | "sentDate">): boolean {
  const status = invoice.status.trim().toLowerCase();
  if (CLOSED.has(status)) return false;
  if (timeOf(invoice.sentDate) != null) return true;
  return status === "sent";
}

export function invoiceNeedsXeroSync(invoice: Pick<InvoiceXeroSignal, "xeroInvoiceId" | "jobXeroInvoiceId" | "xeroStatus">): boolean {
  const status = (invoice.xeroStatus ?? "").trim().toLowerCase();
  if (FAILED_SYNC.has(status)) return true;
  const id = (invoice.xeroInvoiceId || invoice.jobXeroInvoiceId || "").trim();
  return id.length === 0;
}

export function gstRateForTaxType(taxType: string): number {
  const code = taxType.trim().toUpperCase();
  if (code === "NONE" || code === "EXEMPTOUTPUT" || code === "ZERORATED" || code === "BASEXCLUDED") return 0;
  return 0.15;
}

function asItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
}

function lineFromItem(item: Record<string, unknown>, accountCode: string, taxType: string): XeroPreviewLine {
  const quantityRaw = Number(item.quantity);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw !== 0 ? quantityRaw : 1;
  const explicit = Number(item.rate ?? item.unitPrice);
  const total = Number(item.total ?? item.amount ?? item.totalPrice);
  const unitAmount = Number.isFinite(explicit) && explicit > 0
    ? explicit
    : (Number.isFinite(total) ? total / quantity : 0);
  const description = typeof item.description === "string" && item.description.trim()
    ? item.description.trim()
    : "Tree service";
  return {
    description,
    quantity,
    unitAmount: roundMoney(unitAmount),
    accountCode,
    taxType,
    lineTotal: roundMoney(quantity * unitAmount),
  };
}

export function buildXeroSyncPreview(input: {
  invoice: InvoiceXeroSignal;
  accountCode?: string | null;
  taxType?: string | null;
}): XeroSyncPreview {
  const accountCode = input.accountCode?.trim() || "200";
  const taxType = input.taxType?.trim() || "OUTPUT2";
  const gstRate = gstRateForTaxType(taxType);
  const fromItems = asItems(input.invoice.items).map((item) => lineFromItem(item, accountCode, taxType));
  const amount = Number(input.invoice.amount);
  const lineItems = fromItems.length > 0
    ? fromItems
    : (Number.isFinite(amount) && amount > 0
      ? [{
          description: input.invoice.description?.trim() || input.invoice.jobTitle?.trim() || "Tree service",
          quantity: 1,
          unitAmount: roundMoney(amount),
          accountCode,
          taxType,
          lineTotal: roundMoney(amount),
        }]
      : []);
  const subtotal = roundMoney(lineItems.reduce((sum, line) => sum + line.lineTotal, 0));
  const gst = roundMoney(subtotal * gstRate);
  const total = roundMoney(subtotal + gst);
  const due = timeOf(input.invoice.dueDate);
  const address = (input.invoice.address ?? "").trim();
  let blockingReason: string | null = null;
  if (!input.invoice.jobId) blockingReason = "This invoice is not on a job, so it can't be synced from here.";
  else if (!input.invoice.customerName?.trim()) blockingReason = "This invoice has no customer to create in Xero.";
  else if (address.length < 5) blockingReason = "Add an address of at least 5 characters on the invoice before syncing.";
  else if (lineItems.length === 0) blockingReason = "Add at least one line, or an invoice amount, before syncing.";
  return {
    currency: "NZD",
    contact: {
      name: input.invoice.customerName?.trim() || "",
      email: input.invoice.customerEmail?.trim() || null,
      phone: input.invoice.customerPhone?.trim() || null,
    },
    invoiceNumber: input.invoice.invoiceNumber,
    reference: input.invoice.jobNumber ? `Job #${input.invoice.jobNumber}` : null,
    dueDate: due == null ? null : new Date(due).toISOString().slice(0, 10),
    statusInXero: "AUTHORISED",
    accountCode,
    taxType,
    gstRate,
    lineItems,
    subtotal,
    gst,
    total,
    blockingReason,
  };
}

function withinLookback(invoice: InvoiceXeroSignal, now: number, lookbackDays: number): boolean {
  const sent = timeOf(invoice.sentDate);
  const anchor = sent ?? timeOf(invoice.updatedAt);
  if (anchor == null) return false;
  return now - anchor <= lookbackDays * DAY_MS;
}

export function planInvoiceXeroFollowUps(input: PlanInvoiceXeroInput): InvoiceXeroPlan[] {
  const plans: InvoiceXeroPlan[] = [];
  const lookbackDays = input.lookbackDays ?? SENT_LOOKBACK_DAYS;
  for (const invoice of input.invoices) {
    if (invoice.businessId !== input.businessId) continue;
    const existing = input.existing.find((row) => row.businessId === input.businessId && row.invoiceId === invoice.id);
    const sent = wasSentToClient(invoice);
    const needs = sent && invoiceNeedsXeroSync(invoice) && withinLookback(invoice, input.now, lookbackDays);
    if (!needs) {
      if (existing && OPEN_FOLLOW_UP.has(existing.status)) {
        plans.push({ action: "cancel", businessId: input.businessId, invoiceId: invoice.id });
      }
      continue;
    }
    if (!existing) {
      plans.push({
        action: "create",
        businessId: input.businessId,
        invoiceId: invoice.id,
        jobId: invoice.jobId,
        customerId: invoice.customerId,
      });
      continue;
    }
    if (REOPENABLE.has(existing.status)) {
      plans.push({
        action: "reopen",
        businessId: input.businessId,
        invoiceId: invoice.id,
        jobId: invoice.jobId,
        customerId: invoice.customerId,
      });
    }
  }
  return plans;
}

export function isWaitingInvoiceXero(status: string, snoozeUntil: string | Date | null | undefined, now: number): boolean {
  if (status === "draft") return true;
  if (status === "snoozed") {
    const until = timeOf(snoozeUntil);
    return until == null || until <= now;
  }
  return false;
}

export function invoiceXeroQueuePath(followUpId?: string | null): string {
  if (!followUpId) return "/quote-follow-ups?tab=xero";
  return `/quote-follow-ups?tab=xero&id=${encodeURIComponent(followUpId)}`;
}
