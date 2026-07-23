// Ex-GST value of a job's invoices, for the job-card header price.
//
// Once an invoice exists for a won job, the invoice — not the quoted line
// items — is the real value of the job. Post-quote adjustments (e.g. a
// goodwill discount applied in the invoice builder before sending) otherwise
// never reach the job card, which keeps showing the quoted figure.
//
// Which invoices count:
// - Issued ones always: sentDate set, or status sent/paid/overdue (paid can
//   happen with no send, e.g. cash marked paid; overdue only follows a send).
// - Drafts (status draft/pending, unsent) count only when the job is past the
//   quoting stage (work_order onward) — at that point an invoice only exists
//   because someone deliberately built it, and it's the billing truth. This
//   also covers invoices emailed before the send paths stamped status='sent'.
//   A job still at lead/quote with a half-built draft keeps its quoted value.
// - Cancelled invoices never count. Multiple counted invoices (progress
//   billing) sum.
//
// invoice.amount is the ex-GST subtotal (InvoiceBuilder recomputes it from
// line items on every save) — same basis as the job-card header, which is
// ex-GST throughout. Falls back to summing items when amount is missing/0.

const PAST_QUOTE_STATUSES = new Set(["work_order", "invoiced", "completed"]);

export function invoicedJobValueExGst(
  invoices: unknown,
  jobStatus?: string | null,
): number | undefined {
  const list = Array.isArray(invoices) ? (invoices as Array<Record<string, unknown>>) : [];
  const jobPastQuoting = PAST_QUOTE_STATUSES.has(String(jobStatus ?? ""));
  const toNum = (v: unknown): number => {
    if (v == null) return 0;
    const n = typeof v === "string" ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  };
  let total = 0;
  let counted = 0;
  for (const inv of list) {
    const status = String(inv?.status ?? "").toLowerCase();
    if (status === "cancelled") continue;
    const issued = inv?.sentDate != null || status === "sent" || status === "paid" || status === "overdue";
    if (!issued && !jobPastQuoting) continue;
    let amount = toNum(inv?.amount);
    if (amount <= 0) {
      const items = (inv?.items as Array<Record<string, unknown>> | undefined) ?? [];
      amount = Array.isArray(items)
        ? items.reduce((sum, it) => sum + (toNum(it?.amount) || toNum(it?.total)), 0)
        : 0;
    }
    if (amount <= 0) continue; // unpriced placeholder rows don't zero the header
    counted++;
    total += amount;
  }
  // Nothing counted → no override; caller falls back to the quoted value.
  return counted > 0 ? total : undefined;
}
