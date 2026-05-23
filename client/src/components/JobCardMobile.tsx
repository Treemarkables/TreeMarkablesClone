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
import { useQuery } from "@tanstack/react-query";
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
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

  const stubMore = (which: string) => () => {
    // eslint-disable-next-line no-console
    console.warn(`[JobCardMobile] More → ${which} not wired up yet`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" data-testid="job-card-mobile">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 truncate">
            Job {jobNumber ?? ""}
          </h1>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ background: badge.bg }}
          >
            {badge.label}
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

      <div className="px-4 pb-3 text-[30px] font-extrabold tracking-tight text-slate-900 flex-shrink-0">
        {formatNzd(jobValue)}
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

        {/* More — opens a dropdown with secondary actions. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-1 py-1 px-2 min-w-[52px]"
              data-testid="job-card-mobile-action-more"
              onClick={() => onMore?.() /* parent can intercept; Radix still opens the menu */}
            >
              <div className="w-12 h-12 rounded-full bg-slate-700 grid place-items-center text-white shadow-md">
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <div className="text-[12px] font-semibold text-slate-800">More</div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={stubMore("Mark complete")}>
              <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
              Mark as complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={stubMore("Duplicate job")}>
              <Copy className="w-4 h-4 mr-2 text-slate-600" />
              Duplicate job
            </DropdownMenuItem>
            <DropdownMenuItem onClick={stubMore("Open full version")}>
              <ExternalLink className="w-4 h-4 mr-2 text-slate-600" />
              Open full version
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={stubMore("Delete job")} className="text-red-600 focus:text-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

