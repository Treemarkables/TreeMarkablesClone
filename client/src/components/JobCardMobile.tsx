/**
 * Mobile-first job card modal — Phase A scaffold.
 *
 * Owns the redesigned chrome (header + tab strip + fixed bottom action bar)
 * and slots in the existing tab panels (JobChecklistPanel / JobQuotingPanel /
 * JobDiarySection) untouched. Details + Billing tabs show a "coming next"
 * placeholder for now — they'll be ported tab-by-tab in Phase B/C.
 *
 * Phase A keeps GlobalJobCard.tsx untouched. This file is reachable via the
 * preview route /job-card-preview/:jobId for visual + interaction QA before
 * we wire it into the real flow.
 */
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useJobActions } from "@/hooks/useJobActions";
import { useToast } from "@/hooks/use-toast";
import { getJobStatusBadge } from "@/lib/jobStatusColors";
import {
  X as XIcon,
  Camera,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  CheckCircle,
  Copy,
  Trash2,
  Mic,
  Calendar,
  FileText,
  CreditCard,
  FilePen,
  TrendingUp,
  ListOrdered,
  Send,
  Loader2,
  Navigation,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { JobChecklistPanel } from "@/components/JobChecklistPanel";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";
import { JobQuotingPanel } from "@/components/JobQuotingPanel";
import { BackCostingPanel } from "@/components/BackCostingPanel";
import { JobDiarySection } from "@/components/JobDiarySection";
import { JobVideos } from "@/components/JobVideos";
import { JobDetailsPanel } from "@/components/JobDetailsPanel";
import { JobBillingPanel } from "@/components/JobBillingPanel";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { SMSComposerModal } from "@/components/SMSComposerModal";
import { OnMyWayDialog } from "@/components/OnMyWayDialog";
import { EmailComposerModal } from "@/components/EmailComposerModal";

export type JobCardMobileTab =
  | "details"
  | "billing"
  | "backcosting"
  | "checklist"
  | "quoting"
  | "diary";

export interface JobCardMobileProps {
  /** Job ID — required for all data fetching + panel routing. */
  jobId: string;
  /** Initial tab when the modal opens. Defaults to "details". */
  initialTab?: JobCardMobileTab;
  /** Called when the user taps the close (✕) button. */
  onClose: () => void;
  /** Called when the user taps Save. */
  onSave?: () => void;
  isSaving?: boolean;
  /** Bottom-bar action handlers — Phase A uses no-op fallbacks when undefined. */
  onPhoto?: () => void;
  onCall?: () => void;
  onSms?: () => void;
  onEmail?: () => void;
  onMore?: () => void;
  /** Diary callbacks — passed straight through to JobDiarySection. */
  onQuoteClick?: () => void;
  onInvoiceClick?: () => void;
  onProposalClick?: (proposalNumber: string) => void;
  /**
   * Called after Duplicate Job succeeds. Parent (GlobalJobCard) typically
   * wires this to swap the open modal over to the newly created job so the
   * user is dropped straight into editing the duplicate. If omitted,
   * JobCardMobile just closes itself — the duplicate still appears in the
   * jobs list, the user finds it from there.
   */
  onDuplicated?: (newJobId: string) => void;
  /**
   * Handlers for the 9 tiles in the bottom Actions sheet. Parent
   * (GlobalJobCard) supplies these so the new mobile UI opens the same
   * modals its desktop counterpart does. Any missing handler renders a
   * "coming soon" toast — keeps the preview route functional too.
   */
  actions?: {
    speechToQuote?: () => void;
    schedule?: () => void;
    quote?: () => void;
    invoice?: () => void;
    proposal?: () => void;
    timeTracking?: () => void;
    profitTracker?: () => void;
    queueJob?: () => void;
    sendToXero?: () => void;
    /** True while the send-to-Xero request is in flight — drives the
     *  tile's "Sending…" state so a tap gives visible feedback. */
    sendToXeroPending?: boolean;
  };
}

const TABS: { id: JobCardMobileTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "billing", label: "Billing" },
  // Back Costing — see comment in JobCardDesktop.tsx for the rationale.
  { id: "backcosting", label: "Back Costing" },
  { id: "checklist", label: "Checklist" },
  { id: "quoting", label: "Quoting" },
  { id: "diary", label: "Diary" },
];

