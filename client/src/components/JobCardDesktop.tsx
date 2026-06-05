/**
 * Desktop-first job card modal.
 *
 * Replaces GlobalJobCard's legacy desktop edit-mode layout. Mounted from
 * GlobalJobCard when the viewport is ≥768px, the modal is open in edit
 * mode (`editingJob?.id` set), and we're not in renderInline (split-
 * screen panel) mode. Create-mode and the inline panel still use the
 * legacy `jobCardContent` — see the layout-gate comment in GlobalJobCard.
 *
 * Header + tab strip + split-screen body + draggable divider + bottom
 * action bar. All four tabs (Details, Billing, Checklist, Quoting) and
 * the always-visible Diary on the right reuse the same panel components
 * the mobile card mounts, so React Query cache and auto-save behaviour
 * are identical across surfaces. Bottom-bar Photo/Call/SMS/Email own
 * their composer modals locally; Quote/Invoice/Proposal/More wire into
 * GlobalJobCard's existing modal setters via the `actions` prop (the
 * same callback bag mobile receives, so the two surfaces stay aligned).
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
 * (clamped to 30%–80%); the chosen ratio + last-active tab persist to
 * localStorage so the layout the user settles on sticks across opens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Mic,
  Calendar as CalendarIcon,
  Clock,
  TrendingUp,
  Send,
  CheckCircle,
  Copy,
  Trash2,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useJobActions } from "@/hooks/useJobActions";
import { JobDetailsPanel } from "@/components/JobDetailsPanel";
import { JobDiarySection } from "@/components/JobDiarySection";
import { JobVideos } from "@/components/JobVideos";
import { JobBillingPanel } from "@/components/JobBillingPanel";
import { JobChecklistPanel } from "@/components/JobChecklistPanel";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";
import { JobQuotingPanel } from "@/components/JobQuotingPanel";
import { BackCostingPanel } from "@/components/BackCostingPanel";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { SMSComposerModal } from "@/components/SMSComposerModal";
import { EmailComposerModal } from "@/components/EmailComposerModal";

export type JobCardDesktopTab =
  | "details"
  | "billing"
  | "backcosting"
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
  /**
   * Overrides for the bottom action bar + items shown in the "More"
   * dropdown menu. Photo / Call / SMS / Email have local defaults (open
   * the relevant composer modal / `tel:` link). The rest have no
   * sensible default in isolation — the parent (GlobalJobCard) routes
   * them to the same modals / mutations it already owns. Mirrors the
   * shape of JobCardMobile's `actions` so the two surfaces stay in sync
   * when a new action lands; any item the parent doesn't supply is
   * simply hidden from the More menu rather than rendered as a stub.
   */
  actions?: {
    // Bottom bar
    photo?: () => void;
    call?: () => void;
    sms?: () => void;
    email?: () => void;
    quote?: () => void;
    invoice?: () => void;
    proposal?: () => void;
    // More menu (parent-supplied)
    speechToQuote?: () => void;
    schedule?: () => void;
    timeTracking?: () => void;
    profitTracker?: () => void;
    sendToXero?: () => void;
  };
  /**
   * Called after Duplicate Job succeeds. Parent (GlobalJobCard) typically
   * wires this to swap the open card over to the new duplicate so the
   * user is dropped straight into editing it. Omitting it falls back to
   * closing the card — the duplicate still appears in the jobs list, the
   * user finds it from there. Mirrors JobCardMobile's onDuplicated.
   */
  onDuplicated?: (newJobId: string) => void;
  /**
   * Forwarded straight to JobDiarySection. Fired when a diary entry that
   * references a quote / invoice / proposal is clicked. Parent supplies
   * these so clicks in the diary open the same modals desktop users get
   * from any other surface.
   */
  onQuoteClick?: (quoteNumber: string) => void;
  onInvoiceClick?: (invoiceNumber: string) => void;
  onProposalClick?: (proposalNumber: string) => void;
}

