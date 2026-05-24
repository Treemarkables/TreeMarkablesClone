/**
 * Desktop-first job card modal — Phases A + B + C.
 *
 * Mirrors the mobile rebuild's phasing: scaffold first (header + tab
 * strip + split-screen body + draggable divider + bottom action bar),
 * then wire panels in tab-by-tab. The Details tab is wired (Phase B);
 * the always-visible Diary in the right pane is wired (Phase C); the
 * Billing/Checklist/Quoting tabs remain placeholders until Phase D.
 *
 * Reachable at /job-card-preview-desktop/:jobId. Throwaway preview route;
 * delete once Phase F feature-flags this into the real flow.
 *
 * Layout (matches the approved mockup in mockups/job-card-rounding.html):
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ Header: job number · status · price · customer summary         │
 *   ├──────────────────────────────────────┬─────────────────────────┤
 *   │ Tab strip: Details/Billing/etc       │ Job Diary               │
 *   │                                      │ (always visible —       │
 *   │ Body (Details tab):                  │  not behind a tab)      │
 *   │   • Customer summary card            │                         │
 *   │   • Job Description                  │ Feed of typed entries   │
 *   │   • Internal Notes (orange)          │ with icons/timestamps.  │
 *   │   • Status/Lead/Quote (3-col)        │                         │
 *   │   • At-a-glance totals               │                         │
 *   │   • Contacts (bottom)                │ Compose row at the bot. │
 *   ├──────────────────────────────────────┴─────────────────────────┤
 *   │ Bottom action bar: Photo/Call/SMS/Email · Quote/Invoice/More   │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Default split is 60/40. The divider between the two panes is draggable
 * (clamped to 30%–80%); the chosen ratio is held in component state and
 * does not persist across opens yet (defer until Phase F if useful).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X as XIcon,
  Camera,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  CreditCard,
  FilePen,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobDetailsPanel } from "@/components/JobDetailsPanel";
import { JobDiarySection } from "@/components/JobDiarySection";

export type JobCardDesktopTab =
  | "details"
  | "billing"
  | "checklist"
  | "quoting";

export interface JobCardDesktopProps {
  /** Job ID — required for all data fetching + panel routing. */
  jobId: string;
  /** Initial tab when the modal opens. Defaults to "details". */
  initialTab?: JobCardDesktopTab;
  /** Called when the user taps the close (✕) button. */
  onClose: () => void;
  /** Called when the user taps Save. */
  onSave?: () => void;
  isSaving?: boolean;
}

// Map job status → badge colour. Mirrors JobCardMobile's STATUS_BADGE so
// the badge looks identical on both surfaces.
const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  lead: { label: "Lead", bg: "#f59e0b" },
  quote: { label: "Quote", bg: "#f59e0b" },
  work_order: { label: "Work Order", bg: "#2563eb" },
  scheduled: { label: "Scheduled", bg: "#7c3aed" },
  completed: { label: "Completed", bg: "#16a34a" },
  unsuccessful: { label: "Unsuccessful", bg: "#ef4444" },
};

const TABS: { id: JobCardDesktopTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "billing", label: "Billing" },
  { id: "checklist", label: "Checklist" },
  { id: "quoting", label: "Quoting" },
];

