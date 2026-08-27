import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Loader2, Search,
  ShieldCheck, XCircle, Plus, Trash2, Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueRow {
  id: string;
  supplierName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: string | null;
  gst: string | null;
  total: string;
  status: string;
  documentType: string;
  arithmeticValid: boolean | null;
  confidence: string | null;
  validationIssues: string[] | null;
  costCategory: string;
  poOrJobReference: string | null;
  jobId: string | null;
  assignedAt: string | null;
  documentUrl: string | null;
  mimeType: string | null;
  createdAt: string;
}

interface InvoiceLine {
  id?: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: string | number;
  unit: string | null;
  unitCostExGst: string | number;
  lineTotalExGst: string | number;
}

interface InvoiceDetail {
  invoice: QueueRow & {
    customerAccountRef: string | null;
    branch: string | null;
    originalFilename: string | null;
  };
  lines: InvoiceLine[];
  inbound: { fromAddress: string | null; subject: string | null; createdAt: string } | null;
  job: { id: string; jobNumber: string | null; title: string | null } | null;
  suggestedJobs?: JobHit[];
}

interface InboundDoc {
  id: string;
  supplierConnectionId: string | null;
  supplierName: string | null;
  connectionStatus: string | null;
  pendingSenderDomain: string | null;
  fromAddress: string | null;
  subject: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

interface JobHit { id: string; jobNumber: string | null; title: string | null; customerName?: string | null; address?: string | null; }

// ── Helpers ──────────────────────────────────────────────────────────────────

const nzd = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
};
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "short", year: "numeric" });
};
const toInputDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  // The server stores NZ-noon timestamps; render as NZ calendar date.
  return new Date(d.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
};

const COST_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "equipment", label: "Equipment / hire" },
  { value: "disposal", label: "Disposal" },
  { value: "other", label: "Other" },
];

function reasonText(reason: string | null, status: string): string {
  if (!reason) return status === "quarantined" ? "Held for review" : "Failed";
  if (reason.startsWith("duplicate:")) return "Already in the queue — this invoice arrived before";
  if (reason.startsWith("no_attachment")) {
    const link = reason.match(/link: (\S+)/)?.[1];
    return link ? `No invoice attached — the email contains a link (${link})` : "No invoice attached to the email";
  }
  if (reason.startsWith("error:")) return `Processing error — ${reason.slice(7)}`;
  const map: Record<string, string> = {
    auth_failed: "Sender failed email authentication (SPF/DKIM) — not processed",
    unconfirmed_sender: "First email from this supplier — confirm the sender to process it",
    unknown_sender: "Sent from a domain that isn't on this supplier's allow-list",
    connection_paused: "This supplier is paused",
    structured_format_unsupported: "CSV/XML invoices aren't supported yet",
    attachment_too_large: "Attachment is over 10MB",
    ai_limit_reached: "Monthly AI limit reached — upgrade or wait for the next cycle",
    document_type: "Statement or credit note — not counted as a cost",
  };
  return map[reason] || reason;
}

// ── Job search combobox ──────────────────────────────────────────────────────