// Map job status → badge colour. Mirrors JobCardMobile's STATUS_BADGE so
// the badge looks identical on both surfaces.
const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  lead: { label: "Lead", bg: "#f59e0b" },
  quote: { label: "Quote", bg: "#f59e0b" },
  work_order: { label: "Work Order", bg: "#2563eb" },
  completed: { label: "Completed", bg: "#16a34a" },
  unsuccessful: { label: "Unsuccessful", bg: "#ef4444" },
};

const TABS: { id: JobCardDesktopTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "billing", label: "Billing" },
  // Back Costing — consolidates time entries, all cost categories on the
  // job, and revenue into a single margin rollup. Slots between Billing and
  // Checklist so the visual flow goes "what we'll charge" → "what it cost"
  // → "did we finish everything we said we would".
  { id: "backcosting", label: "Back Costing" },
  { id: "checklist", label: "Checklist" },
  { id: "quoting", label: "Quoting" },
];

// Mirrors JobCardMobile + DispatchBoard's QUEUE_REASONS so the three
// surfaces stay aligned. If you add/rename a reason, update all three
// (or hoist into shared/ — duplication is the smaller change for now).
const QUEUE_REASONS = [
  "Weather Hold",
  "Awaiting Permit",
  "Customer Not Ready",
  "Awaiting Quote Approval",
  "Materials Needed",
  "Crew Unavailable",
  "Other",
];

// localStorage keys for the two persisted preferences. Per-user, not
// per-job — most users settle on a split + tab that suits their workflow
// and want that to stick across opens. Try/catch around all reads/writes
// since private-mode Safari throws on localStorage access.
const STORAGE_KEY_SPLIT = "jobCardDesktop.splitPct";
const STORAGE_KEY_TAB = "jobCardDesktop.activeTab";
const DEFAULT_SPLIT_PCT = 60;

function readStoredSplitPct(): number {
  if (typeof window === "undefined") return DEFAULT_SPLIT_PCT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SPLIT);
    if (!raw) return DEFAULT_SPLIT_PCT;
    const n = parseFloat(raw);
    // Clamp to the same 30–80 range the drag handle uses — guards against
    // a malformed / out-of-range value left over from older code.
    if (!Number.isFinite(n)) return DEFAULT_SPLIT_PCT;
    return Math.max(30, Math.min(80, n));
  } catch {
    return DEFAULT_SPLIT_PCT;
  }
}