// Mirrors DispatchBoard's QUEUE_REASONS so the two surfaces stay aligned.
// If you add/rename a reason, update both lists (a future refactor could
// hoist this into shared/ — for now duplication is the smaller change).
const QUEUE_REASONS = [
  "Weather Hold",
  "Awaiting Permit",
  "Customer Not Ready",
  "Awaiting Quote Approval",
  "Materials Needed",
  "Crew Unavailable",
  "Other",
];

function formatNzd(amount?: number | string | null): string {
  if (amount == null) return "$0.00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "$0.00";
  return "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function JobCardMobile({
  jobId,
  initialTab = "details",
  onClose,
  onSave,
  isSaving,
  onPhoto,
  onCall,
  onSms,
  onEmail,
  onMore,
  onQuoteClick,
  onInvoiceClick,
  onProposalClick,
  onDuplicated,
  actions,
}: JobCardMobileProps) {
  const [activeTab, setActiveTab] = useState<JobCardMobileTab>(initialTab);

  // When a notification arrives for the job that's already open, DispatchBoard
  // fires `job-card-switch-tab` so the card jumps to the right tab (e.g. diary)
  // without remounting. GlobalJobCard handles this for desktop; the mobile card
  // owns its own tab state, so it has to listen too — otherwise tapping a
  // diary notification while the card is open does nothing.
  useEffect(() => {
    const handler = (event: Event) => {
      const requested = (event as CustomEvent<JobCardMobileTab>).detail;
      if (requested) setActiveTab(requested);
    };
    window.addEventListener("job-card-switch-tab", handler);
    return () => window.removeEventListener("job-card-switch-tab", handler);
  }, []);

  // Role checklist (Kaitiaki / Kaiwhangai / Kaitirotiro) is Treemarkables-only.
  const roleChecklistEnabled = useRoleChecklistFeature();

  // Fetch job — uses the same query key GlobalJobCard does so cache is shared.
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

  const jobNumber = (job?.jobNumber as number | undefined) ?? undefined;
  const status = (job?.status as string | undefined) ?? "lead";
  const badge = getJobStatusBadge(status);
  // Header price — mirrors the desktop GlobalJobCard header (lines 4582-4613)
  // so the same number appears in both UIs. Previously read three made-up
  // field names (jobPrice / totalValue / estimatedValue) that don't exist
  // on the jobs row, so it always displayed $0.00.
  //
  // Line items are stored GST-EXCLUSIVE (item.total = ex-GST per
  // priceIncludesTax: false default — see GlobalJobCard line 4583).
  // Desktop header displays the ex-GST total, so we do too.
  //
  // Fallback chain: line items → job.subtotal (already ex-GST) →
  // job.totalIncludingGst / 1.15 → job.totalAmount / 1.15 (both stored inc-GST).
  // The totalIncludingGst step matters: jobs whose value lives only in
  // total_including_gst otherwise render as $0.00 here while the roster
  // (StaffSchedule.getJobPrice) shows the real figure.
  const jobValue = useMemo(() => {
    const toNum = (v: unknown): number => {
      if (v == null) return 0;
      const n = typeof v === "string" ? parseFloat(v) : (v as number);
      return Number.isFinite(n) ? n : 0;
    };
    const lineItems = (job?.lineItems as Array<Record<string, unknown>> | undefined) ?? [];
    const lineItemsTotal = lineItems.reduce((sum, li) => {
      // Prefer explicit ex-GST fields; fall back to .total (also ex-GST by default).
      const exGst =
        toNum(li.totalExGst) ||
        (li.priceExGst != null ? toNum(li.priceExGst) * toNum(li.quantity || 1) : 0);
      return sum + (exGst || toNum(li.total));
    }, 0);
    if (lineItemsTotal > 0) return lineItemsTotal;
    const jobSubtotal = toNum(job?.subtotal);
    if (jobSubtotal > 0) return jobSubtotal;
    const incGst = toNum(job?.totalIncludingGst);
    if (incGst > 0) return incGst / 1.15;
    const totalAmount = toNum(job?.totalAmount);
    return totalAmount > 0 ? totalAmount / 1.15 : undefined;
  }, [job]);

  // Modal state for the three composer modals reused from GlobalJobCard.
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOnMyWay, setShowOnMyWay] = useState(false);

  // Pick the best phone for native dialer: job-level mobile → customer mobile →
  // job-level phone → customer phone. Strips spaces so tel: parses cleanly.
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

  // Resolve handler precedence: parent-provided prop wins, else our default.
  const handlePhoto = onPhoto ?? (() => setShowPhotoModal(true));
  const handleSms = onSms ?? (() => setShowSmsModal(true));
  const handleEmail = onEmail ?? (() => setShowEmailModal(true));
  const handleCall = onCall ?? (() => {
    if (phoneForCall) {
      window.location.href = `tel:${phoneForCall}`;
    } else {
      // eslint-disable-next-line no-console
      console.warn("[JobCardMobile] Call — no phone number on this job or customer");
    }
  });

  const { toast } = useToast();
  const [, navigate] = useLocation();

  // ── Shared job-action mutations + handlers ─────────────────────────────
  // Mark Complete / Duplicate / Delete / Queue and the empty-draft delete
  // prompt all live in useJobActions so this card and JobCardDesktop share
  // a single implementation.
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
    onQueueMenuClick: onQueueTile,
    handleClose,
  } = jobActions;

  // Mobile-only: tap "Open Full Dispatch" in the More sheet to bail out of
  // the modal and land on the full dispatch board. No desktop equivalent.
  const onOpenFull = () => {
    onClose();
    navigate("/dispatch");
  };

  // Each action in the Actions sheet currently surfaces a "coming soon" toast
  // until we wire it through to the right modal/flow in GlobalJobCard.
  const actionStub = (which: string) => () => {
    toast({
      title: `${which} — coming soon`,
      description: "We'll wire this up to the existing flow in a follow-up phase.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" data-testid="job-card-mobile">
      {/* ── Header (compact — price sits inline with the badge to save vertical space) ── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 truncate">
            Job {jobNumber ?? ""}
          </h1>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ background: badge.bg }}
          >
            {badge.label}
          </span>
          <span className="text-[16px] font-bold text-slate-900 truncate" data-testid="job-card-mobile-price">
            {formatNzd(jobValue)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 grid place-items-center hover:bg-slate-200"
          >
            <XIcon className="w-4 h-4" />
          </button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !onSave}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 h-9"
            data-testid="btn-save-job"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Tab strip ── */}
      <div className="flex border-b border-slate-200 px-4 gap-5 flex-shrink-0 overflow-x-auto overflow-y-hidden" data-testid="job-card-mobile-tabs">
        {TABS.filter((t) => {
          // Back Costing is only meaningful once work has happened — hide
          // it on lead/quote so the tab strip stays focused on the job's
          // current stage.
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
              className={`relative py-3 text-[15px] font-semibold whitespace-nowrap flex-shrink-0 ${
                on ? "text-slate-900" : "text-slate-500"
              }`}
              data-testid={`job-card-mobile-tab-${t.id}`}
            >
              {t.label}
              {on && (
                <span className="absolute -bottom-px left-[-4px] right-[-4px] h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Body (scrollable, action bar overlays bottom) ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="pb-[110px]">
          {activeTab === "details" && <JobDetailsPanel jobId={jobId} />}
          {activeTab === "billing" && <JobBillingPanel jobId={jobId} />}
          {activeTab === "backcosting" && (
            <div className="bg-white">
              <BackCostingPanel jobId={jobId} />
            </div>
          )}
          {activeTab === "checklist" && roleChecklistEnabled && (
            <div className="bg-white">
              <JobChecklistPanel jobId={jobId} />
            </div>
          )}
          {activeTab === "quoting" && (
            <div className="bg-white">
              <JobQuotingPanel jobId={jobId} />
            </div>
          )}
          {activeTab === "diary" && (
            <div className="bg-white">
              {/* Job Videos sits above the diary feed — same vertical order
                  as the legacy GlobalJobCard layout. Collapsed by default;
                  expand to upload a walkthrough and (post-upload) opt into
                  the AI quote-description flow. */}
              <div className="p-3">
                <JobVideos jobId={jobId} />
              </div>
              <JobDiarySection
                jobId={jobId}
                customerId={customerId}
                customerEmail={customer?.email as string | undefined}
                customerPhone={customer?.phone as string | undefined}
                embedded
                onQuoteClick={onQuoteClick}
                onInvoiceClick={onInvoiceClick}
                onProposalClick={onProposalClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom action bar ── */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-white border-t border-slate-200 flex justify-around items-start gap-1 px-3 z-10"
        style={{
          paddingTop: 10,
          paddingBottom: "max(22px, env(safe-area-inset-bottom))",
        }}
      >
        <ActionBtn label="Photo" color="bg-emerald-500" onClick={handlePhoto} icon={Camera} />
        <ActionBtn label="Call" color="bg-green-600" onClick={handleCall} icon={Phone} />
        <ActionBtn label="SMS" color="bg-blue-600" onClick={handleSms} icon={MessageSquare} />
        <ActionBtn label="Email" color="bg-red-500" onClick={handleEmail} icon={Mail} />

        {/* More — opens an iOS-style Actions sheet from the bottom. */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-1 py-1 px-2 min-w-[52px]"
              data-testid="job-card-mobile-action-more"
              onClick={() => onMore?.()}
            >
              <div className="w-12 h-12 rounded-full bg-slate-700 grid place-items-center text-white shadow-md">
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <div className="text-[12px] font-semibold text-slate-800">More</div>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-slate-200 p-0 max-h-[90vh] flex flex-col"
          >
            <SheetHeader className="px-6 pt-3 pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-slate-300 mb-3" />
              <SheetTitle className="text-center text-lg font-extrabold tracking-tight text-slate-900">
                Actions
              </SheetTitle>
            </SheetHeader>

            <div className="overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-4 gap-x-3 gap-y-4">
                <ActionTile label="Speech to Quote" icon={Mic} colour="purple" onClick={actions?.speechToQuote ?? actionStub("Speech to Quote")} />
                <ActionTile label="Schedule" icon={Calendar} colour="blue" onClick={actions?.schedule ?? actionStub("Schedule")} />
                <ActionTile label="Quote" icon={FileText} colour="amber" onClick={actions?.quote ?? actionStub("Quote")} />
                <ActionTile label="Invoice" icon={CreditCard} colour="green" onClick={actions?.invoice ?? actionStub("Invoice")} />
                <ActionTile label="Proposal" icon={FilePen} colour="red" onClick={actions?.proposal ?? actionStub("Proposal")} />
                <ActionTile label="Profit Tracker" icon={TrendingUp} colour="cyan" onClick={actions?.profitTracker ?? actionStub("Profit Tracker")} />
                <ActionTile label="On My Way" icon={Navigation} colour="orange" onClick={() => setShowOnMyWay(true)} />
                <ActionTile label="Photo Report" icon={FileImage} colour="slate" onClick={() => window.open(`/api/jobs/${jobId}/photo-report.pdf`, "_blank")} />
                <ActionTile
                  label={jobInQueue ? "In Queue" : "Queue Job"}
                  icon={ListOrdered}
                  colour="indigo"
                  onClick={actions?.queueJob ?? onQueueTile}
                />
                {/* Live state comes from this card's own fresh job query —
                    xeroStatus flips to "sent" via the invalidation after a
                    successful send, no close/reopen needed. Stays tappable
                    when already sent so the handler's "use Reset Xero Sync"
                    toast can explain the state. */}
                <ActionTile
                  label={
                    actions?.sendToXeroPending
                      ? "Sending..."
                      : job?.xeroStatus === "sent"
                        ? "Sent to Xero"
                        : "Send to Xero"
                  }
                  icon={
                    actions?.sendToXeroPending
                      ? Loader2
                      : job?.xeroStatus === "sent"
                        ? CheckCircle
                        : Send
                  }
                  iconSpin={actions?.sendToXeroPending}
                  colour={job?.xeroStatus === "sent" ? "green" : "slate"}
                  disabled={!actions?.sendToXero || actions?.sendToXeroPending}
                  onClick={actions?.sendToXero ?? actionStub("Send to Xero")}
                  testId="action-tile-send-to-xero"
                />
              </div>

              {/* Secondary admin actions — kept around because they're already wired
                  and live data deletion shouldn't be buried any further. */}
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={onMarkComplete}
                  disabled={markComplete.isPending || job?.status === "completed"}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-emerald-400 to-emerald-600 grid place-items-center flex-shrink-0 shadow-sm">
                    <CheckCircle className="w-[18px] h-[18px] text-white" strokeWidth={2.25} />
                  </span>
                  <span className="text-[15px] font-semibold text-slate-900">
                    {job?.status === "completed" ? "Already complete" : "Mark job as complete"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onDuplicate}
                  disabled={duplicateJob.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                  data-testid="btn-duplicate-job"
                >
                  <span className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-blue-400 to-blue-600 grid place-items-center flex-shrink-0 shadow-sm">
                    <Copy className="w-[18px] h-[18px] text-white" strokeWidth={2.25} />
                  </span>
                  <span className="text-[15px] font-semibold text-slate-900">
                    {duplicateJob.isPending ? "Duplicating..." : "Duplicate job"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleteJob.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-red-400 to-red-600 grid place-items-center flex-shrink-0 shadow-sm">
                    <Trash2 className="w-[18px] h-[18px] text-white" strokeWidth={2.25} />
                  </span>
                  <span className="text-[15px] font-semibold text-red-700">Delete job</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Composer modals (reused from GlobalJobCard) ── */}
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
      {showOnMyWay && (
        <OnMyWayDialog
          isOpen={showOnMyWay}
          onClose={() => setShowOnMyWay(false)}
          jobId={jobId}
          phone={phoneForCall}
          customerName={
            (customer?.name as string | undefined) ||
            [job?.jobContactFirstName, job?.jobContactLastName].filter(Boolean).join(" ") ||
            undefined
          }
          address={(job?.address as string | undefined) || (customer?.address as string | undefined)}
        />
      )}

      {/* Queue-reason picker — opened from the Queue Job tile when the job
          isn't already in queue. Mirrors DispatchBoard's queue dialog so
          the two surfaces feel identical. */}
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

// Coloured action tile shown in the Actions sheet. iOS app-icon style:
// gradient squircle, white lucide glyph, glossy top highlight, soft
// colour-matched shadow. Label below.
type TileColour = "purple" | "blue" | "amber" | "green" | "red" | "orange" | "cyan" | "indigo" | "slate";
const TILE_COLOURS: Record<TileColour, { grad: string; shadow: string }> = {
  purple: { grad: "from-purple-400 to-purple-600",   shadow: "shadow-purple-500/30" },
  blue:   { grad: "from-blue-400 to-blue-600",       shadow: "shadow-blue-500/30" },
  amber:  { grad: "from-amber-400 to-orange-500",    shadow: "shadow-amber-500/30" },
  green:  { grad: "from-emerald-400 to-emerald-600", shadow: "shadow-emerald-500/30" },
  red:    { grad: "from-red-400 to-red-600",         shadow: "shadow-red-500/30" },
  orange: { grad: "from-orange-400 to-orange-600",   shadow: "shadow-orange-500/30" },
  cyan:   { grad: "from-cyan-400 to-cyan-600",       shadow: "shadow-cyan-500/30" },
  indigo: { grad: "from-indigo-400 to-indigo-600",   shadow: "shadow-indigo-500/30" },
  slate:  { grad: "from-slate-400 to-slate-600",     shadow: "shadow-slate-500/30" },
};

function ActionTile({
  label,
  icon: Icon,
  colour,
  onClick,
  disabled,
  iconSpin,
  testId,
}: {
  label: string;
  icon: React.ElementType;
  colour: TileColour;
  onClick: () => void;
  disabled?: boolean;
  iconSpin?: boolean;
  /** Override for tiles whose label changes with state (e.g. "Sending...")
   *  so the testid stays stable. */
  testId?: string;
}) {
  const c = TILE_COLOURS[colour];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 group disabled:opacity-50"
      data-testid={testId ?? `action-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className={`relative w-16 h-16 rounded-[1.25rem] bg-gradient-to-b ${c.grad} grid place-items-center overflow-hidden shadow-lg ${c.shadow} group-active:scale-95 transition-transform`}
      >
        {/* glossy top highlight — light falls from above, like a native app icon */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-transparent" />
        <Icon className={`relative w-7 h-7 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] ${iconSpin ? "animate-spin" : ""}`} strokeWidth={2} />
      </div>
      <div className="text-[11.5px] font-semibold text-slate-900 leading-tight text-center max-w-[72px]">
        {label}
      </div>
    </button>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
  icon: Icon,
}: {
  label: string;
  color: string;
  onClick: () => void;
  icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-1 px-2 min-w-[52px]"
      data-testid={`job-card-mobile-action-${label.toLowerCase()}`}
    >
      <div
        className={`w-12 h-12 rounded-full ${color} grid place-items-center text-white shadow-md`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-[12px] font-semibold text-slate-800">{label}</div>
    </button>
  );
}

