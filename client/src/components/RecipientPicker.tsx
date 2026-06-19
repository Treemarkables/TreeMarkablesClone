/**
 * RecipientPicker — a small multi-select dropdown for choosing which contact(s)
 * a message goes to. Used by the email and SMS composers and the proposal
 * send dialogs.
 *
 * It surfaces every recipient available for a job — the Job Contact, the Tenant
 * contact, the Customer's default details, and every saved contact under the
 * customer (/api/customers/:id/contacts) — and lets the user tick one or more.
 *
 * Selection is stored directly in the consumer's free-text recipient field as a
 * comma-separated string (`value`/`onChange`), so manual entry keeps working and
 * "send to multiple contacts" is just multiple addresses on one To line.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, Users } from "lucide-react";

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

interface Candidate {
  key: string;
  label: string;
  sublabel?: string;
  address: string;
}

interface RecipientPickerProps {
  channel: "email" | "sms";
  customerId?: string;
  job?: any;
  customer?: any;
  /** Current value of the consumer's recipient field (comma-separated). */
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

function joinName(a?: string | null, b?: string | null): string {
  return [a, b].filter(Boolean).join(" ").trim();
}

function normalizeAddr(a: string, channel: "email" | "sms"): string {
  if (channel === "email") return a.trim().toLowerCase();
  return a.replace(/\D/g, ""); // compare phones by digits only
}

export function RecipientPicker({
  channel,
  customerId,
  job,
  customer,
  value,
  onChange,
  className,
}: RecipientPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: resp } = useQuery<{ success?: boolean; data?: SavedContact[] }>({
    queryKey: ["/api/customers", customerId, "contacts"],
    enabled: !!customerId,
    staleTime: 60_000,
  });
  const savedContacts = resp?.data ?? [];

  const candidates: Candidate[] = useMemo(() => {
    const out: Candidate[] = [];
    const push = (key: string, label: string, sublabel: string, address?: string | null) => {
      const a = (address ?? "").trim();
      if (!a) return;
      out.push({ key, label: label || "(unnamed)", sublabel, address: a });
    };

    push(
      "job",
      joinName(job?.jobContactFirstName, job?.jobContactLastName),
      "Job contact",
      channel === "email"
        ? job?.jobContactEmail || customer?.email
        : job?.jobContactMobile || job?.jobContactPhone || customer?.mobile || customer?.phone,
    );
    push(
      "tenant",
      joinName(job?.tenantContactFirstName, job?.tenantContactLastName),
      "Tenant",
      channel === "email"
        ? job?.tenantContactEmail
        : job?.tenantContactMobile || job?.tenantContactPhone,
    );
    push(
      "customer",
      customer?.name,
      "Customer",
      channel === "email" ? customer?.email : customer?.mobile || customer?.phone,
    );
    for (const sc of savedContacts) {
      push(
        `sc-${sc.id}`,
        joinName(sc.firstName, sc.lastName),
        sc.role || (sc.isPrimary ? "Primary contact" : "Saved contact"),
        channel === "email" ? sc.email : sc.mobile || sc.phone,
      );
    }

    // De-dupe by address so the same person doesn't appear twice (e.g. job
    // contact == a saved contact). First occurrence wins.
    const seen = new Set<string>();
    return out.filter((c) => {
      const norm = normalizeAddr(c.address, channel);
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [channel, job, customer, savedContacts]);

  const currentList = (): string[] =>
    value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

  const selectedSet = useMemo(() => {
    const set = new Set<string>();
    currentList().forEach((a) => set.add(normalizeAddr(a, channel)));
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, channel]);

  const toggle = (address: string) => {
    const norm = normalizeAddr(address, channel);
    const list = currentList();
    const exists = list.some((a) => normalizeAddr(a, channel) === norm);
    const next = exists
      ? list.filter((a) => normalizeAddr(a, channel) !== norm)
      : [...list, address];
    onChange(next.join(", "));
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (candidates.length === 0) return null;

  const selectedCount = selectedSet.size;

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 hover:text-blue-900"
        data-testid="recipient-picker-toggle"
      >
        <Users className="w-3.5 h-3.5" />
        {selectedCount > 1 ? `${selectedCount} contacts` : "Choose contacts"}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute z-50 right-0 mt-1 w-72 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1"
          data-testid="recipient-picker-menu"
        >
          {candidates.map((c) => {
            const checked = selectedSet.has(normalizeAddr(c.address, channel));
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.address)}
                className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-slate-50 text-left"
                data-testid={`recipient-option-${c.key}`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    checked ? "bg-blue-600 border-blue-600" : "border-slate-300"
                  }`}
                >
                  {checked && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-900 truncate">{c.label}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {c.sublabel ? `${c.sublabel} · ` : ""}
                    {c.address}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
