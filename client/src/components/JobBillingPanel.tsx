/**
 * Mobile Billing panel — Phase C for JobCardMobile.
 *
 * Reads the job's lineItems[] + paidAmount, computes subtotal/GST/total,
 * surfaces invoice + payment status. View-first; line-item editing and
 * invoice creation remain in the legacy modal for now (their own subsystems).
 */
import { useQuery } from "@tanstack/react-query";
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface JobBillingPanelProps {
  jobId: string;
}

interface LineItem {
  id?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  itemCode?: string;
  priceIncludesTax?: boolean;
}

interface JobShape {
  id?: string;
  lineItems?: LineItem[];
  totalAmount?: string | number | null;
  paidAmount?: string | number | null;
  invoiceEligible?: boolean | null;
  // Pulled from invoices query below; not actually on the job.
}

interface InvoiceShape {
  id: string;
  invoiceNumber?: string | null;
  status?: string | null;
  totalAmount?: string | number | null;
}

const GST_RATE = 0.15;

function money(n: number): string {
  return "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

const stub = (which: string) => () => {
  // eslint-disable-next-line no-console
  console.warn(`[JobBillingPanel] ${which} not wired up — Phase C is view-only`);
};

export function JobBillingPanel({ jobId }: JobBillingPanelProps) {
  const { data: jobResp } = useQuery<{ success?: boolean; data?: JobShape }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const job = jobResp?.data;
  const lineItems = job?.lineItems ?? [];

  // Look up any invoice attached to this job so we can show the right status.
  const { data: invResp } = useQuery<{ success?: boolean; data?: InvoiceShape[] }>({
    queryKey: ["/api/jobs", jobId, "invoices"],
    enabled: !!jobId,
    staleTime: 60_000,
  });
  const invoice = invResp?.data?.[0];

  // Compute subtotal from line items. If the job stored its own totalAmount,
  // prefer that — it's the canonical figure used everywhere else.
  const lineItemsSubtotal = lineItems.reduce(
    (sum, li) => sum + toNum(li.total ?? (toNum(li.unitPrice) * toNum(li.quantity))),
    0,
  );
  const subtotal = lineItemsSubtotal > 0
    ? lineItemsSubtotal
    : toNum(job?.totalAmount) / (1 + GST_RATE); // server-stored totalAmount is GST-inclusive
  const gst = subtotal * GST_RATE;
  const total = subtotal + gst;

  const paidAmount = toNum(job?.paidAmount);
  const isPaid = paidAmount >= total && total > 0;

  const invoiceStatus = invoice?.status ?? null;

  return (
    <div className="p-4 space-y-3.5">
      {/* ── Line items card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Line items</h3>
          <button
            type="button"
            onClick={stub("Add line item")}
            className="flex items-center gap-1 text-[14px] font-semibold text-blue-600"
            data-testid="add-line-item"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {lineItems.length === 0 ? (
          <div className="text-[14px] text-slate-500 py-2">
            No line items yet. Open this job on desktop to add them — mobile editing is coming next.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lineItems.map((li, i) => {
              const qty = toNum(li.quantity);
              const unitPrice = toNum(li.unitPrice);
              const lineTotal = toNum(li.total ?? unitPrice * qty);
              return (
                <div key={li.id ?? i} className="flex items-start justify-between gap-3 py-3 first:pt-1">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-slate-900 leading-snug">{li.description || "(no description)"}</div>
                    {li.itemCode && <div className="text-[12px] text-slate-500 mt-0.5">{li.itemCode}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[15px] font-bold text-slate-900">{money(lineTotal)}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">qty {qty}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Totals card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex justify-between py-1.5 text-[14px] text-slate-600">
          <span>Subtotal (excl GST)</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="flex justify-between py-1.5 text-[14px] text-slate-600">
          <span>GST (15%)</span>
          <span>{money(gst)}</span>
        </div>
        <div className="border-t-2 border-slate-900 mt-1 pt-2.5 flex justify-between text-[17px] font-extrabold text-slate-900">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      {/* ── Invoice card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Invoice</h3>
          <InvoiceStatusBadge invoice={invoice} />
        </div>
        {invoice ? (
          <>
            <div className="text-[13.5px] text-slate-600 leading-relaxed">
              Invoice <span className="font-bold text-slate-900">{invoice.invoiceNumber ?? "(no #)"}</span>
              {invoice.status && <> · status: {invoice.status}</>}
              {invoice.totalAmount && <> · {money(toNum(invoice.totalAmount))}</>}
            </div>
            <button
              type="button"
              onClick={stub("View invoice")}
              className="w-full mt-3 bg-slate-900 text-white py-3 rounded-xl font-bold text-[15px]"
              data-testid="view-invoice"
            >
              View invoice
            </button>
          </>
        ) : (
          <>
            <div className="text-[13.5px] text-slate-600 leading-relaxed">
              When the job's complete, generate an invoice — Treemarkables banking details are included automatically.
            </div>
            <button
              type="button"
              onClick={stub("Create invoice")}
              className="w-full mt-3 bg-slate-900 text-white py-3 rounded-xl font-bold text-[15px] flex items-center justify-center gap-1.5"
              data-testid="create-invoice"
            >
              <Plus className="w-4 h-4" />
              Create invoice
            </button>
          </>
        )}
      </div>

      {/* ── Payment card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900 mb-2">Payment</h3>
        <div className="flex items-center gap-2 text-[14px]">
          {isPaid ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-slate-900 font-semibold">Paid in full</span>
              <span className="text-slate-500 ml-1">· {money(paidAmount)}</span>
            </>
          ) : paidAmount > 0 ? (
            <>
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-slate-900 font-semibold">Partial payment</span>
              <span className="text-slate-500 ml-1">· {money(paidAmount)} of {money(total)}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-slate-700">No payments recorded</span>
            </>
          )}
        </div>
        <div className="text-[12.5px] text-slate-500 mt-2 leading-relaxed">
          Payment recording lives on the invoice itself — once an invoice is generated above, payments will surface here automatically.
        </div>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ invoice }: { invoice: InvoiceShape | undefined }) {
  if (!invoice) {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        Not yet invoiced
      </span>
    );
  }
  const status = (invoice.status ?? "draft").toLowerCase();
  const colour = status === "paid" ? "bg-emerald-500"
    : status === "sent" || status === "viewed" ? "bg-blue-500"
    : status === "overdue" ? "bg-red-500"
    : "bg-slate-400";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
      <span className={`w-2 h-2 rounded-full ${colour}`} />
      {label}
    </span>
  );
}