function JobCombobox({ value, onChange }: { value: JobHit | null; onChange: (j: JobHit | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery<{ success: boolean; data: JobHit[] }>({
    queryKey: ["/api/jobs/search", debounced],
    queryFn: async () => {
      const r = await fetch(`/api/jobs/search?q=${encodeURIComponent(debounced)}&limit=15`, { credentials: "include" });
      if (!r.ok) throw new Error("Search failed");
      return r.json();
    },
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });
  const hits = data?.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-[320px] justify-between font-normal" data-testid="button-job-combobox">
          <span className="truncate">
            {value ? `#${value.jobNumber ?? "—"} · ${value.title || value.customerName || "Job"}` : "Search for a job…"}
          </span>
          <Search className="h-4 w-4 ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(92vw,420px)]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Job number, customer, address…" value={q} onValueChange={setQ} />
          <CommandList>
            {debounced.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Type to search your jobs</div>
            ) : isFetching && hits.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
            ) : (
              <>
                <CommandEmpty>No jobs match.</CommandEmpty>
                <CommandGroup>
                  {hits.map((j) => (
                    <CommandItem
                      key={j.id}
                      value={j.id}
                      onSelect={() => { onChange(j); setOpen(false); }}
                      data-testid={`job-option-${j.id}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">#{j.jobNumber ?? "—"} · {j.title || "Untitled job"}</span>
                        <span className="text-xs text-muted-foreground truncate">{[j.customerName, j.address].filter(Boolean).join(" · ")}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Review pane (expanded row) ───────────────────────────────────────────────

interface EditableLine { description: string; sku: string; quantity: string; unit: string; unitCostExGst: string; lineTotalExGst: string; }

function ReviewPane({ id, readOnly, onDone }: { id: string; readOnly?: boolean; onDone: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ success: boolean; data: InvoiceDetail }>({
    queryKey: ["/api/supplier-invoices", id],
    queryFn: async () => {
      const r = await fetch(`/api/supplier-invoices/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load invoice");
      return r.json();
    },
  });
  const detail = data?.data;

  const [form, setForm] = useState<{
    supplierName: string; invoiceNumber: string; invoiceDate: string; dueDate: string; poOrJobReference: string;
    customerAccountRef: string; branch: string; costCategory: string; subtotalExGst: string; gstAmount: string; totalIncGst: string;
    lines: EditableLine[];
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [job, setJob] = useState<JobHit | null>(null);

  useEffect(() => {
    if (!detail) return;
    const inv = detail.invoice;
    setForm({
      supplierName: inv.supplierName || "",
      invoiceNumber: inv.invoiceNumber || "",
      invoiceDate: toInputDate(inv.invoiceDate),
      dueDate: toInputDate(inv.dueDate),
      poOrJobReference: inv.poOrJobReference || "",
      customerAccountRef: inv.customerAccountRef || "",
      branch: inv.branch || "",
      costCategory: inv.costCategory || "materials",
      subtotalExGst: inv.subtotal ?? "",
      gstAmount: inv.gst ?? "",
      totalIncGst: inv.total ?? "",
      lines: detail.lines.map((l) => ({
        description: l.description,
        sku: l.sku || "",
        quantity: String(l.quantity),
        unit: l.unit || "",
        unitCostExGst: String(l.unitCostExGst),
        lineTotalExGst: String(l.lineTotalExGst),
      })),
    });
    setDirty(false);
    if (detail.job) setJob({ id: detail.job.id, jobNumber: detail.job.jobNumber, title: detail.job.title });
  }, [detail]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inbound-documents"] });
  };

  const buildPayload = () => {
    if (!form) return null;
    const n = (s: string) => (s.trim() === "" ? null : Number(s));
    return {
      supplierName: form.supplierName.trim() || undefined,
      invoiceNumber: form.invoiceNumber.trim() || null,
      invoiceDate: form.invoiceDate || null,
      dueDate: form.dueDate || null,
      poOrJobReference: form.poOrJobReference.trim() || null,
      customerAccountRef: form.customerAccountRef.trim() || null,
      branch: form.branch.trim() || null,
      costCategory: form.costCategory,
      subtotalExGst: n(form.subtotalExGst),
      gstAmount: n(form.gstAmount),
      totalIncGst: n(form.totalIncGst),
      lines: form.lines.map((l) => ({
        description: l.description,
        sku: l.sku.trim() || null,
        quantity: Number(l.quantity) || 0,
        unit: l.unit.trim() || null,
        unitCostExGst: Number(l.unitCostExGst) || 0,
        lineTotalExGst: Number(l.lineTotalExGst) || 0,
      })),
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", `/api/supplier-invoices/${id}`, buildPayload());
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not save.");
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices", id] });
      invalidateAll();
      setDirty(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't save corrections", description: e.message }),
  });

  const assign = useMutation({
    mutationFn: async (target: JobHit) => {
      if (dirty) {
        const r0 = await apiRequest("PATCH", `/api/supplier-invoices/${id}`, buildPayload());
        const j0 = await r0.json();
        if (!j0.success) throw new Error(j0.message || "Could not save corrections.");
      }
      const r = await apiRequest("POST", `/api/supplier-invoices/${id}/assign`, { jobId: target.id });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not assign.");
      return j;
    },
    onSuccess: (_data, target) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", target.id, "supplier-invoices"] });
      onDone();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't assign invoice", description: e.message }),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/supplier-invoices/${id}/reject`, {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not reject.");
      return j;
    },
    onSuccess: () => { invalidateAll(); onDone(); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't reject invoice", description: e.message }),
  });

  if (isLoading || !detail || !form) {
    return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const inv = detail.invoice;
  const issues = inv.validationIssues || [];
  const isPdf = (inv.mimeType || "").includes("pdf") || (inv.documentUrl || "").toLowerCase().endsWith(".pdf");
  const upd = (patch: Partial<NonNullable<typeof form>>) => { setForm((f) => (f ? { ...f, ...patch } : f)); setDirty(true); };
  const updLine = (i: number, patch: Partial<EditableLine>) => {
    setForm((f) => {
      if (!f) return f;
      const lines = [...f.lines];
      lines[i] = { ...lines[i], ...patch };
      // Keep line total in step when qty/unit cost change (the user can still override it).
      if (patch.quantity !== undefined || patch.unitCostExGst !== undefined) {
        const q = Number(lines[i].quantity), u = Number(lines[i].unitCostExGst);
        if (Number.isFinite(q) && Number.isFinite(u)) lines[i].lineTotalExGst = (Math.round(q * u * 100) / 100).toFixed(2);
      }
      return { ...f, lines };
    });
    setDirty(true);
  };
  const linesSum = form.lines.reduce((s, l) => s + (Number(l.lineTotalExGst) || 0), 0);

  const field = (label: string, key: keyof NonNullable<typeof form>, type: string = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) => upd({ [key]: e.target.value } as Partial<NonNullable<typeof form>>)}
        className="h-8"
        disabled={readOnly}
        {...extra}
      />
    </div>
  );

  return (
    <div className="border-t bg-muted/20 p-4 space-y-4" data-testid={`review-pane-${id}`}>
      {issues.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
          <div className="font-medium flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4" /> Check these before assigning</div>
          <ul className="list-disc pl-5 space-y-0.5">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
        </div>
      )}
      {detail.inbound && (
        <div className="text-xs text-muted-foreground">
          Emailed {fmtDate(detail.inbound.createdAt)} from {detail.inbound.fromAddress || "unknown"}{detail.inbound.subject ? ` — "${detail.inbound.subject}"` : ""}
          {inv.originalFilename ? ` · ${inv.originalFilename}` : ""}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: extracted data, inline-editable */}
        <div className="space-y-3 min-w-0">
          <div className="grid grid-cols-2 gap-2">
            {field("Supplier", "supplierName")}
            {field("Invoice number", "invoiceNumber")}
            {field("Invoice date", "invoiceDate", "date")}
            {field("Due date", "dueDate", "date")}
            {field("PO / job reference", "poOrJobReference")}
            {field("Account ref", "customerAccountRef")}
            {field("Branch", "branch")}
            <div>
              <Label className="text-xs">Cost category</Label>
              <Select value={form.costCategory} onValueChange={(v) => upd({ costCategory: v })} disabled={readOnly}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{COST_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left p-2 font-medium w-[40%]">Description</th>
                  <th className="text-left p-2 font-medium">SKU</th>
                  <th className="text-right p-2 font-medium">Qty</th>
                  <th className="text-right p-2 font-medium">Unit ex GST</th>
                  <th className="text-right p-2 font-medium">Total ex GST</th>
                  {!readOnly && <th className="p-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1"><Input value={l.description} onChange={(e) => updLine(i, { description: e.target.value })} className="h-8" disabled={readOnly} /></td>
                    <td className="p-1"><Input value={l.sku} onChange={(e) => updLine(i, { sku: e.target.value })} className="h-8 w-24" disabled={readOnly} /></td>
                    <td className="p-1"><Input value={l.quantity} onChange={(e) => updLine(i, { quantity: e.target.value })} className="h-8 w-20 text-right" inputMode="decimal" disabled={readOnly} /></td>
                    <td className="p-1"><Input value={l.unitCostExGst} onChange={(e) => updLine(i, { unitCostExGst: e.target.value })} className="h-8 w-28 text-right" inputMode="decimal" disabled={readOnly} /></td>
                    <td className="p-1"><Input value={l.lineTotalExGst} onChange={(e) => updLine(i, { lineTotalExGst: e.target.value })} className="h-8 w-28 text-right" inputMode="decimal" disabled={readOnly} /></td>
                    {!readOnly && (
                      <td className="p-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove line"
                          onClick={() => { setForm((f) => f ? { ...f, lines: f.lines.filter((_, k) => k !== i) } : f); setDirty(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {form.lines.length === 0 && (
                  <tr><td colSpan={6} className="p-3 text-center text-muted-foreground text-xs">No line items were read from the document.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <Button type="button" variant="ghost" size="sm"
              onClick={() => { setForm((f) => f ? { ...f, lines: [...f.lines, { description: "", sku: "", quantity: "1", unit: "", unitCostExGst: "0", lineTotalExGst: "0" }] } : f); setDirty(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add line
            </Button>
          )}

          <div className="grid grid-cols-3 gap-2">
            {field(`Subtotal ex GST (lines: ${nzd(linesSum)})`, "subtotalExGst", "text", { inputMode: "decimal" })}
            {field("GST", "gstAmount", "text", { inputMode: "decimal" })}
            {field("Total inc GST", "totalIncGst", "text", { inputMode: "decimal" })}
          </div>

          {!readOnly && dirty && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save corrections
              </Button>
              <span className="text-xs text-muted-foreground">Unsaved edits are saved automatically when you assign.</span>
            </div>
          )}
        </div>

        {/* Right: the source document */}
        <div className="min-w-0">
          {inv.documentUrl ? (
            <div className="rounded-md border overflow-hidden bg-background">
              {isPdf ? (
                <iframe title="Invoice PDF" src={inv.documentUrl} className="w-full h-[520px]" />
              ) : (
                <img src={inv.documentUrl} alt="Invoice" className="w-full h-auto max-h-[520px] object-contain" />
              )}
              <div className="p-2 text-right">
                <a href={inv.documentUrl} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 underline underline-offset-2">
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
              The original file wasn't stored (storage was unavailable when it arrived). The extracted data is still here.
            </div>
          )}
        </div>
      </div>

      {/* Job suggestion: the invoice's PO/job reference exactly matched a job number. */}
      {!readOnly && (detail.suggestedJobs?.length ?? 0) > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2" data-testid="job-suggestions">
          <div className="text-sm font-medium">The reference "{inv.poOrJobReference}" matches {detail.suggestedJobs!.length === 1 ? "a job" : "these jobs"}:</div>
          {detail.suggestedJobs!.map((sj) => (
            <div key={sj.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium">#{sj.jobNumber ?? "—"} · {sj.title || "Untitled job"}</span>
                {(sj.customerName || sj.address) && <span className="text-muted-foreground"> — {[sj.customerName, sj.address].filter(Boolean).join(" · ")}</span>}
              </span>
              <Button size="sm" onClick={() => assign.mutate(sj)} disabled={assign.isPending} data-testid={`button-assign-suggested-${sj.id}`}>
                {assign.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Assign to this job
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Primary action: pick a job, assign. Two interactions. */}
      {!readOnly ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t">
          <JobCombobox value={job} onChange={setJob} />
          <Button onClick={() => job && assign.mutate(job)} disabled={!job || assign.isPending} data-testid="button-assign-to-job">
            {assign.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Assign to job
          </Button>
          <div className="sm:ml-auto">
            <Button variant="ghost" size="sm" onClick={() => { if (window.confirm("Reject this invoice? It won't be counted as a cost.")) reject.mutate(); }} disabled={reject.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ) : detail.job ? (
        <div className="pt-2 border-t text-sm flex items-center gap-2 flex-wrap">
          <span>Assigned to <span className="font-medium">#{detail.job.jobNumber ?? "—"} · {detail.job.title || "Job"}</span>{inv.assignedAt ? ` on ${fmtDate(inv.assignedAt)}` : ""}</span>
          <Button asChild size="sm" variant="outline"><Link href={`/dispatch?job=${detail.job.id}&tab=billing`}>Open job</Link></Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Queue list ───────────────────────────────────────────────────────────────

function QueueList({ status, emptyText, readOnly }: { status: string; emptyText: string; readOnly?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery<{ success: boolean; data: QueueRow[]; nextCursor: string | null }>({
    queryKey: ["/api/supplier-invoices", { status }],
    queryFn: async () => {
      const r = await fetch(`/api/supplier-invoices?status=${encodeURIComponent(status)}&limit=100`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    refetchInterval: 60_000,
  });
  const rows = data?.data ?? [];

  if (isLoading) return <div className="text-sm text-muted-foreground flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">{emptyText}</div>;
  }
  return (
    <div className="rounded-lg border divide-y bg-card">
      {rows.map((r) => {
        const isOpen = expanded === r.id;
        const warn = r.arithmeticValid === false;
        return (
          <div key={r.id} data-testid={`queue-row-${r.id}`}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full text-left px-3 py-3 flex items-center gap-3"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-[1.4fr_0.8fr_1fr_0.8fr] gap-x-3 gap-y-0.5 items-center">
                <div className="font-medium truncate flex items-center gap-2">
                  {r.supplierName}
                  {warn && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-label="Arithmetic didn't check out" />}
                  {r.documentType !== "invoice" && <Badge variant="outline" className="text-[10px]">{r.documentType.replace("_", " ")}</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">{fmtDate(r.invoiceDate)}</div>
                <div className="text-sm text-muted-foreground truncate">{r.invoiceNumber ? `#${r.invoiceNumber}` : "No number"}{r.poOrJobReference ? ` · ref ${r.poOrJobReference}` : ""}</div>
                <div className="text-sm font-medium sm:text-right">{nzd(r.total)} <span className="text-xs text-muted-foreground font-normal">inc GST</span></div>
              </div>
            </button>
            {isOpen && <ReviewPane id={r.id} readOnly={readOnly} onDone={() => setExpanded(null)} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Failed / quarantined tab ─────────────────────────────────────────────────

function ProblemsList() {
  const { toast } = useToast();
  const docs = useQuery<{ success: boolean; data: InboundDoc[] }>({
    queryKey: ["/api/inbound-documents", "failed,quarantined"],
    queryFn: async () => {
      const r = await fetch(`/api/inbound-documents?status=failed,quarantined`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });
  const confirmSender = useMutation({
    mutationFn: async (connectionId: string) => {
      const r = await apiRequest("POST", `/api/supplier-connections/${connectionId}/confirm-sender`, {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not confirm sender.");
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-connections"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't confirm sender", description: e.message }),
  });

  const rows = docs.data?.data ?? [];
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium mb-2">Emails that couldn't be processed</h2>
        {docs.isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">Nothing here — every email so far was processed.</div>
        ) : (
          <div className="rounded-lg border divide-y bg-card">
            {rows.map((d) => {
              const needsConfirm = d.failureReason === "unconfirmed_sender" && d.supplierConnectionId && d.connectionStatus === "pending_first_email";
              return (
                <div key={d.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2" data-testid={`inbound-doc-${d.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.supplierName || "Forwarded to catch-all"}{d.subject ? ` — ${d.subject}` : ""}</div>
                    <div className="text-xs text-muted-foreground truncate">{fmtDate(d.createdAt)} · from {d.fromAddress || "unknown"}</div>
                    <div className="text-xs mt-1 flex items-center gap-1">
                      <Badge variant={d.status === "quarantined" ? "secondary" : "destructive"} className="text-[10px]">{d.status === "quarantined" ? "Held" : "Failed"}</Badge>
                      <span>{reasonText(d.failureReason, d.status)}</span>
                    </div>
                  </div>
                  {needsConfirm && (
                    <Button size="sm" onClick={() => confirmSender.mutate(d.supplierConnectionId!)} disabled={confirmSender.isPending} data-testid={`button-confirm-sender-doc-${d.id}`}>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Confirm this sender
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className="text-sm font-medium mb-2">Statements, credit notes and rejected invoices</h2>
        <QueueList status="quarantined,rejected" readOnly emptyText="No held or rejected documents." />
      </section>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierInvoices() {
  const counts = useQuery<{ success: boolean; data: QueueRow[] }>({
    queryKey: ["/api/supplier-invoices", { status: "needs_review" }],
    queryFn: async () => {
      const r = await fetch(`/api/supplier-invoices?status=needs_review&limit=100`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });
  const pending = counts.data?.data?.length ?? 0;
  const title = useMemo(() => (pending > 0 ? `Supplier Invoices (${pending})` : "Supplier Invoices"), [pending]);

  return (
    <div className="pt-20 px-4 md:px-8 max-w-6xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{title}</h1>
          <p className="text-muted-foreground">Invoices your suppliers emailed in. Open one, pick the job, done.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/suppliers"><SettingsIcon className="h-4 w-4 mr-1" /> Suppliers</Link>
        </Button>
      </div>

      <Tabs defaultValue="review">
        <TabsList className="mb-4">
          <TabsTrigger value="review" data-testid="tab-needs-review">Needs review{pending > 0 ? ` (${pending})` : ""}</TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned">Assigned</TabsTrigger>
          <TabsTrigger value="problems" data-testid="tab-problems">Failed &amp; held</TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          <QueueList status="needs_review" emptyText="No invoices waiting. New ones land here automatically once your suppliers start sending them." />
        </TabsContent>
        <TabsContent value="assigned">
          <QueueList status="assigned" readOnly emptyText="Nothing assigned yet." />
        </TabsContent>
        <TabsContent value="problems">
          <ProblemsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
