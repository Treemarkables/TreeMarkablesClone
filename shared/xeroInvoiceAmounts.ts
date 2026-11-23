/**
 * Amounts written back after a Xero invoice is created.
 *
 * Xero's `Total` is GST-inclusive. This app stores `invoices.amount` and
 * `jobs.total_amount` ex-GST (same basis as convert-to-invoice and
 * invoicedJobValueExGst). Writing `Total` into those columns makes later
 * screens treat a GST-inclusive figure as ex-GST, or divide it by 1.15 again.
 *
 * Mapping:
 * - invoices.amount = SubTotal (ex-GST)
 * - jobs.subtotal = SubTotal
 * - jobs.total_amount = SubTotal (stays ex-GST)
 * - jobs.total_including_gst = Total
 * - jobs.gst_amount = TotalTax, or Total − SubTotal when TotalTax is absent
 *
 * Rows already pushed with the inclusive total are not rewritten here.
 */

export interface XeroInvoiceTotals {
  subTotal?: unknown;
  SubTotal?: unknown;
  total?: unknown;
  Total?: unknown;
  totalTax?: unknown;
  TotalTax?: unknown;
}

export interface XeroJobAmountWriteback {
  subtotal: string;
  totalAmount: string;
  totalIncludingGst?: string;
  gstAmount?: string;
}

export interface XeroInvoiceAmountWriteback {
  /** Ex-GST invoice amount. Null when Xero did not return a positive SubTotal. */
  invoiceAmount: string | null;
  /** Job columns to set. Null when there is no positive SubTotal to trust. */
  jobAmounts: XeroJobAmountWriteback | null;
}

function readTotal(invoice: XeroInvoiceTotals, camel: keyof XeroInvoiceTotals, pascal: keyof XeroInvoiceTotals): unknown {
  if (invoice[camel] !== undefined && invoice[camel] !== null && invoice[camel] !== "") {
    return invoice[camel];
  }
  if (invoice[pascal] !== undefined && invoice[pascal] !== null && invoice[pascal] !== "") {
    return invoice[pascal];
  }
  return undefined;
}

function parseMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function money(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/** Map a Xero create-invoice response onto the local ex-GST columns. */
export function mapXeroInvoiceAmounts(invoice: XeroInvoiceTotals | null | undefined): XeroInvoiceAmountWriteback {
  if (!invoice) return { invoiceAmount: null, jobAmounts: null };

  const subtotal = parseMoney(readTotal(invoice, "subTotal", "SubTotal"));
  if (subtotal === null || subtotal <= 0) {
    return { invoiceAmount: null, jobAmounts: null };
  }

  const total = parseMoney(readTotal(invoice, "total", "Total"));
  const totalTax = parseMoney(readTotal(invoice, "totalTax", "TotalTax"));

  const jobAmounts: XeroJobAmountWriteback = {
    subtotal: money(subtotal),
    totalAmount: money(subtotal),
  };
  if (total !== null && total > 0) {
    jobAmounts.totalIncludingGst = money(total);
  }
  if (totalTax !== null) {
    jobAmounts.gstAmount = money(totalTax);
  } else if (total !== null) {
    jobAmounts.gstAmount = money(total - subtotal);
  }

  return {
    invoiceAmount: money(subtotal),
    jobAmounts,
  };
}
