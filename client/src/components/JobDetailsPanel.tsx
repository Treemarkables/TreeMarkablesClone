/**
 * Mobile Details panel — Phase B port for JobCardMobile.
 *
 * Self-contained: fetches job + customer via React Query (shares cache with
 * GlobalJobCard), keeps its own local edit state, and PUTs changes to
 * /api/jobs/:id on blur (text) or change (selects/checkboxes).
 *
 * Scope:
 *   - Customer card (read-only display + map link)
 *   - Job Description (editable, auto-save on blur)
 *   - Internal Notes (orange-tinted, auto-save on blur)
 *   - Status / Lead Source / Quote Method selects
 *   - Customer confirmed checkbox
 *
 * Not yet ported (defer to Phase B.5 or C):
 *   - Contacts card (Job Contact / Tenant Details)
 *   - Voice transcription wired into the textareas
 *   - "Notify on arrival" toggle (not a real DB field — needs design call)
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, ChevronDown, Mic, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface JobDetailsPanelProps {
  jobId: string;
}

interface JobShape {
  id?: string;
  jobNumber?: number;
  description?: string | null;
  internalNotes?: string | null;
  status?: string | null;
  leadSource?: string | null;
  presentationMethod?: string | null;
  customerConfirmed?: boolean | null;
  customerId?: string | null;
  address?: string | null;
}

interface CustomerShape {
  id?: string;
  name?: string | null;
  address?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  quote: "Quote",
  work_order: "Work Order",
  scheduled: "Scheduled",
  completed: "Completed",
  unsuccessful: "Unsuccessful",
};

const STATUS_BG: Record<string, string> = {
  lead: "#fef3c7",
  quote: "#fef3c7",
  work_order: "#eff6ff",
  scheduled: "#f3e8ff",
  completed: "#dcfce7",
  unsuccessful: "#fee2e2",
};
const STATUS_FG: Record<string, string> = {
  lead: "#9a3412",
  quote: "#9a3412",
  work_order: "#1d4ed8",
  scheduled: "#6b21a8",
  completed: "#15803d",
  unsuccessful: "#b91c1c",
};

export function JobDetailsPanel({ jobId }: JobDetailsPanelProps) {
  const queryClient = useQueryClient();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: jobResp } = useQuery<{ success?: boolean; data?: JobShape }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const job = jobResp?.data;

  const customerId = job?.customerId ?? undefined;
  const { data: custResp } = useQuery<{ success?: boolean; data?: CustomerShape }>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
    staleTime: 60_000,
  });
  const customer = custResp?.data;

  // ── Local edit state (mirrors server, updated on every render with fresh data) ─
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  useEffect(() => { if (job) setDescription(job.description ?? ""); }, [job?.description]);
  useEffect(() => { if (job) setInternalNotes(job.internalNotes ?? ""); }, [job?.internalNotes]);

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveField = useMutation({
    mutationFn: async (patch: Partial<JobShape>) => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  const status = job?.status ?? "lead";
  const statusLabel = STATUS_LABEL[status] ?? status;

  const addressDisplay = customer?.address ?? job?.address ?? "";

  return (
    <div className="p-4 space-y-3.5">
      {/* ── Customer card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[20px] font-extrabold tracking-tight text-slate-900 leading-tight truncate">
            {customer?.name ?? "Unnamed customer"}
          </h2>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: STATUS_BG[status] ?? "#f1f5f9", color: STATUS_FG[status] ?? "#475569" }}
          >
            {statusLabel}
          </span>
        </div>
        {addressDisplay && (
          <div className="flex items-center gap-1.5 mt-2 text-[14px] text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{addressDisplay}</span>
          </div>
        )}
        {addressDisplay && (
          <a
            href={`https://www.google.com/maps/place/${encodeURIComponent(addressDisplay)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2.5 text-[14px] font-semibold text-blue-600"
          >
            View on Map (Bird's Eye)
            <ChevronDown className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* ── Job Description ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[14px] font-bold text-blue-600">Job Description</div>
          <button
            type="button"
            disabled
            title="Voice transcription — coming soon"
            className="flex items-center gap-1 text-[14px] font-bold text-purple-600 opacity-60"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice
          </button>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if ((job?.description ?? "") !== description) saveField.mutate({ description });
          }}
          placeholder="Add a job description..."
          rows={4}
          className="w-full bg-slate-100 rounded-xl px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none"
          data-testid="job-description"
        />
      </div>

      {/* ── Internal Notes (orange tint) ── */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-orange-700">
            <Lock className="w-3.5 h-3.5" />
            Internal Notes
          </div>
          <button
            type="button"
            disabled
            title="Voice transcription — coming soon"
            className="flex items-center gap-1 text-[14px] font-bold text-purple-600 opacity-60"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice
          </button>
        </div>
        <div className="text-[12.5px] font-semibold text-orange-700/70 mb-2.5">
          Staff only — not visible to customers
        </div>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          onBlur={() => {
            if ((job?.internalNotes ?? "") !== internalNotes) saveField.mutate({ internalNotes });
          }}
          placeholder="Add internal notes..."
          rows={4}
          className="w-full bg-white border border-orange-200 rounded-xl px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          data-testid="internal-notes"
        />
      </div>

      {/* ── Status grid ── */}
      <div className="grid grid-cols-3 gap-2.5">
        <SelectField
          label="Job Status"
          value={status}
          onChange={(v) => saveField.mutate({ status: v })}
          options={[
            { value: "lead", label: "Lead" },
            { value: "quote", label: "Quote" },
            { value: "work_order", label: "Work Order" },
            { value: "scheduled", label: "Scheduled" },
            { value: "completed", label: "Completed" },
            { value: "unsuccessful", label: "Unsuccessful" },
          ]}
        />
        <SelectField
          label="Lead Source"
          value={job?.leadSource ?? ""}
          onChange={(v) => saveField.mutate({ leadSource: v || null })}
          options={[
            { value: "", label: "—" },
            { value: "phone", label: "Phone" },
            { value: "website", label: "Website" },
            { value: "referral", label: "Referral" },
            { value: "repeat", label: "Repeat" },
            { value: "google", label: "Google" },
            { value: "facebook", label: "Facebook" },
            { value: "direct", label: "Direct" },
            { value: "other", label: "Other" },
          ]}
        />
        <SelectField
          label="Quote Method"
          value={job?.presentationMethod ?? ""}
          onChange={(v) => saveField.mutate({ presentationMethod: v || null })}
          options={[
            { value: "", label: "—" },
            { value: "on_site", label: "On-site" },
            { value: "sent_later", label: "Sent later" },
            { value: "phone", label: "Phone" },
          ]}
        />
      </div>

      {/* ── Confirmation checkbox ── */}
      <label className="flex items-center gap-2.5 px-1 py-2 text-[15px] text-slate-900 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!job?.customerConfirmed}
          onChange={(e) => saveField.mutate({ customerConfirmed: e.target.checked })}
          className="w-5 h-5 accent-blue-600 cursor-pointer"
          data-testid="customer-confirmed"
        />
        Customer confirmed
      </label>

      {/* Contacts card — deferred to Phase B.5 */}
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-4 text-center">
        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contacts</div>
        <div className="text-[13px] text-slate-500">Coming next — for now the legacy modal still owns saved contacts &amp; tenant details.</div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-slate-500 mb-1">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-[14px] font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
