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
  // Job-level contact (overrides customer contact for this job).
  jobContactFirstName?: string | null;
  jobContactLastName?: string | null;
  jobContactEmail?: string | null;
  jobContactPhone?: string | null;
  jobContactMobile?: string | null;
  // Tenant contact — used when the job address is a rental property.
  tenantContactFirstName?: string | null;
  tenantContactLastName?: string | null;
  tenantContactEmail?: string | null;
  tenantContactPhone?: string | null;
  tenantContactMobile?: string | null;
}

interface SavedContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary?: boolean | null;
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

      {/* ── Contacts card ── */}
      <ContactsCard job={job} customer={customer} customerId={customerId} />
    </div>
  );
}

// ─── Contacts card ──────────────────────────────────────────────────────────

function ContactsCard({
  job,
  customer,
  customerId,
}: {
  job: JobShape | undefined;
  customer: CustomerShape | undefined;
  customerId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"job" | "tenant">("job");

  // Saved contacts under this customer — pulled from /api/customers/:id/contacts.
  const { data: savedResp } = useQuery<{ success?: boolean; data?: SavedContact[] }>({
    queryKey: ["/api/customers", customerId, "contacts"],
    enabled: !!customerId,
    staleTime: 60_000,
  });
  const savedContacts = savedResp?.data ?? [];

  const jobId = job?.id;
  const saveField = useMutation({
    mutationFn: async (patch: Partial<JobShape>) => {
      if (!jobId) throw new Error("no job id");
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      if (jobId) queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  // Pick the right set of fields based on which tab is active.
  const fields = tab === "job"
    ? {
        firstName: job?.jobContactFirstName ?? "",
        lastName: job?.jobContactLastName ?? "",
        email: job?.jobContactEmail ?? "",
        mobile: job?.jobContactMobile ?? "",
        phone: job?.jobContactPhone ?? "",
      }
    : {
        firstName: job?.tenantContactFirstName ?? "",
        lastName: job?.tenantContactLastName ?? "",
        email: job?.tenantContactEmail ?? "",
        mobile: job?.tenantContactMobile ?? "",
        phone: job?.tenantContactPhone ?? "",
      };

  const fieldKey = (k: "firstName" | "lastName" | "email" | "mobile" | "phone"): keyof JobShape => {
    const prefix = tab === "job" ? "jobContact" : "tenantContact";
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    return `${prefix}${cap}` as keyof JobShape;
  };

  // Local edit state — keeps the input snappy without round-tripping every keystroke.
  // Re-syncs from the job record whenever the tab changes or the underlying data refetches.
  const [draft, setDraft] = useState(fields);
  useEffect(() => { setDraft(fields); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    tab,
    job?.jobContactFirstName, job?.jobContactLastName, job?.jobContactEmail, job?.jobContactMobile, job?.jobContactPhone,
    job?.tenantContactFirstName, job?.tenantContactLastName, job?.tenantContactEmail, job?.tenantContactMobile, job?.tenantContactPhone,
  ]);

  const commit = (k: "firstName" | "lastName" | "email" | "mobile" | "phone") => {
    const next = draft[k];
    const current = fields[k];
    if ((next ?? "") === (current ?? "")) return;
    saveField.mutate({ [fieldKey(k)]: next || null } as Partial<JobShape>);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900 mb-3">Contacts</h3>

      {/* Saved contacts banner */}
      <div className="bg-blue-50 rounded-xl px-3.5 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-blue-700 leading-tight">
            Saved contacts under {customer?.name ?? "this customer"}
          </div>
          <div className="text-[12.5px] text-blue-600/85 mt-1 leading-snug">
            {savedContacts.length === 0
              ? "No saved contacts yet — add one to reuse across jobs at this customer."
              : `${savedContacts.length} saved ${savedContacts.length === 1 ? "contact" : "contacts"} — tap to load.`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.warn("[JobDetailsPanel] + Add saved contact not wired up yet — Phase B.6");
          }}
          className="text-[14px] font-bold text-blue-600 flex-shrink-0 self-start"
          data-testid="add-saved-contact"
        >
          + Add
        </button>
      </div>

      {/* Saved contacts list — when present */}
      {savedContacts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {savedContacts.map((sc) => {
            const name = [sc.firstName, sc.lastName].filter(Boolean).join(" ") || "(unnamed)";
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  // Tap-to-load: populate the active contact tab with this saved contact.
                  const patch: Partial<JobShape> = tab === "job"
                    ? {
                        jobContactFirstName: sc.firstName ?? null,
                        jobContactLastName: sc.lastName ?? null,
                        jobContactEmail: sc.email ?? null,
                        jobContactMobile: sc.mobile ?? null,
                        jobContactPhone: sc.phone ?? null,
                      }
                    : {
                        tenantContactFirstName: sc.firstName ?? null,
                        tenantContactLastName: sc.lastName ?? null,
                        tenantContactEmail: sc.email ?? null,
                        tenantContactMobile: sc.mobile ?? null,
                        tenantContactPhone: sc.phone ?? null,
                      };
                  saveField.mutate(patch);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 truncate">{name}</div>
                  {sc.role && <div className="text-[12px] text-slate-500 truncate">{sc.role}</div>}
                </div>
                {sc.isPrimary && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">Primary</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Job Contact / Tenant Details segmented pill */}
      <div className="flex bg-slate-100 rounded-full p-1 mt-3.5">
        <button
          type="button"
          onClick={() => setTab("job")}
          className={`flex-1 py-2 rounded-full text-[14px] font-semibold ${tab === "job" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          data-testid="contacts-tab-job"
        >
          Job Contact
        </button>
        <button
          type="button"
          onClick={() => setTab("tenant")}
          className={`flex-1 py-2 rounded-full text-[14px] font-semibold ${tab === "tenant" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          data-testid="contacts-tab-tenant"
        >
          Tenant Details
        </button>
      </div>

      {/* Editable fields for the active tab */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <InputField placeholder="First name" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} onBlur={() => commit("firstName")} />
        <InputField placeholder="Last name" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} onBlur={() => commit("lastName")} />
      </div>
      <div className="mt-2.5">
        <InputField placeholder="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} onBlur={() => commit("email")} type="email" />
      </div>
      <div className="mt-2.5">
        <InputField placeholder="Mobile" value={draft.mobile} onChange={(v) => setDraft({ ...draft, mobile: v })} onBlur={() => commit("mobile")} type="tel" />
      </div>
      <div className="mt-2.5">
        <InputField placeholder="Phone (landline)" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} onBlur={() => commit("phone")} type="tel" />
      </div>
    </div>
  );
}

function InputField({
  value,
  onChange,
  onBlur,
  placeholder,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full bg-slate-100 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
    />
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
