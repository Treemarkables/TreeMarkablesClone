// Shared payment-display rules for the job card, invoice list, and the
// Xero payment sync. Kept pure so the card, the invoice screens, and
// POST /api/xero/sync-payment-status stay in agreement.

export function moneyAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function readMoneyField(source: object, key: string): number {
  if (!(key in source)) return 0;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value === "string" || typeof value === "number") return moneyAmount(value);
  return 0;
}

/**
 * Inc-GST total Xero reports for an invoice. `total` already includes GST.
 * When that is missing, subtotal + tax is the same figure.
 */
export function xeroReportedInvoiceTotal(invoice: object | null | undefined): number {
  if (!invoice) return 0;
  const total = readMoneyField(invoice, "total");
  if (total > 0) return total;
  const sub = readMoneyField(invoice, "subTotal");
  const tax = readMoneyField(invoice, "totalTax");
  if (sub > 0 || tax > 0) return moneyAmount(sub + tax);
  return 0;
}

/**
 * Inc-GST total the paid amount is compared against.
 * Prefer the explicit inc-GST columns. `totalAmount` is stored inc-GST.
 * `exGstValue` (header price, invoice subtotal) is grossed up at 15%.
 */
export function jobTotalIncGst(input: {
  totalIncludingGst?: string | number | null;
  totalAmount?: string | number | null;
  exGstValue?: string | number | null;
}): number {
  const including = moneyAmount(input.totalIncludingGst);
  if (including > 0) return including;
  const total = moneyAmount(input.totalAmount);
  if (total > 0) return total;
  const ex = moneyAmount(input.exGstValue);
  if (ex > 0) return moneyAmount(ex * 1.15);
  return 0;
}

export function invoiceStatusIsPaid(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "paid";
}

/**
 * Show the PAID badge when an invoice is paid, Xero says the job is paid,
 * or the recorded paid amount covers the inc-GST total.
 */
export function jobShowsPaidBadge(input: {
  invoiceStatuses?: Array<string | null | undefined> | null;
  xeroStatus?: string | null;
  paidAmount?: string | number | null;
  totalIncludingGst?: string | number | null;
  totalAmount?: string | number | null;
  exGstValue?: string | number | null;
}): boolean {
  const statuses = input.invoiceStatuses ?? [];
  if (statuses.some((status) => invoiceStatusIsPaid(status))) return true;
  if ((input.xeroStatus ?? "").trim().toLowerCase() === "paid") return true;
  const total = jobTotalIncGst(input);
  if (total <= 0) return false;
  return moneyAmount(input.paidAmount) + 0.009 >= total;
}

/**
 * Statuses that mean we have not successfully created a Xero invoice yet
 * and a send is still allowed — unless an invoice id was already stored.
 */
const XERO_OPEN_FOR_SEND = new Set(["", "pending"]);

/**
 * A job is already in Xero when a Xero invoice id is stored, or when its
 * status is `sent`, `paid`, or any other status that is not an explicit
 * not-yet-sent / failed state. `pending`, `error`, and `failed` can still
 * be sent when no invoice id was stored.
 */
export function jobAlreadySentToXero(
  xeroStatus: string | null | undefined,
  xeroInvoiceId?: string | null,
): boolean {
  // A stored Xero invoice id means the invoice already exists, including
  // when a later attempt recorded an error. Sending again would duplicate it.
  if ((xeroInvoiceId ?? "").trim()) return true;
  const status = (xeroStatus ?? "").trim().toLowerCase();
  if (status === "error" || status === "failed") return false;
  if (XERO_OPEN_FOR_SEND.has(status)) return false;
  return true;
}

/**
 * Paid amount and balance to write when Xero reports the invoice PAID.
 * The paid amount becomes the invoice total, but an existing higher paid
 * amount is left as it is (a deposit plus the invoice, or a manual
 * overpayment). Balance owing is cleared.
 *
 * Xero's invoice total (inc-GST) wins. Otherwise the local invoice amounts
 * are used, then the job's own inc-GST total when no invoice figure exists.
 */
export function paidAmountsWhenXeroReportsPaid(input: {
  currentPaidAmount?: string | number | null;
  xeroInvoiceTotal?: string | number | null;
  invoiceAmounts?: Array<string | number | null | undefined>;
  jobTotalIncludingGst?: string | number | null;
  jobTotalAmount?: string | number | null;
}): { paidAmount: string; balanceDue: string } {
  const xeroTotal = moneyAmount(input.xeroInvoiceTotal);
  let local = 0;
  for (const amount of input.invoiceAmounts ?? []) {
    local += moneyAmount(amount);
  }
  let invoiceTotal = xeroTotal > 0 ? xeroTotal : local;
  if (invoiceTotal <= 0) {
    invoiceTotal = Math.max(
      moneyAmount(input.jobTotalIncludingGst),
      moneyAmount(input.jobTotalAmount),
    );
  }
  const currentPaid = moneyAmount(input.currentPaidAmount);
  const paid = currentPaid > invoiceTotal ? currentPaid : invoiceTotal;
  return { paidAmount: paid.toFixed(2), balanceDue: "0.00" };
}

/**
 * A job Xero already marked paid still needs a sync when the paid amount
 * or the balance was never filled in. Bulk sync and the job-card auto-sync
 * use this so a later run repairs rows the old sync left at $0.
 */
export function xeroPaidJobNeedsAmountRepair(job: {
  xeroStatus?: string | null;
  paidAmount?: string | number | null;
  balanceDue?: string | number | null;
}): boolean {
  if ((job.xeroStatus ?? "").trim().toLowerCase() !== "paid") return false;
  return moneyAmount(job.paidAmount) <= 0 || moneyAmount(job.balanceDue) > 0;
}

export function shouldSyncXeroPaymentStatus(job: {
  xeroInvoiceId?: string | null;
  xeroStatus?: string | null;
  paidAmount?: string | number | null;
  balanceDue?: string | number | null;
}): boolean {
  if (!(job.xeroInvoiceId ?? "").trim()) return false;
  if ((job.xeroStatus ?? "").trim().toLowerCase() !== "paid") return true;
  return xeroPaidJobNeedsAmountRepair(job);
}
