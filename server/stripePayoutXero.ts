// Turns a payout plan into Xero payments (account 640) and one fee entry.
// Every create is looked up by reference first, so a retry cannot double-post.

import {
  NO_GST_TAX,
  round2,
  type XeroPaymentAction,
  type XeroPostPlan,
  type XeroRefundAction,
} from "../shared/stripePayouts.ts";

export interface XeroPostResultLine {
  lineId: string | null;
  kind: "payment" | "refund" | "fee";
  status: "posted" | "skipped" | "error";
  message: string;
  amount: number;
  xeroId: string | null;
  jobNumber: string | null;
  invoiceNumber: string | null;
}

export interface XeroAccounting {
  findPaymentByReference(reference: string): Promise<string | null>;
  createInvoicePayment(input: {
    xeroInvoiceId: string;
    amount: number;
    date: string;
    reference: string;
    accountCode: string;
  }): Promise<string>;
  findCreditNoteByReference(reference: string): Promise<string | null>;
  createCreditNote(input: {
    contactId: string;
    amount: number;
    date: string;
    reference: string;
    accountCode: string;
    taxType: string;
    description: string;
  }): Promise<string>;
  createCreditNotePayment(input: {
    creditNoteId: string;
    amount: number;
    date: string;
    reference: string;
    accountCode: string;
  }): Promise<string>;
  invoiceContact(xeroInvoiceId: string): Promise<{
    contactId: string | null;
    accountCode: string | null;
    taxType: string | null;
  }>;
  findFeeSpend(reference: string): Promise<string | null>;
  findFeeJournal(narration: string): Promise<string | null>;
  createFeeSpend(input: {
    amount: number;
    spend: boolean;
    date: string;
    reference: string;
    clearingAccountCode: string;
    feesAccountCode: string;
    description: string;
  }): Promise<string>;
  createFeeJournal(input: {
    amount: number;
    date: string;
    narration: string;
    clearingAccountCode: string;
    feesAccountCode: string;
    description: string;
  }): Promise<string>;
}

export interface XeroPostMemory {
  payment(lineId: string, xeroPaymentId: string, message: string): Promise<void>;
  refund(lineId: string, creditNoteId: string, xeroPaymentId: string, message: string): Promise<void>;
  fee(xeroId: string, kind: "spend" | "journal", message: string): Promise<void>;
  lineMessage(lineId: string, status: string, message: string): Promise<void>;
}

interface XeroErrorBody {
  Message?: string;
  Elements?: Array<{ ValidationErrors?: Array<{ Message?: string }> }>;
}

function readBody(error: unknown): XeroErrorBody | null {
  if (!error || typeof error !== "object") return null;
  const rec = error as { body?: unknown; response?: { body?: unknown } };
  const raw = rec.body ?? rec.response?.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as XeroErrorBody;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as XeroErrorBody;
  return null;
}

const XERO_FILTER_FIELDS = new Set(["Reference", "Code", "Narration"]);

