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
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, ChevronDown, Mic, MicOff, Lock, UserPlus, Pencil, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { SpeechToQuote } from "@/components/SpeechToQuote";
import { AddressAutocomplete, type ParsedAddress } from "@/components/AddressAutocomplete";

// The Web Speech API (webkitSpeechRecognition) is present on `window` inside the
// iOS Capacitor WKWebView but is a silent no-op there — recognition never starts,
// so the inline Voice button did nothing on the native app. Detect the native
// shell so we can route it to the Whisper-backed recorder instead.
const isNativeApp = () =>
  typeof window !== "undefined" &&
  typeof (window as any).Capacitor !== "undefined" &&
  !!(window as any).Capacitor.isNativePlatform?.();

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
  laneId?: string | null;
  // The existing app saves the on-site / sent-later toggle to
  // quotePresentationMethod (jobs.quote_presentation_method). There's also an
  // older presentationMethod column kicking around, but the desktop UI binds
  // to quotePresentationMethod — saving anywhere else is a silent no-op.
  quotePresentationMethod?: string | null;
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
  city?: string | null;
  region?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

// Lead jobs auto-created on the server land with a literal `address:
// "Address not specified"` placeholder (see server/routes.ts:2663, :2927
// and storage.ts:2267, :4133). Treat that placeholder as "no address" for
// every guard / display path; otherwise linkCustomer's hasJobAddress check
// trips on the placeholder and skips auto-fill.
const PLACEHOLDER_ADDRESS_RE = /^\s*address not specified\s*$/i;
function isMeaningfulAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_ADDRESS_RE.test(trimmed);
}

