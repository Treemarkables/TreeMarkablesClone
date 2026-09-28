import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { InvoiceXeroPanel } from "@/components/InvoiceXeroPanel";
import { JobsNotBilledPanel } from "@/components/JobsNotBilledPanel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

interface FollowUp {
  id: string;
  quoteId: string;
  quoteNumber: string;
  jobId: string | null;
  customerName: string | null;
  kind: string;
  nudgeStep: number;
  channel: string;
  status: string;
  waiting: boolean;
  subject: string | null;
  message: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  requoteId: string | null;
  requoteNumber: string | null;
  snoozeUntil: string | null;
  daysQuiet: number | null;
}

interface ListResponse {
  success: boolean;
  data: {
    waiting: number;
    followUps: FollowUp[];
  };
}

function kindLabel(kind: string): string {
  return kind === "requote" ? "Re-quote" : "Check in";
}

export default function QuoteFollowUps() {
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab");
  const tab = tabParam === "xero" || tabParam === "billed" ? tabParam : "quotes";
  const selectedFromUrl = tab === "quotes" ? params.get("id") : null;
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState("3");

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/quote-follow-ups"],
  });

  const rows = (data?.data.followUps ?? []).filter((row) => row.waiting || row.status === "snoozed");
  const selected = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.waiting) ?? rows[0] ?? null;

  useEffect(() => {
    if (selectedFromUrl) setSelectedId(selectedFromUrl);
  }, [selectedFromUrl]);

  useEffect(() => {
    if (!selected) return;
    setMessage(selected.message);
    setSubject(selected.subject ?? "");
    setChannel(selected.channel === "email" ? "email" : "sms");
  }, [selected?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/quote-follow-ups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/quote-follow-ups/count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const res = await apiRequest("PATCH", `/api/quote-follow-ups/${selected.id}`, {
        message,
        subject,
        channel,
      });
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => {
      toast({ title: "Couldn't save the draft", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await apiRequest("PATCH", `/api/quote-follow-ups/${selected.id}`, { message, subject, channel });
      const res = await apiRequest("POST", `/api/quote-follow-ups/${selected.id}/approve`, { confirm: true });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't send", description: err.message, variant: "destructive" });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const res = await apiRequest("POST", `/api/quote-follow-ups/${selected.id}/snooze`, {
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
      const res = await apiRequest("POST", `/api/quote-follow-ups/${selected.id}/dismiss`, {});
      return res.json();
    },
    onSuccess: () => {
      setDismissOpen(false);
      setSelectedId(null);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't mark the quote as lost", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-4 md:p-6 gap-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Follow-ups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tab === "xero"
            ? "Invoices sent to the customer that are not in Xero. Nothing syncs until you press Approve & Sync."
            : tab === "billed"
              ? "Completed jobs that still need an invoice or a send. Nothing is created or sent until you approve."
              : "Drafts only. Nothing goes to the customer until you press Approve & Send."}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === "quotes" ? "default" : "outline"}
          onClick={() => setLocation("/quote-follow-ups")}
          data-testid="tab-quote-followups"
        >
          Quotes
        </Button>
        <Button
          variant={tab === "billed" ? "default" : "outline"}
          onClick={() => setLocation("/quote-follow-ups?tab=billed")}
          data-testid="tab-not-billed"
        >
          Not billed
        </Button>
        <Button
          variant={tab === "xero" ? "default" : "outline"}
          onClick={() => setLocation("/quote-follow-ups?tab=xero")}
          data-testid="tab-not-in-xero"
        >
          Not in Xero
        </Button>
      </div>

      {tab === "xero" ? (
        <InvoiceXeroPanel />
      ) : tab === "billed" ? (
        <JobsNotBilledPanel />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading follow-ups…</p>
      ) : rows.length === 0 ? (
        <div className="inflow-chrome px-5 py-8 text-sm text-muted-foreground" data-testid="quote-followups-empty">
          No follow-ups waiting. Sent quotes with no reply show up here after a few days, and again if they pass their valid date.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="inflow-chrome overflow-hidden divide-y divide-border" data-testid="quote-followups-list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-3 ${selected?.id === row.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                  data-testid={`quote-followup-${row.id}`}
                >
                  <p className="font-medium truncate">{row.customerName || "Customer"}</p>
                  <p className="text-sm text-muted-foreground">
                    Quote {row.quoteNumber || row.quoteId} · {kindLabel(row.kind)}
                    {row.waiting ? "" : " · snoozed"}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="inflow-chrome p-4 space-y-4" data-testid="quote-followup-editor">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{kindLabel(selected.kind)}</p>
                  <p className="text-sm text-muted-foreground">
                    Quote {selected.quoteNumber}
                    {selected.daysQuiet != null ? ` · quiet for ${selected.daysQuiet} days` : ""}
                    {selected.kind === "requote" && selected.requoteNumber
                      ? ` · new draft ${selected.requoteNumber}`
                      : ""}
                  </p>
                </div>
                {selected.jobId && (
                  <Link href={`/dispatch?job=${selected.jobId}`}>
                    <Button variant="outline" size="sm" data-testid="link-followup-job">Open job</Button>
                  </Link>
                )}
              </div>

              <div className="space-y-2 max-w-[200px]">
                <Label htmlFor="followup-channel">Send via</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as "sms" | "email")}>
                  <SelectTrigger id="followup-channel" data-testid="select-followup-channel">
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
                  <Label htmlFor="followup-subject">Subject</Label>
                  <Input
                    id="followup-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    data-testid="input-followup-subject"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="followup-message">Message</Label>
                <Textarea
                  id="followup-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  data-testid="input-followup-message"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-send"
                >
                  {approveMutation.isPending ? "Sending…" : "Approve & Send"}
                </Button>
                <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-draft">
                  Save draft
                </Button>
                <Button variant="outline" onClick={() => setSnoozeOpen(true)} data-testid="button-snooze">
                  Snooze
                </Button>
                <Button variant="outline" onClick={() => setDismissOpen(true)} data-testid="button-dismiss">
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze this follow-up</DialogTitle>
            <DialogDescription>It will come back to the queue after the delay. Nothing is sent.</DialogDescription>
          </DialogHeader>
          <Select value={snoozeDays} onValueChange={setSnoozeDays}>
            <SelectTrigger data-testid="select-snooze-days">
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
            <Button onClick={() => snoozeMutation.mutate()} disabled={snoozeMutation.isPending} data-testid="button-snooze-confirm">
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this quote as lost?</DialogTitle>
            <DialogDescription>
              Dismiss stops follow-ups and marks quote {selected?.quoteNumber} as lost. The customer is not contacted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending} data-testid="button-dismiss-confirm">
              Mark as lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