function formatNzd(amount?: number | string | null): string {
  if (amount == null) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "$0.00";
  return "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function JobCardDesktop({
  jobId,
  initialTab = "details",
  onClose,
  onSave,
  isSaving,
}: JobCardDesktopProps) {
  const [activeTab, setActiveTab] = useState<JobCardDesktopTab>(initialTab);
  // Split ratio (left pane as a percentage). 60/40 default to match the
  // approved mockup. Clamped to 30–80 during drag so neither pane disappears.
  const [splitPct, setSplitPct] = useState(60);

  // Fetch job — shares cache with GlobalJobCard / JobCardMobile so a job
  // already open elsewhere doesn't trigger a duplicate request.
  const { data: jobResp } = useQuery<{ success?: boolean; data?: Record<string, unknown> }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const job = jobResp?.data as Record<string, unknown> | undefined;

  const customerId = job?.customerId as string | undefined;
  const { data: custResp } = useQuery<{ success?: boolean; data?: Record<string, unknown> }>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
    staleTime: 60_000,
  });
  const customer = custResp?.data;

  const jobNumber = (job?.jobNumber as string | number | undefined) ?? undefined;
  const status = (job?.status as string | undefined) ?? "lead";
  const badge = STATUS_BADGE[status] ?? { label: status, bg: "#64748b" };

  // Mirror the desktop-header price logic — line items (ex-GST) → subtotal
  // → totalAmount/1.15. Identical math to JobCardMobile.tsx after the
  // header-price fix landed.
  const jobValue = (() => {
    const toNum = (v: unknown): number => {
      if (v == null) return 0;
      const n = typeof v === "string" ? parseFloat(v) : (v as number);
      return Number.isFinite(n) ? n : 0;
    };
    const items = (job?.lineItems as Array<Record<string, unknown>> | undefined) ?? [];
    const liTotal = items.reduce((sum, li) => {
      const exGst = toNum(li.totalExGst) || (li.priceExGst != null ? toNum(li.priceExGst) * toNum(li.quantity || 1) : 0);
      return sum + (exGst || toNum(li.total));
    }, 0);
    if (liTotal > 0) return liTotal;
    const subtotal = toNum(job?.subtotal);
    if (subtotal > 0) return subtotal;
    const total = toNum(job?.totalAmount);
    return total > 0 ? total / 1.15 : undefined;
  })();

  // ── Draggable divider ──────────────────────────────────────────────────
  // Track-relative dragging. We read the split track's bounding rect at
  // pointerdown and update splitPct on every move until release. Clamped to
  // 30–80 to keep both panes usable.
  const splitTrackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const onPointerDownHandle = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMoveHandle = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !splitTrackRef.current) return;
    const rect = splitTrackRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(30, Math.min(80, pct));
    setSplitPct(clamped);
  }, []);

  const onPointerUpHandle = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // Keyboard accessibility — arrow keys nudge the divider 2% at a time
  // when the handle has focus. Home/End jump to defaults.
  const onKeyDownHandle = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSplitPct((p) => Math.max(30, p - 2));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setSplitPct((p) => Math.min(80, p + 2));
      e.preventDefault();
    } else if (e.key === "Home") {
      setSplitPct(60);
      e.preventDefault();
    }
  }, []);

  // Cleanup: stop tracking drag if the component unmounts mid-drag.
  useEffect(() => () => { draggingRef.current = false; }, []);

  // Pill-button helper for the bottom action bar — extracts the repeated
  // {colored icon tile + label} structure.
  const actionBtn = (
    label: string,
    Icon: typeof Camera,
    tileBg: string,
    tileFg: string,
    onClick?: () => void,
    disabled?: boolean,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-sm font-semibold text-slate-700 disabled:opacity-40"
      data-testid={`job-card-desktop-action-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <span className={`w-8 h-8 rounded-xl ${tileBg} ${tileFg} grid place-items-center`}>
        <Icon className="w-4 h-4" />
      </span>
      {label}
    </button>
  );

  const customerSummary =
    [(customer?.name as string | undefined), (job?.address as string | undefined)]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center p-4" data-testid="job-card-desktop">
      <div className="bg-slate-50 rounded-2xl shadow-xl border border-slate-200 w-full max-w-[1480px] h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900 truncate">
              Job {jobNumber ?? ""}
            </h2>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ background: badge.bg }}
            >
              {badge.label}
            </span>
            <span className="text-[16px] font-bold text-slate-900 flex-shrink-0" data-testid="job-card-desktop-price">
              {formatNzd(jobValue)}
            </span>
            {customerSummary && (
              <span className="text-[12px] text-slate-500 truncate">· {customerSummary}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving || !onSave}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 h-9"
              data-testid="btn-save-job"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 grid place-items-center hover:bg-slate-200"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Split-screen body ── */}
        <div
          ref={splitTrackRef}
          className="flex-1 grid relative min-h-0"
          style={{ gridTemplateColumns: `${splitPct}% ${100 - splitPct}%` }}
        >
          {/* Drag handle — visually a thin vertical bar between the two panes. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(splitPct)}
            aria-valuemin={30}
            aria-valuemax={80}
            aria-label="Resize split between main content and diary"
            tabIndex={0}
            onPointerDown={onPointerDownHandle}
            onPointerMove={onPointerMoveHandle}
            onPointerUp={onPointerUpHandle}
            onKeyDown={onKeyDownHandle}
            className="absolute top-0 bottom-0 -ml-1 w-2 cursor-col-resize z-10 hover:bg-blue-500/15 focus:bg-blue-500/15 outline-none group"
            style={{ left: `${splitPct}%` }}
            data-testid="split-handle"
          >
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-9 rounded-full bg-slate-300 group-hover:bg-blue-500 group-focus:bg-blue-500" />
          </div>

          {/* LEFT — tab strip + body */}
          <div className="border-r border-slate-200 flex flex-col min-w-0 min-h-0">
            <div className="bg-white border-b border-slate-200 px-6 flex gap-7 flex-shrink-0">
              {TABS.map((t) => {
                const on = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`relative py-3 text-[15px] font-semibold ${on ? "text-slate-900" : "text-slate-500"}`}
                    data-testid={`job-card-desktop-tab-${t.id}`}
                  >
                    {t.label}
                    {on && (
                      <span className="absolute -bottom-px left-[-4px] right-[-4px] h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                );
              })}
              <span className="ml-auto py-3 text-[11px] uppercase tracking-wide font-bold text-slate-400 self-center">
                Diary always visible →
              </span>
            </div>

            {/* Tab bodies. Details is wired via JobDetailsPanel (the same
                component the mobile card uses — shared cache, identical
                auto-save behaviour). Other tabs remain placeholders until
                Phase D drops the matching panels in. */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === "details" && <JobDetailsPanel jobId={jobId} />}
              {activeTab !== "details" && (
                <div className="p-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                    <p className="text-[14px] font-semibold text-slate-700">{TABS.find((t) => t.id === activeTab)?.label} body</p>
                    <p className="text-[12px] mt-1">Placeholder — Phase D will plug in the real panel for this tab.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — always-visible Job Diary (Phase C).
              Reuses the same JobDiarySection the mobile card uses, so the
              feed/composer/email-threading behaviour is identical across
              surfaces and shares the React Query cache.

              JobDiarySection brings its own "Job Diary" header, quick-note
              input, and composer modals — so we don't wrap it in any of
              the placeholder chrome that was here before. The outer div
              just constrains height + provides the pane background.

              onQuoteClick / onInvoiceClick / onProposalClick are left
              undefined for now — those open document modals from inside
              the diary. They wire up when the matching tabs (Billing /
              Quoting) land in Phase D, so we can reuse the existing modal
              state instead of duplicating it here. */}
          <div className="bg-white min-w-0 min-h-0 overflow-hidden flex flex-col">
            <JobDiarySection
              jobId={jobId}
              customerId={customerId}
              customerEmail={(customer?.email as string | undefined) ?? undefined}
              customerPhone={(customer?.phone as string | undefined) ?? undefined}
              className="flex-1 min-h-0"
            />
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {actionBtn("Photo", Camera, "bg-purple-100", "text-purple-600")}
            {actionBtn("Call", Phone, "bg-emerald-100", "text-emerald-600")}
            {actionBtn("SMS", MessageSquare, "bg-blue-100", "text-blue-600")}
            {actionBtn("Email", Mail, "bg-amber-100", "text-amber-600")}
          </div>
          <div className="flex items-center gap-2">
            {actionBtn("Quote", FileText, "bg-amber-100", "text-amber-600")}
            {actionBtn("Invoice", CreditCard, "bg-emerald-100", "text-emerald-600")}
            {actionBtn("Proposal", FilePen, "bg-red-100", "text-red-600")}
            {actionBtn("More", MoreHorizontal, "bg-slate-100", "text-slate-600")}
          </div>
        </div>

      </div>
    </div>
  );
}