function readStoredTab(fallback: JobCardDesktopTab): JobCardDesktopTab {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_TAB);
    // Validate against the known tab ids — anything stale or hand-edited
    // falls through to the fallback rather than crashing the layout.
    if (raw === "details" || raw === "billing" || raw === "checklist" || raw === "quoting") {
      return raw;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

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
  actions,
  onDuplicated,
  onQuoteClick,
  onInvoiceClick,
  onProposalClick,
}: JobCardDesktopProps) {
  // Persisted preferences — last-used tab + split ratio, restored across
  // opens. Caller-supplied initialTab still wins (so a future "Open the
  // Billing tab when the user clicks an invoice in the diary" flow can
  // override the stored preference for one open).
  const [activeTab, setActiveTab] = useState<JobCardDesktopTab>(
    () => readStoredTab(initialTab),
  );
  // Role checklist (Kaitiaki / Kaiwhangai / Kaitirotiro) is Treemarkables-only.
  const roleChecklistEnabled = useRoleChecklistFeature();
  // Split ratio (left pane as a percentage). 60/40 default to match the
  // approved mockup. Clamped to 30–80 during drag so neither pane disappears.
  const [splitPct, setSplitPct] = useState<number>(() => readStoredSplitPct());

  // Persist tab + split changes back to localStorage on every change. No
  // debounce on splitPct — writes are cheap and we want the new value to
  // stick the moment the user releases the drag, not 200ms later.
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY_TAB, activeTab); } catch { /* private-mode Safari */ }
  }, [activeTab]);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY_SPLIT, String(splitPct)); } catch { /* private-mode Safari */ }
  }, [splitPct]);

  // Composer-modal state. Same pattern JobCardMobile uses — local state for
  // Photo / SMS / Email modals keeps the bottom-bar buttons self-contained.
  // The `actions` prop can override any of these to route into the parent's
  // modal system if a deeper integration is needed later.
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { toast } = useToast();

  // ── Shared job-action mutations + handlers ─────────────────────────────
  // Mark Complete / Duplicate / Delete / Queue and the empty-draft delete
  // prompt all live in useJobActions so this card and JobCardMobile share a
  // single implementation. The hook also exposes the queue dialog state and
  // the isJobEmpty derived used here.
  const jobActions = useJobActions(jobId, { onClose, onDuplicated });
  const {
    markComplete,
    deleteJob,
    duplicateJob,
    queueJob,
    showQueueDialog,
    setShowQueueDialog,
    queueReasonInput,
    setQueueReasonInput,
    jobInQueue,
    onMarkComplete,
    onDuplicate,
    onDelete,
    onQueueMenuClick,
    handleClose,
  } = jobActions;

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

  // ── Bottom action bar handlers ────────────────────────────────────────
  // Pick the best phone for the native dialer: job-level mobile → customer
  // mobile → job-level phone → customer phone. Strip spaces so tel: parses
  // cleanly. Matches JobCardMobile's phoneForCall logic exactly.
  const phoneForCall = useMemo(() => {
    const candidates = [
      (job?.jobContactMobile as string | undefined),
      (customer?.mobile as string | undefined),
      (job?.jobContactPhone as string | undefined),
      (customer?.phone as string | undefined),
    ];
    const picked = candidates.find((p) => p && String(p).trim().length > 0);
    return picked ? String(picked).replace(/\s+/g, "") : null;
  }, [job, customer]);

  // Each handler: parent-supplied action wins, else local default. Quote /
  // Invoice / Proposal have no local default — they fall back to a toast
  // on the rare path where the parent doesn't supply them (e.g. a future
  // standalone usage outside GlobalJobCard). The More button is a dropdown
  // trigger so it doesn't need a handler.
  const actionStub = (label: string) => () => {
    toast({
      title: `${label} — not wired up`,
      description: "This action needs to be supplied via the actions prop.",
    });
  };
  const handlePhoto = actions?.photo ?? (() => setShowPhotoModal(true));
  const handleSms = actions?.sms ?? (() => setShowSmsModal(true));
  const handleEmail = actions?.email ?? (() => setShowEmailModal(true));
  const handleCall = actions?.call ?? (() => {
    if (phoneForCall) {
      window.location.href = `tel:${phoneForCall}`;
    } else {
      toast({
        title: "No phone number on file",
        description: "Add a job-contact or customer phone first.",
        variant: "destructive",
      });
    }
  });
  const handleQuote = actions?.quote ?? actionStub("Quote");
  const handleInvoice = actions?.invoice ?? actionStub("Invoice");
  const handleProposal = actions?.proposal ?? actionStub("Proposal");

  // Mark Complete / Duplicate / Delete / Queue handlers + isJobEmpty +
  // handleClose all come from useJobActions above. See the hook for the
  // shared confirm + mutation flow.

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center p-4"
      data-testid="job-card-desktop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
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
              onClick={handleClose}
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
              {TABS.filter((t) => {
                // Back Costing is only meaningful once work has happened —
                // hide it on lead/quote so the tab strip stays focused on
                // the job's current stage.
                if (t.id === "backcosting" && (status === "lead" || status === "quote")) {
                  return false;
                }
                // Role checklist tab is Treemarkables-only.
                if (t.id === "checklist" && !roleChecklistEnabled) {
                  return false;
                }
                return true;
              }).map((t) => {
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

            {/* Tab bodies. Every panel is the same component the mobile
                card mounts, so React Query cache and auto-save behaviour
                are identical between surfaces — opening a job that's
                already open in mobile / GlobalJobCard / the diary triggers
                no duplicate fetches. */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === "details" && <JobDetailsPanel jobId={jobId} />}
              {activeTab === "billing" && <JobBillingPanel jobId={jobId} />}
              {activeTab === "backcosting" && (
                <BackCostingPanel
                  jobId={jobId}
                  onOpenTimeEntries={actions?.timeTracking}
                />
              )}
              {activeTab === "checklist" && roleChecklistEnabled && <JobChecklistPanel jobId={jobId} />}
              {activeTab === "quoting" && <JobQuotingPanel jobId={jobId} />}
            </div>
          </div>

          {/* RIGHT — always-visible Job Diary.
              Reuses the same JobDiarySection the mobile card uses, so the
              feed / composer / email-threading behaviour is identical
              across surfaces and shares the React Query cache.

              JobDiarySection brings its own "Job Diary" header, quick-note
              input, and composer modals — so the outer div just constrains
              height + provides the pane background. The onQuote / Invoice /
              ProposalClick props are forwarded straight from ours so the
              parent can open its document modals when a diary entry
              referencing one is tapped. Undefined is safe — JobDiarySection
              no-ops the click. */}
          <div className="bg-white min-w-0 min-h-0 overflow-hidden flex flex-col">
            {/* Job Videos sits above the diary feed — same vertical order as
                the legacy GlobalJobCard layout. Collapsed by default; expand
                to upload a walkthrough and (post-upload) opt into the AI
                quote-description flow.

                Cap to ~half the right-column height with internal scroll —
                otherwise an expanded panel (video player + list of videos
                + retry buttons) pushes past the parent's overflow-hidden
                boundary, hiding content with no way to scroll. Collapsed
                state still uses only its natural ~40px height. */}
            <div className="p-3 flex-shrink-0 max-h-[50vh] overflow-y-auto">
              <JobVideos jobId={jobId} />
            </div>
            <JobDiarySection
              jobId={jobId}
              customerId={customerId}
              customerEmail={(customer?.email as string | undefined) ?? undefined}
              customerPhone={(customer?.phone as string | undefined) ?? undefined}
              className="flex-1 min-h-0"
              onQuoteClick={onQuoteClick}
              onInvoiceClick={onInvoiceClick}
              onProposalClick={onProposalClick}
            />
          </div>
        </div>

        {/* ── Bottom action bar ──
            Photo / Call / SMS / Email work end-to-end via local modal
            state + the native dialer. Quote / Invoice / Proposal / More
            need parent wiring (the document modals live in GlobalJobCard)
            — they fall back to a "not wired up" toast on the unusual path
            where no actions prop is supplied. */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {actionBtn("Photo", Camera, "bg-purple-100", "text-purple-600", handlePhoto)}
            {actionBtn("Call", Phone, "bg-emerald-100", "text-emerald-600", handleCall, !phoneForCall && !actions?.call)}
            {actionBtn("SMS", MessageSquare, "bg-blue-100", "text-blue-600", handleSms)}
            {actionBtn("Email", Mail, "bg-amber-100", "text-amber-600", handleEmail)}
          </div>
          <div className="flex items-center gap-2">
            {actionBtn("Quote", FileText, "bg-amber-100", "text-amber-600", handleQuote)}
            {actionBtn("Invoice", CreditCard, "bg-emerald-100", "text-emerald-600", handleInvoice)}
            {actionBtn("Proposal", FilePen, "bg-red-100", "text-red-600", handleProposal)}

            {/* More menu — items render only if their handler is supplied,
                so the menu shrinks gracefully if the parent doesn't wire
                everything. Three blocks separated by dividers: parent-
                supplied tooling, job-lifecycle, then destructive Delete. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-sm font-semibold text-slate-700"
                  data-testid="job-card-desktop-action-more"
                >
                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 grid place-items-center">
                    <MoreHorizontal className="w-4 h-4" />
                  </span>
                  More
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {actions?.speechToQuote && (
                  <DropdownMenuItem onClick={actions.speechToQuote} data-testid="more-speech-to-quote">
                    <Mic className="w-4 h-4 mr-2 text-purple-600" />
                    Speech to Quote
                  </DropdownMenuItem>
                )}
                {actions?.schedule && (
                  <DropdownMenuItem onClick={actions.schedule} data-testid="more-schedule">
                    <CalendarIcon className="w-4 h-4 mr-2 text-blue-600" />
                    Schedule
                  </DropdownMenuItem>
                )}
                {actions?.timeTracking && (
                  <DropdownMenuItem onClick={actions.timeTracking} data-testid="more-time-tracking">
                    <Clock className="w-4 h-4 mr-2 text-emerald-600" />
                    Time Tracking
                  </DropdownMenuItem>
                )}
                {actions?.profitTracker && (
                  <DropdownMenuItem onClick={actions.profitTracker} data-testid="more-profit-tracker">
                    <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" />
                    Profit Tracker
                  </DropdownMenuItem>
                )}
                {actions?.sendToXero && (
                  <DropdownMenuItem onClick={actions.sendToXero} data-testid="more-send-to-xero">
                    <Send className="w-4 h-4 mr-2 text-blue-600" />
                    Send to Xero
                  </DropdownMenuItem>
                )}
                {(actions?.speechToQuote || actions?.schedule || actions?.timeTracking || actions?.profitTracker || actions?.sendToXero) && (
                  <DropdownMenuSeparator />
                )}
                <DropdownMenuItem
                  onClick={onQueueMenuClick}
                  disabled={queueJob.isPending}
                  data-testid="more-queue-job"
                >
                  <ListOrdered className="w-4 h-4 mr-2 text-indigo-600" />
                  {jobInQueue ? "Remove from Queue" : "Queue Job"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onMarkComplete}
                  disabled={markComplete.isPending}
                  data-testid="more-mark-complete"
                >
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                  {markComplete.isPending ? "Marking…" : "Mark Complete"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDuplicate}
                  disabled={duplicateJob.isPending}
                  data-testid="more-duplicate"
                >
                  <Copy className="w-4 h-4 mr-2 text-blue-600" />
                  {duplicateJob.isPending ? "Duplicating…" : "Duplicate Job"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  disabled={deleteJob.isPending}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                  data-testid="more-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteJob.isPending ? "Deleting…" : "Delete Job"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </div>

      {/* ── Composer modals ──
          Mounted at the root of the modal so they overlay everything,
          including the split-screen body. Mirrors JobCardMobile's
          placement so the two surfaces feel identical. */}
      {showPhotoModal && (
        <PhotoCaptureModal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          jobId={jobId}
        />
      )}
      {showSmsModal && (
        <SMSComposerModal
          isOpen={showSmsModal}
          onClose={() => setShowSmsModal(false)}
          job={job}
          customer={customer}
        />
      )}
      {showEmailModal && (
        <EmailComposerModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          job={job}
          customer={customer}
        />
      )}

      {/* Queue-reason picker — opened from the Queue Job menu item when
          the job isn't already in the queue. Mirrors JobCardMobile +
          DispatchBoard so the three surfaces feel identical. */}
      <Dialog
        open={showQueueDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowQueueDialog(false);
            setQueueReasonInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-indigo-500" />
              Add to Dispatch Queue
            </DialogTitle>
            <DialogDescription>
              Job {jobNumber ?? ""} will move out of the live board until you
              pull it back. Pick a reason so dispatch knows why it's parked.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium mb-2 block">
              Reason for queuing
            </Label>
            <Select value={queueReasonInput} onValueChange={setQueueReasonInput}>
              <SelectTrigger data-testid="select-queue-reason">
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {QUEUE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowQueueDialog(false);
                setQueueReasonInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!queueReasonInput || queueJob.isPending}
              onClick={() => {
                if (queueReasonInput) {
                  queueJob.mutate({ inQueue: true, queueReason: queueReasonInput });
                }
              }}
              data-testid="btn-confirm-queue"
            >
              {queueJob.isPending ? "Queuing..." : "Add to Queue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
