import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PreviewLine {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  lineTotal: number;
}

interface Preview {
  currency: "NZD";
  contact: { name: string; email: string | null; phone: string | null };
  invoiceNumber: string;
  reference: string | null;
  dueDate: string | null;
  statusInXero: "AUTHORISED";
  accountCode: string;
  taxType: string;
  gstRate: number;
  lineItems: PreviewLine[];
  subtotal: number;
  gst: number;
  total: number;
  blockingReason: string | null;
}

interface XeroRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  jobId: string | null;
  customerName: string | null;
  status: string;
  waiting: boolean;
  snoozeUntil: string | null;
  lastError: string | null;
  preview: Preview;
}

interface ListResponse {
  success: boolean;
  data: { waiting: number; invoices: XeroRow[] };
}

function nzd(value: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}

export function InvoiceXeroPanel() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const search = useSearch();
  const selectedFromUrl = new URLSearchParams(search).get("id");
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState("3");

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/invoice-xero-follow-ups"],
  });

  const rows = (data?.data.invoices ?? []).filter((row) => row.waiting || row.status === "snoozed");
  const selected = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.waiting) ?? rows[0] ?? null;

  useEffect(() => {
    if (selectedFromUrl) setSelectedId(selectedFromUrl);
  }, [selectedFromUrl]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/invoice-xero-follow-ups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quote-follow-ups/count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const res = await apiRequest("POST", `/api/invoice-xero-follow-ups/${selected.id}/sync`, { confirm: true });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
    },
    onError: (err: Error) => {
      invalidate();
      toast({ title: "Couldn't sync to Xero", description: err.message, variant: "destructive" });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const res = await apiRequest("POST", `/api/invoice-xero-follow-ups/${selected.id}/snooze`, {
        days: Number(snoozeDays),
      });
      return res.json();
    },
    onSuccess: () => {
      setSnoozeOpen(false);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't snooze", description: err.message, variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const res = await apiRequest("POST", `/api/invoice-xero-follow-ups/${selected.id}/dismiss`, {});
      return res.json();
    },
    onSuccess: () => {
      setDismissOpen(false);
      setSelectedId(null);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't dismiss", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading invoices…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="inflow-chrome px-5 py-8 text-sm text-muted-foreground" data-testid="xero-followups-empty">
        No invoices waiting. An invoice shows up here after it has been emailed or texted to the customer and it is not in Xero yet.
      </div>
    );
  }

  const preview = selected?.preview;
  const blocked = !!preview?.blockingReason;
  const gstLabel = preview && preview.gstRate > 0 ? `GST (${Math.round(preview.gstRate * 100)}%)` : "GST";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="inflow-chrome overflow-hidden divide-y divide-border" data-testid="xero-followups-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-3 ${selected?.id === row.id ? "bg-muted" : ""}`}
                onClick={() => setSelectedId(row.id)}
                data-testid={`xero-followup-${row.id}`}
              >
                <p className="font-medium truncate">{row.customerName || "Customer"}</p>
                <p className="text-sm text-muted-foreground">
                  Invoice {row.invoiceNumber || row.invoiceId}
                  {row.waiting ? "" : " · snoozed"}
                  {row.lastError ? " · needs a look" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {selected && preview && (
          <div className="inflow-chrome p-4 space-y-4" data-testid="xero-followup-preview">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Invoice {selected.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  This is what Approve &amp; Sync will create in Xero. Nothing is sent until you press it.
                </p>
              </div>
              {selected.jobId && (
                <Link href={`/dispatch?job=${selected.jobId}`}>
                  <Button variant="outline" size="sm" data-testid="link-xero-job">Open job</Button>
                </Link>
              )}
            </div>

            {selected.lastError && (
              <p className="text-sm text-destructive" data-testid="text-xero-error">{selected.lastError}</p>
            )}
            {preview.blockingReason && (
              <p className="text-sm text-destructive" data-testid="text-xero-blocked">{preview.blockingReason}</p>
            )}

            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Contact: </span>{preview.contact.name || "No name"}</p>
              <p><span className="text-muted-foreground">Email: </span>{preview.contact.email || "None"}</p>
              <p><span className="text-muted-foreground">Phone: </span>{preview.contact.phone || "None"}</p>
              <p><span className="text-muted-foreground">Invoice number: </span>{preview.invoiceNumber}</p>
              <p><span className="text-muted-foreground">Reference: </span>{preview.reference || "None"}</p>
              <p><span className="text-muted-foreground">Due: </span>{preview.dueDate || "Not set"}</p>
              <p><span className="text-muted-foreground">Xero status: </span>{preview.statusInXero}</p>
              <p><span className="text-muted-foreground">Account code: </span>{preview.accountCode}</p>
              <p><span className="text-muted-foreground">Tax: </span>{preview.taxType}</p>
            </div>

            <div className="divide-y divide-border border border-border rounded-md" data-testid="xero-line-items">
              {preview.lineItems.map((line, index) => (
                <div key={`${line.description}-${index}`} className="px-3 py-2 text-sm flex justify-between gap-3">
                  <span>
                    {line.description}
                    <span className="text-muted-foreground"> · {line.quantity} × {nzd(line.unitAmount)} · {line.accountCode} · {line.taxType}</span>
                  </span>
                  <span className="shrink-0">{nzd(line.lineTotal)}</span>
                </div>
              ))}
              <div className="px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{nzd(preview.subtotal)}</span>
              </div>
              <div className="px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">{gstLabel}</span>
                <span>{nzd(preview.gst)}</span>
              </div>
              <div className="px-3 py-2 text-sm flex justify-between font-medium">
                <span>Total ({preview.currency})</span>
                <span>{nzd(preview.total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={!isAdmin || blocked || syncMutation.isPending}
                data-testid="button-approve-sync"
              >
                {syncMutation.isPending ? "Syncing…" : "Approve & Sync"}
              </Button>
              <Button variant="outline" onClick={() => setSnoozeOpen(true)} data-testid="button-xero-snooze">
                Snooze
              </Button>
              <Button variant="outline" onClick={() => setDismissOpen(true)} data-testid="button-xero-dismiss">
                Dismiss
              </Button>
            </div>
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">An admin needs to approve the sync.</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze this invoice</DialogTitle>
            <DialogDescription>It will come back to the queue after the delay. Nothing is sent to Xero.</DialogDescription>
          </DialogHeader>
          <Label className="sr-only" htmlFor="xero-snooze-days">Snooze for</Label>
          <Select value={snoozeDays} onValueChange={setSnoozeDays}>
            <SelectTrigger id="xero-snooze-days" data-testid="select-xero-snooze-days">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeOpen(false)}>Cancel</Button>
            <Button onClick={() => snoozeMutation.mutate()} disabled={snoozeMutation.isPending} data-testid="button-xero-snooze-confirm">
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this from the queue?</DialogTitle>
            <DialogDescription>
              Dismiss hides invoice {selected?.invoiceNumber}. The invoice itself stays as it is, and nothing is sent to Xero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending} data-testid="button-xero-dismiss-confirm">
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
