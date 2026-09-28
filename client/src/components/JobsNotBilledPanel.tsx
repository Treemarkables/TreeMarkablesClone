import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  rate: number;
  amount: number;
}

interface Preview {
  source: "quote" | "job";
  lines: PreviewLine[];
  subtotal: number;
  gst: number;
  total: number;
  currency: "NZD";
  blockingReason: string | null;
}

interface BillingRow {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string | null;
  step: "create_invoice" | "send_invoice";
  status: string;
  waiting: boolean;
  channel: string;
  subject: string | null;
  message: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  invoiceNumber: string | null;
  lastError: string | null;
  preview: Preview | null;
}

interface ListResponse {
  success: boolean;
  data: { waiting: number; jobs: BillingRow[] };
}

function nzd(value: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}

function stepLabel(step: string): string {
  return step === "send_invoice" ? "Send to client" : "Create invoice";
}

export function JobsNotBilledPanel() {
  const { toast } = useToast();
  const search = useSearch();
  const selectedFromUrl = new URLSearchParams(search).get("id");
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState("3");

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/job-billing-follow-ups"],
  });

  const rows = (data?.data.jobs ?? []).filter((row) => row.waiting || row.status === "snoozed");
  const selected = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.waiting) ?? rows[0] ?? null;

  useEffect(() => {
    if (selectedFromUrl) setSelectedId(selectedFromUrl);
  }, [selectedFromUrl]);

  useEffect(() => {
    if (!selected || selected.step !== "send_invoice") return;
    setMessage(selected.message);
    setSubject(selected.subject ?? "");
    setChannel(selected.channel === "email" ? "email" : "sms");
  }, [selected?.id, selected?.step]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/job-billing-follow-ups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quote-follow-ups/count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoice-xero-follow-ups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (selected.step === "send_invoice") {
        await apiRequest("PATCH", `/api/job-billing-follow-ups/${selected.id}`, { message, subject, channel });
      }
      const res = await apiRequest("POST", `/api/job-billing-follow-ups/${selected.id}/approve`, { confirm: true });
      return res.json() as Promise<{ message?: string }>;
    },
    onSuccess: () => {
      invalidate();
      if (selected?.step === "send_invoice") setSelectedId(null);
    },
    onError: (err: Error) => {
      invalidate();
      toast({
        title: selected?.step === "send_invoice" ? "Couldn't send the invoice" : "Couldn't create the invoice",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await apiRequest("POST", `/api/job-billing-follow-ups/${selected.id}/snooze`, { days: Number(snoozeDays) });
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
      await apiRequest("POST", `/api/job-billing-follow-ups/${selected.id}/dismiss`, {});
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading jobs…</p>;

  if (rows.length === 0) {
    return (
      <div className="inflow-chrome px-5 py-8 text-sm text-muted-foreground" data-testid="not-billed-empty">
        No completed jobs waiting. A job shows up here when it is completed and still needs an invoice, or the invoice has not been sent. Invoices that were sent but are not in Xero stay on Not in Xero.
      </div>
    );
  }

  const preview = selected?.preview;
  const blocked = selected?.step === "create_invoice" && !!preview?.blockingReason;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="inflow-chrome overflow-hidden divide-y divide-border" data-testid="not-billed-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-3 ${selected?.id === row.id ? "bg-muted" : ""}`}
                onClick={() => setSelectedId(row.id)}
                data-testid={`not-billed-${row.id}`}
              >
                <p className="font-medium truncate">{row.customerName || "Customer"}</p>
                <p className="text-sm text-muted-foreground">
                  Job {row.jobNumber} · {stepLabel(row.step)}
                  {row.waiting ? "" : " · snoozed"}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="inflow-chrome p-4 space-y-4" data-testid="not-billed-detail">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Job {selected.jobNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.step === "create_invoice"
                    ? "This draft invoice is created only when you press Approve & create. It is not sent."
                    : "Nothing goes to the customer until you press Approve & send. Xero is a separate step."}
                </p>
              </div>
              <Link href={`/dispatch?job=${selected.jobId}`}>
                <Button variant="outline" size="sm" data-testid="link-not-billed-job">Open job</Button>
              </Link>
            </div>

            {selected.lastError && (
              <p className="text-sm text-destructive" data-testid="text-not-billed-error">{selected.lastError}</p>
            )}

            {selected.step === "create_invoice" && preview && (
              <>
                {preview.blockingReason && (
                  <p className="text-sm text-destructive" data-testid="text-not-billed-blocked">{preview.blockingReason}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {preview.source === "quote" ? "From the accepted quote." : "From the job lines."} Prices are exc. GST.
                </p>
                <div className="divide-y divide-border border border-border rounded-md" data-testid="not-billed-lines">
                  {preview.lines.map((line, index) => (
                    <div key={`${line.description}-${index}`} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span>{line.description} <span className="text-muted-foreground">· {line.quantity} × {nzd(line.rate)}</span></span>
                      <span className="shrink-0">{nzd(line.amount)}</span>
                    </div>
                  ))}
                  <div className="px-3 py-2 text-sm flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{nzd(preview.subtotal)}</span></div>
                  <div className="px-3 py-2 text-sm flex justify-between"><span className="text-muted-foreground">GST (15%)</span><span>{nzd(preview.gst)}</span></div>
                  <div className="px-3 py-2 text-sm flex justify-between font-medium"><span>Total ({preview.currency})</span><span>{nzd(preview.total)}</span></div>
                </div>
              </>
            )}

            {selected.step === "send_invoice" && (
              <>
                <p className="text-sm text-muted-foreground">Invoice {selected.invoiceNumber || "draft"}</p>
                <div className="space-y-2 max-w-[200px]">
                  <Label htmlFor="not-billed-channel">Send via</Label>
                  <Select value={channel} onValueChange={(value) => setChannel(value === "email" ? "email" : "sms")}>
                    <SelectTrigger id="not-billed-channel" data-testid="select-not-billed-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS{selected.recipientPhone ? "" : " (no mobile)"}</SelectItem>
                      <SelectItem value="email">Email{selected.recipientEmail ? "" : " (no email)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {channel === "email" && (
                  <div className="space-y-2">
                    <Label htmlFor="not-billed-subject">Subject</Label>
                    <Input id="not-billed-subject" value={subject} onChange={(event) => setSubject(event.target.value)} data-testid="input-not-billed-subject" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="not-billed-message">Message</Label>
                  <Textarea id="not-billed-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={6} data-testid="input-not-billed-message" />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => approveMutation.mutate()} disabled={blocked || approveMutation.isPending} data-testid="button-approve-billing">
                {approveMutation.isPending
                  ? "Working…"
                  : (selected.step === "send_invoice" ? "Approve & send" : "Approve & create")}
              </Button>
              <Button variant="outline" onClick={() => setSnoozeOpen(true)} data-testid="button-not-billed-snooze">Snooze</Button>
              <Button variant="outline" onClick={() => setDismissOpen(true)} data-testid="button-not-billed-dismiss">Dismiss</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze this job</DialogTitle>
            <DialogDescription>It will come back to the queue after the delay. Nothing is created or sent.</DialogDescription>
          </DialogHeader>
          <Select value={snoozeDays} onValueChange={setSnoozeDays}>
            <SelectTrigger data-testid="select-not-billed-snooze">
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
            <Button onClick={() => snoozeMutation.mutate()} disabled={snoozeMutation.isPending}>Snooze</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this from the queue?</DialogTitle>
            <DialogDescription>
              Dismiss hides job {selected?.jobNumber}. The job and any invoice stay as they are. Nothing is sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending} data-testid="button-not-billed-dismiss-confirm">Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
