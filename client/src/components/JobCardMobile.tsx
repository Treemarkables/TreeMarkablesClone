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
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Clock,
  TrendingUp,
  ListOrdered,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JobChecklistPanel } from "@/components/JobChecklistPanel";
import { JobQuotingPanel } from "@/components/JobQuotingPanel";
import { JobDiarySection } from "@/components/JobDiarySection";
import { JobDetailsPanel } from "@/components/JobDetailsPanel";
import { JobBillingPanel } from "@/components/JobBillingPanel";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { SMSComposerModal } from "@/components/SMSComposerModal";
import { EmailComposerModal } from "@/components/EmailComposerModal";

export type JobCardMobileTab =
  | "details"
  | "billing"
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
  };
}

// Map job status → badge colour. Mirrors the colour scheme used by
// GlobalJobCard so the badge looks consistent across mobile/desktop.
const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  lead: { label: "Lead", bg: "#f59e0b" },
  quote: { label: "Quote", bg: "#f59e0b" },
  work_order: { label: "Work Order", bg: "#2563eb" },
  scheduled: { label: "Scheduled", bg: "#7c3aed" },
  completed: { label: "Completed", bg: "#16a34a" },
  unsuccessful: { label: "Unsuccessful", bg: "#ef4444" },
};

const TABS: { id: JobCardMobileTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "billing", label: "Billing" },
  { id: "checklist", label: "Checklist" },
  { id: "quoting", label: "Quoting" },
  { id: "diary", label: "Diary" },
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
  const badge = STATUS_BADGE[status] ?? { label: status, bg: "#64748b" };
  const jobValue = useMemo(() => {
    const v = job?.jobPrice ?? job?.totalValue ?? job?.estimatedValue;
    return typeof v === "string" ? parseFloat(v) : (v as number | undefined);
  }, [job]);

  // Modal state for the three composer modals reused from GlobalJobCard.
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

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

  // ─── More menu handlers ──────────────────────────────────────────────────
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const markComplete = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't mark complete", description: err.message, variant: "destructive" });
    },
  });

  const deleteJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/jobs/bulk-delete", { jobIds: [jobId] });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't delete job", description: err.message, variant: "destructive" });
    },
  });

  // POST /api/jobs/:id/duplicate copies scoping (customer, address, line items,
  // contacts, checklists) into a fresh quote-status job with a new jobNumber.
  // Scheduling, assignments, completion state, payments, and Xero IDs all
  // reset — see server/routes.ts for the field whitelist.
  const duplicateJob = useMutation<
    { success?: boolean; data?: { id?: string; jobNumber?: string } },
    Error
  >({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/duplicate`, {});
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? `Duplicate failed (HTTP ${res.status})`);
      }
      return json;
    },
    onSuccess: (json) => {
      // Refresh the jobs list so the duplicate appears in dispatch/calendar/etc.
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      const newId = json?.data?.id;
      if (newId && onDuplicated) {
        // Parent decides what to do with the new job (e.g. swap the open
        // modal over to it). If not handled, close so the user can find the
        // duplicate in the jobs list.
        onDuplicated(newId);
      } else {
        onClose();
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't duplicate job", description: err.message, variant: "destructive" });
    },
  });

  const onMarkComplete = () => markComplete.mutate();
  const onDuplicate = () => {
    if (window.confirm("Create a copy of this job? The duplicate starts as a fresh quote — no scheduling, no payments, new job number.")) {
      duplicateJob.mutate();
    }
  };
  const onOpenFull = () => {
    onClose();
    navigate("/dispatch");
  };
  const onDelete = () => {
    if (window.confirm("Delete this job? This can't be undone.")) {
      deleteJob.mutate();
    }
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
            onClick={onClose}
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
      <div className="flex border-b border-slate-200 px-4 gap-5 flex-shrink-0 overflow-x-auto" data-testid="job-card-mobile-tabs">
        {TABS.map((t) => {
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
          {activeTab === "checklist" && (
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
              <JobDiarySection
                jobId={jobId}
                customerId={customerId}
                customerEmail={customer?.email as string | undefined}
                customerPhone={customer?.phone as string | undefined}
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
              <div className="grid grid-cols-4 gap-3">
                <ActionTile label="Speech to Quote" icon={Mic} colour="purple" onClick={actions?.speechToQuote ?? actionStub("Speech to Quote")} />
                <ActionTile label="Schedule" icon={Calendar} colour="blue" onClick={actions?.schedule ?? actionStub("Schedule")} />
                <ActionTile label="Quote" icon={FileText} colour="amber" onClick={actions?.quote ?? actionStub("Quote")} />
                <ActionTile label="Invoice" icon={CreditCard} colour="green" onClick={actions?.invoice ?? actionStub("Invoice")} />
                <ActionTile label="Proposal" icon={FilePen} colour="red" onClick={actions?.proposal ?? actionStub("Proposal")} />
                <ActionTile label="Time Tracking" icon={Clock} colour="orange" onClick={actions?.timeTracking ?? actionStub("Time Tracking")} />
                <ActionTile label="Profit Tracker" icon={TrendingUp} colour="cyan" onClick={actions?.profitTracker ?? actionStub("Profit Tracker")} />
                <ActionTile label="Queue Job" icon={ListOrdered} colour="indigo" onClick={actions?.queueJob ?? actionStub("Queue Job")} />
                <ActionTile label="Send to Xero" icon={Send} colour="slate" disabled={!actions?.sendToXero} onClick={actions?.sendToXero ?? actionStub("Send to Xero")} />
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
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
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
                  <Copy className="w-5 h-5 text-blue-600 flex-shrink-0" />
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
                  <Trash2 className="w-5 h-5 text-red-600 flex-shrink-0" />
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
    </div>
  );
}

// Coloured action tile shown in the Actions sheet. iOS-style: rounded square
// tinted background, lucide icon, label below.
type TileColour = "purple" | "blue" | "amber" | "green" | "red" | "orange" | "cyan" | "indigo" | "slate";
const TILE_COLOURS: Record<TileColour, { bg: string; icon: string }> = {
  purple: { bg: "bg-purple-100", icon: "text-purple-600" },
  blue:   { bg: "bg-blue-100",   icon: "text-blue-600" },
  amber:  { bg: "bg-amber-100",  icon: "text-amber-600" },
  green:  { bg: "bg-emerald-100", icon: "text-emerald-600" },
  red:    { bg: "bg-red-100",    icon: "text-red-600" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600" },
  cyan:   { bg: "bg-cyan-100",   icon: "text-cyan-600" },
  indigo: { bg: "bg-indigo-100", icon: "text-indigo-600" },
  slate:  { bg: "bg-slate-100",  icon: "text-slate-400" },
};

function ActionTile({
  label,
  icon: Icon,
  colour,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ElementType;
  colour: TileColour;
  onClick: () => void;
  disabled?: boolean;
}) {
  const c = TILE_COLOURS[colour];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 group disabled:opacity-50"
      data-testid={`action-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className={`w-16 h-16 rounded-2xl ${c.bg} grid place-items-center shadow-sm group-active:scale-95 transition-transform`}>
        <Icon className={`w-7 h-7 ${c.icon}`} />
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

