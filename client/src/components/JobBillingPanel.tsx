/**
 * Mobile Billing panel — Phase F.
 *
 * Line items are now inline-editable. Each row: description, qty,
 * unit price, computed line total, trash to remove. + Add appends a
 * new empty row. Auto-saves on blur via PUT /api/jobs/:id with the
 * full lineItems array (jsonb column).
 *
 * Invoice + Payment cards stay view-only — those flows live on the
 * invoices table and have their own dedicated screens.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  taxRate?: number;
  // Optional fields we leave alone — schema also tracks unitCost / markup /
  // totalCost / costExGst / priceExGst / totalExGst for profitability.
  unitCost?: number;
  totalCost?: number;
}

interface JobShape {
  id?: string;
  lineItems?: LineItem[];
  totalAmount?: string | number | null;
  paidAmount?: string | number | null;
  invoiceEligible?: boolean | null;
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
  console.warn(`[JobBillingPanel] ${which} — coming soon`);
};

function makeEmptyItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    total: 0,
    unitCost: 0,
    totalCost: 0,
    taxRate: 15,
    priceIncludesTax: false,
  };
}

export function JobBillingPanel({ jobId }: JobBillingPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobResp } = useQuery<{ success?: boolean; data?: JobShape }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const job = jobResp?.data;

  // Local edit state — kept in sync with server data, so external updates
  // (e.g. someone edits the job on desktop) reflect here on next refetch.
  const [items, setItems] = useState<LineItem[]>([]);
  useEffect(() => {
    setItems(job?.lineItems ?? []);
  }, [job?.lineItems]);

  const saveItems = useMutation({
    mutationFn: async (nextItems: LineItem[]) => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, { lineItems: nextItems });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save line items", description: err.message, variant: "destructive" });
    },
  });

  // Look up any invoice attached to this job for the status badge below.
  const { data: invResp } = useQuery<{ success?: boolean; data?: InvoiceShape[] }>({
    queryKey: ["/api/jobs", jobId, "invoices"],
    enabled: !!jobId,
    staleTime: 60_000,
  });
  const invoice = invResp?.data?.[0];

  // ── Editing helpers ──────────────────────────────────────────────────────
  const updateField = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => {
      const next = prev.map((it, i) => {
        if (i !== idx) return it;
        const merged: LineItem = { ...it, ...patch };
        // Recompute total whenever qty or unit price changes.
        if ("quantity" in patch || "unitPrice" in patch) {
          merged.total = toNum(merged.quantity) * toNum(merged.unitPrice);
        }
        return merged;
      });
      return next;
    });
  };

  // Compare a candidate array against what's currently on the server and
  // save only when there's a real difference. Avoids spurious round-trips
  // on every blur.
  const commitIfChanged = (next: LineItem[]) => {
    const serverItems = job?.lineItems ?? [];
    if (JSON.stringify(serverItems) !== JSON.stringify(next)) {
      saveItems.mutate(next);
    }
  };

  const addItem = () => {
    const next = [...items, makeEmptyItem()];
    setItems(next);
    saveItems.mutate(next);
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    saveItems.mutate(next);
  };

  // ── Totals ───────────────────────────────────────────────────────────────
  const lineItemsSubtotal = items.reduce(
    (sum, li) => sum + toNum(li.total ?? toNum(li.unitPrice) * toNum(li.quantity)),
    0,
  );
  const subtotal = lineItemsSubtotal > 0
    ? lineItemsSubtotal
    : toNum(job?.totalAmount) / (1 + GST_RATE);
  const gst = subtotal * GST_RATE;
  const total = subtotal + gst;

  const paidAmount = toNum(job?.paidAmount);
  const isPaid = paidAmount >= total && total > 0;

  return (
    <div className="p-4 space-y-3.5">
      {/* ── Line items card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">Line items</h3>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-[14px] font-semibold text-blue-600"
            data-testid="add-line-item"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-[14px] text-slate-500 py-2">
            No line items yet — tap <strong>+ Add</strong> to create one.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((li, idx) => (
              <LineItemRow
                key={li.id ?? idx}
                item={li}
                onChange={(patch) => updateField(idx, patch)}
                onBlur={() => commitIfChanged(items)}
                onRemove={() => {
                  if (window.confirm("Remove this line item?")) removeItem(idx);
                }}
              />
            ))}
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

// ─── Editable row ──────────────────────────────────────────────────────────

function LineItemRow({
  item,
  onChange,
  onBlur,
  onRemove,
}: {
  item: LineItem;
  onChange: (patch: Partial<LineItem>) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const qty = toNum(item.quantity);
  const unitPrice = toNum(item.unitPrice);
  const lineTotal = toNum(item.total ?? unitPrice * qty);

  return (
    <div className="py-3 first:pt-1">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={item.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          onBlur={onBlur}
          placeholder="Description"
          className="flex-1 bg-slate-100 rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove line item"
          className="w-9 h-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 grid place-items-center flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 mt-2">
        <NumberCell
          label="qty"
          value={qty}
          onChange={(v) => onChange({ quantity: v })}
          onBlur={onBlur}
          min={0}
          step={1}
        />
        <NumberCell
          label="unit $"
          value={unitPrice}
          onChange={(v) => onChange({ unitPrice: v })}
          onBlur={onBlur}
          min={0}
          step={0.01}
        />
        <div className="text-right pr-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">total</div>
          <div className="text-[15px] font-bold text-slate-900">{money(lineTotal)}</div>
        </div>
      </div>
    </div>
  );
}

function NumberCell({
  label,
  value,
  onChange,
  onBlur,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onBlur: () => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 pl-2">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onBlur={onBlur}
        className="w-full bg-slate-100 rounded-lg px-2 py-2 text-[14px] font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
      />
    </label>
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