// Many imported customers have a null `customers.address` but populated
// `city`/`region`. A second slice of imports had the street address typed
// into the `name` field itself ("175 gaddums", "21 Stanley road") — for
// those the address columns are all empty and the name pattern-matches
// "<digits> <word>". Compose a best-effort address from whichever of those
// the customer has, so picking still surfaces something to display + save.
// Mirrors the helper in GlobalJobCard.tsx — kept local to avoid a shared
// import that has to thread through too many call sites.
function composeCustomerAddress(
  customer:
    | {
        address?: string | null;
        city?: string | null;
        region?: string | null;
        name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!customer) return "";
  const street = (customer.address || "").trim();
  if (street) return street;
  const parts = [customer.city, customer.region]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(", ");
  // Last-resort fallback: many imports stored the address in the name field.
  // Heuristic: starts with one or more digits, whitespace, then a word.
  const name = (customer.name || "").trim();
  if (/^\d+\s+\S/.test(name)) return name;
  return "";
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
  const { toast } = useToast();

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

  // All customers — used in two places: (a) the empty-state picker when the
  // job has no customer linked yet, and (b) the "✎ Change" popover on a
  // linked-customer card so the user can re-link to a different record
  // without leaving the panel. The list is small + cached for 60s; React
  // Query shares the cache with the Clients page and dispatch board.
  const { data: allCustomersResp } = useQuery<{ success?: boolean; data?: CustomerShape[] }>({
    queryKey: ["/api/customers"],
    staleTime: 60_000,
  });
  const allCustomers = useMemo(
    () =>
      [...(allCustomersResp?.data ?? [])].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    [allCustomersResp],
  );

  // ── Proposal-description fallback ───────────────────────────────────────────
  // Many jobs (especially those that came via accept-proposal → work_order)
  // have an empty `job.description` because the customer-facing work scope
  // was only written into the proposal's "Job Description" section. Pull
  // the most recent proposal for this job so we can surface that text when
  // the job row is empty. No backend writes — pure display fallback.
  const { data: proposalsResp } = useQuery<{
    success?: boolean;
    data?: Array<{
      id: string;
      status?: string;
      createdAt?: string;
      sections?: Array<{ sectionType?: string; title?: string; content?: string }>;
    }>;
  }>({
    queryKey: ["/api/proposals", { jobId, includeSections: true }],
    queryFn: async () => {
      const res = await fetch(
        `/api/proposals?jobId=${encodeURIComponent(jobId)}&includeSections=true`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load proposals (HTTP ${res.status})`);
      return res.json();
    },
    enabled: !!jobId && !job?.description,
    staleTime: 60_000,
  });
  const proposalDescription = useMemo(() => {
    const proposals = proposalsResp?.data ?? [];
    if (proposals.length === 0) return "";
    // Prefer the most recent — proposals come ordered newest-first from
    // storage.getProposalsByJob, but sort defensively in case that changes.
    const sorted = [...proposals].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
    for (const p of sorted) {
      const sections = p.sections ?? [];
      // Primary match: semantic sectionType. Fallback: title contains
      // "description" (case-insensitive) — handles older/custom templates.
      const match =
        sections.find((s) => s.sectionType === "service_description") ??
        sections.find((s) => (s.title ?? "").toLowerCase().includes("description"));
      if (match?.content?.trim()) return match.content.trim();
    }
    return "";
  }, [proposalsResp]);

  // ── Local edit state (mirrors server, updated on every render with fresh data) ─
  // Description falls back to the proposal's "Job Description" section when
  // the job row's description is empty — see proposalDescription above.
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [descriptionFromProposal, setDescriptionFromProposal] = useState(false);
  useEffect(() => {
    if (!job) return;
    if (job.description && job.description.trim()) {
      setDescription(job.description);
      setDescriptionFromProposal(false);
    } else if (proposalDescription) {
      setDescription(proposalDescription);
      setDescriptionFromProposal(true);
    } else {
      setDescription("");
      setDescriptionFromProposal(false);
    }
  }, [job?.description, proposalDescription]);
  useEffect(() => { if (job) setInternalNotes(job.internalNotes ?? ""); }, [job?.internalNotes]);
  // Per-job address override. Initial value falls back to the customer's
  // address so the field reflects what's shown elsewhere (dispatch board,
  // etc.) — saving writes to job.address, leaving the customer record alone.
  const [address, setAddress] = useState("");
  useEffect(() => {
    if (!job) return;
    setAddress(
      isMeaningfulAddress(job.address)
        ? (job.address as string)
        : composeCustomerAddress(customer),
    );
    // Include customer?.name so that the name-as-address fallback re-fires
    // when the linked customer changes but address/city/region stay null.
  }, [
    job?.address,
    customer?.address,
    customer?.city,
    customer?.region,
    customer?.name,
  ]);

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

  // Lanes — custom buckets a job can sit in (orthogonal to status). Assigning goes through the
  // dedicated /lane endpoint (not the auto-save PUT) so on-enter automations fire consistently.
  const { data: lanes = [] } = useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ["/api/lanes"],
    queryFn: async () => {
      const res = await fetch("/api/lanes");
      if (!res.ok) throw new Error("Failed to load lanes");
      return (await res.json()).data;
    },
  });

  const saveLane = useMutation({
    mutationFn: async (laneId: string | null) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/lane`, { laneId });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] }),
    onError: () => toast({ title: "Error", description: "Could not update the lane", variant: "destructive" }),
  });

  // ── Change-customer popover (linked-customer card) ─────────────────────
  // Toggled open from the "✎ Change" pill next to the customer name. Lets
  // the user re-link this job to a different customer record without
  // leaving the panel — handy when a duplicate was picked at create time
  // and merged later. On select, PATCH job.customerId via saveField; the
  // customer query at line 117 then re-fires against the new id and the
  // card re-renders with the new name/address.
  const [isChangingCustomer, setIsChangingCustomer] = useState(false);
  const [changeCustomerSearch, setChangeCustomerSearch] = useState("");
  const filteredChangeCustomers = useMemo(() => {
    const q = changeCustomerSearch.trim().toLowerCase();
    const base = allCustomers.filter((c) => c.id !== customerId);
    if (!q) return base.slice(0, 50);
    return base
      .filter((c) => (c.name ?? "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [allCustomers, changeCustomerSearch, customerId]);

  // ── Pick-a-customer search (no-customer state) ─────────────────────────
  // Replaces the native <select> with a text input + filtered list so the
  // user sees what they're typing. Native macOS <select> didn't surface the
  // search string at all — typing just jumped to the first prefix match.
  const [pickCustomerSearch, setPickCustomerSearch] = useState("");
  const filteredPickCustomers = useMemo(() => {
    const q = pickCustomerSearch.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 50);
    return allCustomers
      .filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [allCustomers, pickCustomerSearch]);

  // ── New-customer inline form (picker UI) ───────────────────────────────
  // Toggled open from the "+ New customer" button under the picker. POSTs
  // /api/customers with the entered fields, then chains into saveField to
  // link the new customer to this job in a single click. Form state is
  // local — the picker block re-renders on success and unmounts the form.
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const createCustomer = useMutation<
    { data?: { id?: string } },
    Error,
    { name: string; phone?: string; email?: string }
  >({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/customers", payload);
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? `Create customer failed (HTTP ${res.status})`);
      }
      return json;
    },
    onSuccess: (json) => {
      const newId = json?.data?.id;
      if (!newId) return;
      // Invalidate the customers list so the new customer shows up next
      // time the picker opens elsewhere.
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      // Link this job to the new customer — same path the picker's
      // existing select uses. The next render swaps to the normal
      // customer header and unmounts this form.
      saveField.mutate({ customerId: newId });
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
    },
  });

  const status = job?.status ?? "lead";
  const statusLabel = STATUS_LABEL[status] ?? status;

  // Link a customer to this job. On first link (no existing job.address),
  // also patch the job's address from the customer so it surfaces in
  // GlobalJobCard / dispatch board / map links without a second save step.
  // Never overwrites a real address the user already set on this job —
  // but the server's "Address not specified" placeholder counts as empty.
  const linkCustomer = (c: CustomerShape) => {
    if (!c.id) return;
    const patch: Partial<JobShape> = { customerId: c.id };
    if (!isMeaningfulAddress(job?.address)) {
      const composed = composeCustomerAddress(c);
      if (composed) patch.address = composed;
    }
    saveField.mutate(patch);
  };

  // Prefer the per-job address when set; fall back to the customer's
  // address (composed from city/region when the address column is null).
  // Inverted from the original order so a per-job override actually wins —
  // matches GlobalJobCard's behaviour. Treats the server-side
  // "Address not specified" placeholder as empty.
  const addressDisplay = isMeaningfulAddress(job?.address)
    ? (job?.address as string)
    : composeCustomerAddress(customer);

  return (
    <div className="p-4 space-y-3.5">
      {/* ── Customer card ──
          Two flavours: when there's a linked customer, show the standard
          name + address + map link. When there isn't (drafts created from
          /dispatch's "+ New" buttons land here), show a picker so the user
          can attach a customer record without leaving the card. Pick
          updates job.customerId via the existing saveField mutation; the
          picker disappears on the next render once customerId is set.
          New-customer creation deferred — for now point users at the
          /customers page if their customer isn't on the list. */}
      {customerId ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsChangingCustomer((v) => !v)}
              className="group flex items-center gap-2 min-w-0 text-left"
              data-testid="button-change-customer"
              aria-label="Change linked customer"
            >
              <h2 className="text-[20px] font-extrabold tracking-tight text-slate-900 leading-tight truncate group-hover:underline">
                {customer?.name ?? "Unnamed customer"}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 group-hover:bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <Pencil className="w-3 h-3" />
                Change
              </span>
            </button>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_BG[status] ?? "#f1f5f9", color: STATUS_FG[status] ?? "#475569" }}
            >
              {statusLabel}
            </span>
          </div>

          {isChangingCustomer && (
            <div className="mt-3 border border-blue-200 rounded-xl bg-blue-50/40 p-2">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={changeCustomerSearch}
                  onChange={(e) => setChangeCustomerSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="input-change-customer-search"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingCustomer(false);
                    setChangeCustomerSearch("");
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800"
                  data-testid="button-change-customer-cancel"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="max-h-60 overflow-y-auto bg-white rounded-lg border border-blue-100 divide-y divide-blue-50">
                {filteredChangeCustomers.length === 0 ? (
                  <li className="px-3 py-2 text-[13px] text-slate-500">No matches</li>
                ) : (
                  filteredChangeCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          linkCustomer(c);
                          setIsChangingCustomer(false);
                          setChangeCustomerSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex flex-col"
                        data-testid={`change-customer-option-${c.id}`}
                      >
                        <span className="text-[14px] font-semibold text-slate-900">
                          {c.name}
                        </span>
                        {c.address && (
                          <span className="text-[12px] text-slate-500 truncate">
                            {c.address}
                          </span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-1.5 mt-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-2" />
            <div className="flex-1 min-w-0">
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onAddressSelect={(parsed: ParsedAddress) => {
                  // Save immediately when the user picks from the suggestions
                  // dropdown — onBlur won't always fire (selecting closes the
                  // popover before the input blurs in some browsers).
                  const picked = (parsed.fullAddress ?? "").trim();
                  if (!picked) return;
                  setAddress(picked);
                  if ((job?.address ?? "") !== picked) {
                    saveField.mutate({ address: picked });
                  }
                }}
                onBlur={() => {
                  const trimmed = address.trim();
                  const oldVal = job?.address ?? "";
                  if (oldVal === trimmed) return;
                  // Server preserves non-empty fields against empty values
                  // unless _clearFields lists them — matches the previous
                  // plain-input save behaviour.
                  if (trimmed === "") {
                    saveField.mutate({ address: null, _clearFields: ["address"] } as any);
                  } else {
                    saveField.mutate({ address: trimmed });
                  }
                }}
                placeholder="Add job address..."
                mode="full"
                bare
                className="bg-transparent border-0 px-1.5 -mx-1.5 h-auto py-1 text-[14px] text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:bg-slate-50 focus-visible:rounded-md"
                data-testid="input-job-address"
              />
            </div>
          </div>
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
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
              <h2 className="text-[16px] font-bold text-blue-900 truncate">
                Pick a customer to get started
              </h2>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_BG[status] ?? "#f1f5f9", color: STATUS_FG[status] ?? "#475569" }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[13px] text-blue-700/85 mt-1">
            Link this job to a customer. Auto-saves on select.
          </p>
          <div className="mt-3">
            <input
              type="text"
              value={pickCustomerSearch}
              onChange={(e) => setPickCustomerSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="customer-picker-search"
              disabled={saveField.isPending}
            />
            <ul className="mt-2 max-h-60 overflow-y-auto bg-white rounded-lg border border-blue-100 divide-y divide-blue-50">
              {filteredPickCustomers.length === 0 ? (
                <li className="px-3 py-2">
                  {pickCustomerSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomerName(pickCustomerSearch.trim());
                        setShowNewCustomerForm(true);
                      }}
                      className="text-[13px] font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                      data-testid="customer-picker-create-from-search"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create "{pickCustomerSearch.trim()}" as a new customer
                    </button>
                  ) : (
                    <span className="text-[13px] text-slate-500">No matches</span>
                  )}
                </li>
              ) : (
                filteredPickCustomers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        linkCustomer(c);
                        setPickCustomerSearch("");
                      }}
                      disabled={saveField.isPending}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex flex-col disabled:opacity-60"
                      data-testid={`customer-picker-option-${c.id}`}
                    >
                      <span className="text-[14px] font-semibold text-slate-900">
                        {c.name}
                      </span>
                      {c.address && (
                        <span className="text-[12px] text-slate-500 truncate">
                          {c.address}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* New-customer inline form — expanded via the toggle below. Lets
              the user create + link a customer without leaving the card. */}
          {showNewCustomerForm ? (
            <div className="mt-3 border-t border-blue-200 pt-3 space-y-2">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Customer name (required)"
                className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="new-customer-name"
                autoFocus
              />
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="new-customer-phone"
              />
              <input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="new-customer-email"
              />
              {createCustomer.error && (
                <p className="text-[12px] text-red-700">
                  {createCustomer.error.message}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomerForm(false);
                    setNewCustomerName("");
                    setNewCustomerPhone("");
                    setNewCustomerEmail("");
                  }}
                  disabled={createCustomer.isPending}
                  className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                  data-testid="new-customer-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const name = newCustomerName.trim();
                    if (!name) return;
                    createCustomer.mutate({
                      name,
                      phone: newCustomerPhone.trim() || undefined,
                      email: newCustomerEmail.trim() || undefined,
                    });
                  }}
                  disabled={!newCustomerName.trim() || createCustomer.isPending || saveField.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-[14px] font-semibold disabled:opacity-60"
                  data-testid="new-customer-save"
                >
                  {createCustomer.isPending || saveField.isPending ? "Saving…" : "Create + link"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (pickCustomerSearch.trim() && !newCustomerName.trim()) {
                  setNewCustomerName(pickCustomerSearch.trim());
                }
                setShowNewCustomerForm(true);
              }}
              className="mt-3 text-[13px] font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
              data-testid="show-new-customer-form"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + New customer
            </button>
          )}
        </div>
      )}

      {/* ── Job Description ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[14px] font-bold text-blue-600">Job Description</div>
          <VoiceButton
            context="job-description"
            onTranscript={(text) => {
              const next = description ? `${description} ${text}` : text;
              setDescription(next);
              saveField.mutate({ description: next });
            }}
          />
        </div>
        {descriptionFromProposal && (
          // Light hint so the user knows where this text came from. The first
          // edit + blur saves it onto job.description, after which the
          // fallback disappears on its own (job.description is no longer empty).
          <div className="mb-2 text-[12px] text-slate-500" data-testid="description-from-proposal-hint">
            From the accepted proposal — edit and tap away to save to the job.
          </div>
        )}
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
          <VoiceButton
            context="internal-notes"
            onTranscript={(text) => {
              const next = internalNotes ? `${internalNotes} ${text}` : text;
              setInternalNotes(next);
              saveField.mutate({ internalNotes: next });
            }}
          />
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
          value={job?.quotePresentationMethod ?? ""}
          onChange={(v) => saveField.mutate({ quotePresentationMethod: v || null })}
          options={[
            { value: "", label: "—" },
            { value: "on_site", label: "On-site" },
            { value: "sent_later", label: "Sent later" },
          ]}
        />
        {lanes.length > 0 && (
          <SelectField
            label="Lane"
            value={job?.laneId ?? ""}
            onChange={(v) => saveLane.mutate(v || null)}
            options={[
              { value: "", label: "— None —" },
              ...lanes.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        )}
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

  // ── Add saved contact (inline form) ──────────────────────────────────────
  // Saves a person under this customer so they can be reused across jobs, then
  // auto-loads them into the active contact tab. Mirrors the desktop job card's
  // createContactMutation (GlobalJobCard) but uses the mobile inline-form style.
  const emptyContactDraft = { firstName: "", lastName: "", role: "", email: "", mobile: "", phone: "" };
  const [showAddContact, setShowAddContact] = useState(false);
  // When non-null, the inline form is editing the saved contact with this id
  // (PATCH) instead of adding a new one (POST). The form UI is shared.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState(emptyContactDraft);
  const createContact = useMutation<SavedContact, Error, typeof emptyContactDraft>({
    mutationFn: async (input) => {
      if (!customerId) throw new Error("no customer id");
      const res = await apiRequest("POST", `/api/customers/${customerId}/contacts`, input);
      const json = await res.json();
      if (!json?.success || !json?.data) {
        throw new Error(json?.message || "Couldn't save the contact. Please try again.");
      }
      return json.data as SavedContact;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "contacts"] });
      // Auto-load the freshly-created contact into whichever tab is active.
      const patch: Partial<JobShape> = tab === "job"
        ? {
            jobContactFirstName: created.firstName ?? null,
            jobContactLastName: created.lastName ?? null,
            jobContactEmail: created.email ?? null,
            jobContactMobile: created.mobile ?? null,
            jobContactPhone: created.phone ?? null,
          }
        : {
            tenantContactFirstName: created.firstName ?? null,
            tenantContactLastName: created.lastName ?? null,
            tenantContactEmail: created.email ?? null,
            tenantContactMobile: created.mobile ?? null,
            tenantContactPhone: created.phone ?? null,
          };
      saveField.mutate(patch);
      setShowAddContact(false);
      setContactDraft(emptyContactDraft);
    },
  });

  // Edit an existing saved contact (PATCH /api/customer-contacts/:id). Lets the
  // user fix a contact's email/mobile/etc. so the change persists to the contact
  // record itself — not just a per-job override.
  const updateContact = useMutation<SavedContact, Error, { id: string; patch: typeof emptyContactDraft }>({
    mutationFn: async ({ id, patch }) => {
      const res = await apiRequest("PATCH", `/api/customer-contacts/${id}`, patch);
      const json = await res.json();
      if (!json?.success || !json?.data) {
        throw new Error(json?.message || "Couldn't update the contact. Please try again.");
      }
      return json.data as SavedContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "contacts"] });
      setEditingId(null);
      setShowAddContact(false);
      setContactDraft(emptyContactDraft);
    },
  });

  // Open the inline form in edit mode, pre-filled from the chosen contact.
  const openEditContact = (sc: SavedContact) => {
    setShowAddContact(false);
    setEditingId(sc.id);
    setContactDraft({
      firstName: sc.firstName ?? "",
      lastName: sc.lastName ?? "",
      role: sc.role ?? "",
      email: sc.email ?? "",
      mobile: sc.mobile ?? "",
      phone: sc.phone ?? "",
    });
  };

  const closeContactForm = () => {
    setShowAddContact(false);
    setEditingId(null);
    setContactDraft(emptyContactDraft);
  };

  // The inline form is shown for either add or edit.
  const contactFormOpen = showAddContact || editingId !== null;
  const contactFormPending = createContact.isPending || updateContact.isPending;
  const contactFormError = editingId !== null ? updateContact.error : createContact.error;

  // Pick the right set of fields based on which tab is active.
  // For "job" tab, fall back to the customer record when job-level overrides are
  // empty — leads created from the website only ever stamp jobContactMobile/Phone
  // onto the job row (see server/routes.ts inquiry conversion), so firstName/
  // lastName/email live solely on the customer. Without this fallback the UI
  // looks empty even though the data exists.
  const custNameParts = (customer?.name ?? "").trim().split(/\s+/).filter(Boolean);
  const custFirstName = custNameParts[0] ?? "";
  const custLastName = custNameParts.slice(1).join(" ");
  const fields = tab === "job"
    ? {
        firstName: job?.jobContactFirstName ?? custFirstName ?? "",
        lastName: job?.jobContactLastName ?? custLastName ?? "",
        email: job?.jobContactEmail ?? customer?.email ?? "",
        mobile: job?.jobContactMobile ?? customer?.mobile ?? "",
        phone: job?.jobContactPhone ?? customer?.phone ?? "",
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
    customer?.name, customer?.email, customer?.phone, customer?.mobile,
  ]);

  const commit = (k: "firstName" | "lastName" | "email" | "mobile" | "phone") => {
    const next = draft[k];
    const current = fields[k];
    if ((next ?? "") === (current ?? "")) return;
    const key = fieldKey(k);
    const trimmed = (next ?? "").trim();
    if (trimmed === "") {
      // Intentional clear. The server's anti-wipe safeguard restores empty
      // values UNLESS the field is named in _clearFields, so without this a
      // user can never remove a contact number/email — it just reappears.
      saveField.mutate({ [key]: null, _clearFields: [key] } as unknown as Partial<JobShape>);
    } else {
      saveField.mutate({ [key]: trimmed } as Partial<JobShape>);
    }
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
            if (!customerId) return;
            if (contactFormOpen) {
              closeContactForm();
            } else {
              setEditingId(null);
              setContactDraft(emptyContactDraft);
              setShowAddContact(true);
            }
          }}
          disabled={!customerId}
          className="text-[14px] font-bold text-blue-600 flex-shrink-0 self-start disabled:opacity-50"
          data-testid="add-saved-contact"
        >
          {contactFormOpen ? "Close" : "+ Add"}
        </button>
      </div>

      {/* Add/edit-contact inline form — opens under the banner via + Add, or via
          the Edit button on a saved contact. */}
      {contactFormOpen && (
        <div className="mt-2 border border-blue-200 rounded-xl p-3 space-y-2 bg-blue-50/40">
          <div className="text-[12px] font-bold uppercase tracking-wider text-blue-700">
            {editingId !== null ? "Edit contact" : "New contact"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={contactDraft.firstName}
              onChange={(e) => setContactDraft({ ...contactDraft, firstName: e.target.value })}
              placeholder="First name"
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="add-contact-first-name"
              autoFocus
            />
            <input
              type="text"
              value={contactDraft.lastName}
              onChange={(e) => setContactDraft({ ...contactDraft, lastName: e.target.value })}
              placeholder="Last name"
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="add-contact-last-name"
            />
          </div>
          <input
            type="text"
            value={contactDraft.role}
            onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value })}
            placeholder="Role (e.g. Manager)"
            className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="add-contact-role"
          />
          <input
            type="email"
            value={contactDraft.email}
            onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
            placeholder="Email"
            className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="add-contact-email"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="tel"
              value={contactDraft.mobile}
              onChange={(e) => setContactDraft({ ...contactDraft, mobile: e.target.value })}
              placeholder="Mobile"
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="add-contact-mobile"
            />
            <input
              type="tel"
              value={contactDraft.phone}
              onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
              placeholder="Phone (landline)"
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="add-contact-phone"
            />
          </div>
          {contactFormError && (
            <p className="text-[12px] text-red-700">{contactFormError.message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closeContactForm}
              disabled={contactFormPending}
              className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-2 text-[14px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              data-testid="add-contact-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const draft = {
                  firstName: contactDraft.firstName.trim(),
                  lastName: contactDraft.lastName.trim(),
                  role: contactDraft.role.trim(),
                  email: contactDraft.email.trim(),
                  mobile: contactDraft.mobile.trim(),
                  phone: contactDraft.phone.trim(),
                };
                if (!draft.firstName && !draft.lastName) return;
                if (editingId !== null) {
                  updateContact.mutate({ id: editingId, patch: draft });
                } else {
                  createContact.mutate(draft);
                }
              }}
              disabled={
                (!contactDraft.firstName.trim() && !contactDraft.lastName.trim()) ||
                contactFormPending
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-[14px] font-semibold disabled:opacity-60"
              data-testid="add-contact-save"
            >
              {contactFormPending ? "Saving…" : "Save contact"}
            </button>
          </div>
        </div>
      )}

      {/* Saved contacts list — when present */}
      {savedContacts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {savedContacts.map((sc) => {
            const name = [sc.firstName, sc.lastName].filter(Boolean).join(" ") || "(unnamed)";
            return (
              <div
                key={sc.id}
                className="w-full flex items-center gap-1 px-1 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <button
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
                  className="flex-1 min-w-0 flex items-center justify-between px-2 py-2 text-left"
                  data-testid={`load-saved-contact-${sc.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-900 truncate">{name}</div>
                    {sc.role && <div className="text-[12px] text-slate-500 truncate">{sc.role}</div>}
                  </div>
                  {sc.isPrimary && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">Primary</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEditContact(sc)}
                  className="flex-shrink-0 p-2 text-slate-400 hover:text-blue-600"
                  data-testid={`edit-saved-contact-${sc.id}`}
                  aria-label={`Edit ${name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
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

// ─── Voice transcription button ─────────────────────────────────────────────

type VoiceContext = "job-description" | "internal-notes";

function VoiceButton({
  onTranscript,
  context,
}: {
  onTranscript: (text: string) => void;
  context: VoiceContext;
}) {
  // Web Speech recognition doesn't function inside the iOS Capacitor WKWebView,
  // so the native app uses the Whisper-backed SpeechToQuote recorder (MediaRecorder
  // → /api/speech-to-quote), which is iOS-hardened and uses the mic permission
  // declared in Info.plist. Real browsers keep the lighter inline live path.
  // isNativeApp() is stable for the lifetime of the app, so branching on it here
  // doesn't violate the rules of hooks (each child calls its own hooks).
  if (isNativeApp()) {
    return <NativeVoiceButton onTranscript={onTranscript} context={context} />;
  }
  return <WebVoiceButton onTranscript={onTranscript} />;
}

// Native app: open the Whisper recorder and append the returned transcription.
function NativeVoiceButton({
  onTranscript,
  context,
}: {
  onTranscript: (text: string) => void;
  context: VoiceContext;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[14px] font-bold text-purple-600"
        data-testid="voice-button"
      >
        <Mic className="w-3.5 h-3.5" />
        Voice
      </button>
      <SpeechToQuote
        open={open}
        onOpenChange={setOpen}
        context={context}
        onQuoteGenerated={(data: any) => {
          const text =
            typeof data?.transcription === "string" ? data.transcription.trim() : "";
          if (text) onTranscript(text);
        }}
      />
    </>
  );
}

// Browsers: inline live transcription via the Web Speech API.
function WebVoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { isListening, isSupported, toggleListening } = useSpeechToText({
    onResult: (text) => {
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    },
    continuous: false,
    language: "en-NZ",
  });

  // Browser doesn't support Web Speech (e.g. Firefox). Render nothing rather
  // than a permanently-disabled stub.
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`flex items-center gap-1 text-[14px] font-bold ${
        isListening ? "text-red-600 animate-pulse" : "text-purple-600"
      }`}
      data-testid="voice-button"
    >
      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {isListening ? "Stop" : "Voice"}
    </button>
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