/** Xero `where` equality. Quotes are stripped so a reference cannot break the filter. */
export function xeroEquals(field: string, value: string): string {
  if (!XERO_FILTER_FIELDS.has(field)) throw new Error("Unsupported Xero filter");
  const safeValue = value.replace(/["\\]/g, "");
  return `${field}=="${safeValue}"`;
}

export function xeroErrorMessage(error: unknown): string {
  const body = readBody(error);
  const validation = body?.Elements?.flatMap((el) =>
    (el.ValidationErrors ?? []).map((v) => v.Message).filter((m): m is string => !!m),
  ) ?? [];
  if (validation.length > 0) return validation.join(" ");
  if (typeof body?.Message === "string" && body.Message.trim()) return body.Message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Xero request failed";
}

function money(amount: number): string {
  return `$${round2(amount).toFixed(2)}`;
}

async function postPayment(
  accounting: XeroAccounting,
  action: XeroPaymentAction,
  date: string,
  accountCode: string,
  memory: XeroPostMemory,
): Promise<XeroPostResultLine> {
  const who = action.invoiceNumber ? `invoice ${action.invoiceNumber}` : "the invoice";
  if (action.alreadyPosted && action.xeroPaymentId) {
    return {
      lineId: action.lineId,
      kind: "payment",
      status: "skipped",
      message: `Payment of ${money(action.amount)} for ${who} was already posted.`,
      amount: action.amount,
      xeroId: action.xeroPaymentId,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  }
  try {
    const existing = await accounting.findPaymentByReference(action.reference);
    const xeroId = existing ?? await accounting.createInvoicePayment({
      xeroInvoiceId: action.xeroInvoiceId,
      amount: action.amount,
      date,
      reference: action.reference,
      accountCode,
    });
    const short = action.shortfall > 0.009
      ? ` Xero had ${money(action.amount)} owing, so ${money(action.shortfall)} of the Stripe charge was not posted.`
      : "";
    const message = existing
      ? `Payment of ${money(action.amount)} for ${who} was already in Xero. Not posted again.`
      : `Payment of ${money(action.amount)} posted for ${who} from account ${accountCode}.${short}`;
    await memory.payment(action.lineId, xeroId, message);
    return {
      lineId: action.lineId,
      kind: "payment",
      status: existing ? "skipped" : "posted",
      message,
      amount: action.amount,
      xeroId,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  } catch (error) {
    const message = xeroErrorMessage(error);
    await memory.lineMessage(action.lineId, "error", message);
    return {
      lineId: action.lineId,
      kind: "payment",
      status: "error",
      message,
      amount: action.amount,
      xeroId: null,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  }
}

async function postRefund(
  accounting: XeroAccounting,
  action: XeroRefundAction,
  date: string,
  clearingAccountCode: string,
  salesAccountCode: string,
  salesTaxType: string,
  memory: XeroPostMemory,
): Promise<XeroPostResultLine> {
  const who = action.invoiceNumber ? `invoice ${action.invoiceNumber}` : "the invoice";
  if (action.alreadyPosted && action.xeroRefundPaymentId) {
    return {
      lineId: action.lineId,
      kind: "refund",
      status: "skipped",
      message: `Refund of ${money(action.amount)} for ${who} was already posted.`,
      amount: action.amount,
      xeroId: action.xeroRefundPaymentId,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  }
  try {
    const existingPayment = await accounting.findPaymentByReference(action.reference);
    if (existingPayment) {
      const message = `Refund of ${money(action.amount)} for ${who} was already in Xero. Not posted again.`;
      await memory.refund(action.lineId, "", existingPayment, message);
      return {
        lineId: action.lineId,
        kind: "refund",
        status: "skipped",
        message,
        amount: action.amount,
        xeroId: existingPayment,
        jobNumber: action.jobNumber,
        invoiceNumber: action.invoiceNumber,
      };
    }
    const contact = await accounting.invoiceContact(action.xeroInvoiceId);
    if (!contact.contactId) {
      const message = `Refund of ${money(action.amount)} for ${who} was not posted because the Xero invoice has no contact.`;
      await memory.lineMessage(action.lineId, "error", message);
      return {
        lineId: action.lineId,
        kind: "refund",
        status: "error",
        message,
        amount: action.amount,
        xeroId: null,
        jobNumber: action.jobNumber,
        invoiceNumber: action.invoiceNumber,
      };
    }
    const creditNoteId = await accounting.findCreditNoteByReference(action.reference) ?? await accounting.createCreditNote({
      contactId: contact.contactId,
      amount: action.amount,
      date,
      reference: action.reference,
      accountCode: contact.accountCode || salesAccountCode,
      taxType: contact.taxType || salesTaxType,
      description: `Stripe refund ${action.stripeSourceId ?? ""}`.trim(),
    });
    const paymentId = await accounting.createCreditNotePayment({
      creditNoteId,
      amount: action.amount,
      date,
      reference: action.reference,
      accountCode: clearingAccountCode,
    });
    const message = `Refund of ${money(action.amount)} posted for ${who} from account ${clearingAccountCode}.`;
    await memory.refund(action.lineId, creditNoteId, paymentId, message);
    return {
      lineId: action.lineId,
      kind: "refund",
      status: "posted",
      message,
      amount: action.amount,
      xeroId: paymentId,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  } catch (error) {
    const message = xeroErrorMessage(error);
    await memory.lineMessage(action.lineId, "error", message);
    return {
      lineId: action.lineId,
      kind: "refund",
      status: "error",
      message,
      amount: action.amount,
      xeroId: null,
      jobNumber: action.jobNumber,
      invoiceNumber: action.invoiceNumber,
    };
  }
}

async function postFee(
  accounting: XeroAccounting,
  plan: XeroPostPlan,
  date: string,
  clearingAccountCode: string,
  feesAccountCode: string,
  clearingIsBank: boolean,
  memory: XeroPostMemory,
): Promise<XeroPostResultLine | null> {
  const fee = plan.fee;
  if (!fee) return null;
  const description = `Stripe fees ${fee.reference}`;
  if (fee.alreadyPosted) {
    return {
      lineId: null,
      kind: "fee",
      status: "skipped",
      message: `Stripe fees of ${money(Math.abs(fee.amount))} were already posted from account ${clearingAccountCode}.`,
      amount: fee.amount,
      xeroId: null,
      jobNumber: null,
      invoiceNumber: null,
    };
  }
  try {
    if (clearingIsBank) {
      const existing = await accounting.findFeeSpend(fee.reference);
      const xeroId = existing ?? await accounting.createFeeSpend({
        amount: Math.abs(fee.amount),
        spend: fee.amount >= 0,
        date,
        reference: fee.reference,
        clearingAccountCode,
        feesAccountCode,
        description,
      });
      const message = existing
        ? `Stripe fees of ${money(Math.abs(fee.amount))} were already in Xero. Not posted again.`
        : `Stripe fees of ${money(Math.abs(fee.amount))} posted as a ${fee.amount >= 0 ? "spend" : "receive"} from account ${clearingAccountCode}. No GST.`;
      await memory.fee(xeroId, "spend", message);
      return { lineId: null, kind: "fee", status: existing ? "skipped" : "posted", message, amount: fee.amount, xeroId, jobNumber: null, invoiceNumber: null };
    }
    const existing = await accounting.findFeeJournal(fee.reference);
    const xeroId = existing ?? await accounting.createFeeJournal({
      amount: fee.amount,
      date,
      narration: fee.reference,
      clearingAccountCode,
      feesAccountCode,
      description,
    });
    const message = existing
      ? `Stripe fees of ${money(Math.abs(fee.amount))} were already in Xero. Not posted again.`
      : `Account ${clearingAccountCode} is not a Xero bank account, so Stripe fees of ${money(Math.abs(fee.amount))} were posted as a manual journal that credits ${clearingAccountCode}. No GST.`;
    await memory.fee(xeroId, "journal", message);
    return { lineId: null, kind: "fee", status: existing ? "skipped" : "posted", message, amount: fee.amount, xeroId, jobNumber: null, invoiceNumber: null };
  } catch (error) {
    const message = xeroErrorMessage(error);
    return { lineId: null, kind: "fee", status: "error", message, amount: fee.amount, xeroId: null, jobNumber: null, invoiceNumber: null };
  }
}

export async function executeXeroPost(input: {
  accounting: XeroAccounting;
  plan: XeroPostPlan;
  date: string;
  clearingAccountCode: string;
  feesAccountCode: string;
  salesAccountCode: string;
  salesTaxType: string;
  clearingIsBank: boolean;
  memory: XeroPostMemory;
}): Promise<XeroPostResultLine[]> {
  const results: XeroPostResultLine[] = [];
  for (const action of input.plan.payments) {
    results.push(await postPayment(input.accounting, action, input.date, input.clearingAccountCode, input.memory));
  }
  for (const action of input.plan.refunds) {
    results.push(await postRefund(
      input.accounting,
      action,
      input.date,
      input.clearingAccountCode,
      input.salesAccountCode,
      input.salesTaxType,
      input.memory,
    ));
  }
  const fee = await postFee(
    input.accounting,
    input.plan,
    input.date,
    input.clearingAccountCode,
    input.feesAccountCode,
    input.clearingIsBank,
    input.memory,
  );
  if (fee) results.push(fee);
  for (const skip of input.plan.skips) {
    await input.memory.lineMessage(skip.lineId, `skipped_${skip.reason}`, skip.message);
    results.push({
      lineId: skip.lineId,
      kind: "payment",
      status: "skipped",
      message: skip.message,
      amount: skip.amount,
      xeroId: null,
      jobNumber: skip.jobNumber,
      invoiceNumber: skip.invoiceNumber,
    });
  }
  return results;
}

export { NO_GST_TAX };
