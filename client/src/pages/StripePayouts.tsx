import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PayoutRow {
  id: string;
  stripePayoutId: string;
  amount: string;
  currency: string;
  status: string;
  arrivalDate: string | null;
  feeTotal: string;
  chargeTotal: string;
  refundTotal: string;
  description: string | null;
  xeroPostedAt: string | null;
  xeroFeeMessage: string | null;
  xeroSummary: unknown;
}

interface PayoutLine {
  id: string;
  kind: string;
  amount: string;
  fee: string;
  net: string;
  description: string | null;
  matchStatus: string;
  jobId: string | null;
  jobNumber: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  xeroMessage: string | null;
}

interface AccountContext {
  stripeMode: "connect" | "platform" | "none";
  stripeModeMessage: string | null;
  xeroConnected: boolean;
  clearingAccountCode: string;
  feesAccountCode: string | null;
}

interface ListResponse extends AccountContext {
  success: boolean;
  payouts: PayoutRow[];
}

interface DetailResponse extends AccountContext {
  success: boolean;
  payout: PayoutRow;
  lines: PayoutLine[];
}

interface PlanLine {
  lineId: string;
  amount: number;
  jobNumber: string | null;
  invoiceNumber: string | null;
  message?: string;
  alreadyPosted?: boolean;
}

interface PreviewResponse {
  success: boolean;
  accountProblem: string | null;
  clearingIsBank: boolean;
  clearingAccountCode: string;
  feesAccountCode: string | null;
  needsFeesAccount: boolean;
  plan: {
    currencyBlocked: string | null;
    payments: PlanLine[];
    refunds: PlanLine[];
    fee: { amount: number; alreadyPosted: boolean } | null;
    skips: Array<PlanLine & { message: string }>;
    clearing: { gapMessage: string | null; netsToPayout: boolean; feeDollars: number };
  };
}

interface PostResponse {
  success: boolean;
  message?: string;
  results: Array<{ status: string; message: string; kind: string; amount: number; jobNumber: string | null; invoiceNumber: string | null }>;
  clearing: { gapMessage: string | null };
}

function nzd(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(0);
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(n);
}

function nzDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "failed" || status === "canceled") return "destructive";
  if (status === "pending" || status === "in_transit") return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default function StripePayouts() {
  const { isAdmin, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, detailParams] = useRoute("/settings/payouts/:id");
  const payoutId = detailParams?.id;

  useEffect(() => {
    if (!isLoading && !isAdmin) setLocation("/settings");
  }, [isAdmin, isLoading, setLocation]);

  if (isLoading || !isAdmin) return null;
  if (payoutId) return <PayoutDetail payoutId={payoutId} />;
  return <PayoutList />;
}

function PayoutList() {
  const { toast } = useToast();
  const list = useQuery<ListResponse>({ queryKey: ["/api/stripe-payouts"] });
  const [clearing, setClearing] = useState("");
  const [fees, setFees] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!list.data || seeded) return;
    setClearing(list.data.clearingAccountCode || "640");
    setFees(list.data.feesAccountCode || "");
    setSeeded(true);
  }, [list.data, seeded]);

  const sync = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe-payouts/sync", { limit: 15 });
      return res.json() as Promise<{ payouts?: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not pull payouts", description: error.message, variant: "destructive" });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/stripe-payouts/settings", {
        clearingAccountCode: clearing.trim(),
        feesAccountCode: fees.trim() ? fees.trim() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save account codes", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="pt-20 px-4 md:px-8 max-w-5xl mx-auto pb-16 space-y-6">
      <div>
        <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground mb-3">
          <ChevronLeft className="w-4 h-4 mr-1" /> Settings
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stripe payouts</h1>
            <p className="text-muted-foreground">Charges in each payout, matched to the job they paid.</p>
          </div>
          <Button data-testid="button-sync-payouts" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Pull from Stripe
          </Button>
        </div>
      </div>

      {list.data?.stripeModeMessage && (
        <p className="text-sm border border-border rounded-lg p-3 bg-muted/40">{list.data.stripeModeMessage}</p>
      )}
      {list.isError && (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      )}

      <Card className="bg-card border border-border rounded-lg">
        <CardHeader>
          <CardTitle>Xero accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invoice payments post from the clearing account (640 Stripe Clearing unless you use another code). In Xero, turn on Enable payments to this account unless it is a bank account. Code the payout deposit to the same account. Fees come out with no GST. If the clearing account is not a bank account, fees post as a manual journal. The fees expense account is required before a payout with fees can be posted.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clearing-account">Clearing account</Label>
              <Input id="clearing-account" value={clearing} onChange={(e) => setClearing(e.target.value)} data-testid="input-clearing-account" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees-account">Fees expense account</Label>
              <Input id="fees-account" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="Account code" data-testid="input-fees-account" />
            </div>
          </div>
          <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-payout-accounts">
            Save account codes
          </Button>
        </CardContent>
      </Card>

      {list.isLoading && <p className="text-sm text-muted-foreground">Loading payouts…</p>}
      {list.data && list.data.payouts.length === 0 && (
        <p className="text-sm text-muted-foreground">No payouts yet. Pull them from Stripe.</p>
      )}
      <div className="space-y-3">
        {list.data?.payouts.map((payout) => (
          <Link key={payout.id} href={`/settings/payouts/${payout.id}`} className="block">
            <Card className="bg-card border border-border rounded-lg">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{nzd(payout.amount)}</p>
                  <p className="text-sm text-muted-foreground">{nzDate(payout.arrivalDate)} · {payout.currency || "NZD"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {payout.xeroPostedAt && <Badge variant="outline">Posted to Xero</Badge>}
                  <Badge variant={statusVariant(payout.status)}>{statusLabel(payout.status)}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PayoutDetail({ payoutId }: { payoutId: string }) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detail = useQuery<DetailResponse>({ queryKey: ["/api/stripe-payouts", payoutId] });
  const preview = useQuery<PreviewResponse>({
    queryKey: ["/api/stripe-payouts", payoutId, "xero-preview"],
    enabled: confirmOpen,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/stripe-payouts/${payoutId}/xero-preview`, {});
      return res.json();
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/stripe-payouts/${payoutId}/xero`, { confirm: true });
      return res.json() as Promise<PostResponse>;
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payouts", payoutId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payouts"] });
      if (!body.success) {
        toast({ title: "Xero post incomplete", description: body.message || "Some lines were not posted.", variant: "destructive" });
      }
      if (body.success) setConfirmOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Could not post to Xero", description: error.message, variant: "destructive" });
    },
  });

  const payout = detail.data?.payout;
  const lines = detail.data?.lines ?? [];
  const jobs = lines.filter((line) => line.kind === "charge" || line.kind === "refund");
  const unmatched = lines.filter((line) => line.matchStatus === "unmatched");
  const posted = Array.isArray(payout?.xeroSummary) ? payout.xeroSummary as PostResponse["results"] : [];
  const plan = preview.data?.plan;
  const blocked = !!plan?.currencyBlocked || !!preview.data?.accountProblem || !!preview.data?.needsFeesAccount || preview.isError;

  return (
    <div className="pt-20 px-4 md:px-8 max-w-5xl mx-auto pb-16 space-y-6">
      <div>
        <Link href="/settings/payouts" className="inline-flex items-center text-sm text-muted-foreground mb-3">
          <ChevronLeft className="w-4 h-4 mr-1" /> Payouts
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{payout ? nzd(payout.amount) : "Payout"}</h1>
            <p className="text-muted-foreground">{payout ? `${nzDate(payout.arrivalDate)} · fees ${nzd(payout.feeTotal)}` : "Loading payout"}</p>
          </div>
          {payout && <Badge variant={statusVariant(payout.status)}>{statusLabel(payout.status)}</Badge>}
        </div>
      </div>

      {detail.data?.stripeModeMessage && (
        <p className="text-sm border border-border rounded-lg p-3 bg-muted/40">{detail.data.stripeModeMessage}</p>
      )}
      {detail.isError && <p className="text-sm text-destructive">{(detail.error as Error).message}</p>}

      <Card className="bg-card border border-border rounded-lg">
        <CardHeader>
          <CardTitle>Jobs in this payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.filter((line) => line.matchStatus === "matched").length === 0 && (
            <p className="text-sm text-muted-foreground">No matched jobs.</p>
          )}
          {jobs.filter((line) => line.matchStatus === "matched").map((line) => (
            <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <p className="font-medium">
                  {line.jobId ? (
                    <Link href={`/dispatch?job=${line.jobId}`} className="underline">Job {line.jobNumber || line.jobId}</Link>
                  ) : (
                    "Job"
                  )}
                  {line.customerName ? ` · ${line.customerName}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {line.kind === "refund" ? "Refund" : "Payment"}
                  {line.invoiceNumber ? ` · invoice ${line.invoiceNumber}` : ""}
                </p>
                {line.xeroMessage && <p className="text-sm text-muted-foreground">{line.xeroMessage}</p>}
              </div>
              <p className="font-medium">{nzd(line.amount)}</p>
            </div>
          ))}
          {payout && (
            <p className="text-sm text-muted-foreground">Stripe fees {nzd(payout.feeTotal)}. Refunds {nzd(payout.refundTotal)}.</p>
          )}
        </CardContent>
      </Card>

      {unmatched.length > 0 && (
        <Card className="bg-card border border-border rounded-lg">
          <CardHeader>
            <CardTitle>Unmatched</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unmatched.map((line) => (
              <div key={line.id} className="flex justify-between gap-3 text-sm">
                <span>{line.description || line.kind}</span>
                <span>{nzd(line.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {posted.length > 0 && (
        <Card className="bg-card border border-border rounded-lg">
          <CardHeader>
            <CardTitle>Posted to Xero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {posted.map((line, index) => (
              <p key={`${line.kind}-${index}`} className="text-sm">{line.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Button data-testid="button-post-xero" onClick={() => setConfirmOpen(true)} disabled={!detail.data?.xeroConnected}>
        Post to Xero
      </Button>
      {!detail.data?.xeroConnected && detail.data && (
        <p className="text-sm text-muted-foreground">Connect Xero before posting this payout.</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!post.isPending) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post this payout to Xero?</AlertDialogTitle>
            <AlertDialogDescription>
              Payments for matched invoices are created from account {preview.data?.clearingAccountCode || detail.data?.clearingAccountCode || "640"}. Invoices already paid in Xero are skipped. This can be run again without posting the same payment twice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-2 max-h-64 overflow-y-auto">
            {preview.isLoading && <p>Checking Xero…</p>}
            {preview.isError && <p className="text-destructive">{(preview.error as Error).message}</p>}
            {plan?.currencyBlocked && <p className="text-destructive">{plan.currencyBlocked}</p>}
            {preview.data?.accountProblem && <p className="text-destructive">{preview.data.accountProblem}</p>}
            {preview.data?.needsFeesAccount && <p className="text-destructive">Enter the Stripe fees expense account on the payouts page before posting.</p>}
            {plan && !preview.data?.clearingIsBank && plan.fee && (
              <p>The clearing account is not a Xero bank account, so fees post as a manual journal.</p>
            )}
            {plan?.payments.map((line) => (
              <p key={line.lineId}>Payment {nzd(line.amount)}{line.invoiceNumber ? ` for invoice ${line.invoiceNumber}` : ""}{line.jobNumber ? ` (job ${line.jobNumber})` : ""}{line.alreadyPosted ? " — already posted" : ""}</p>
            ))}
            {plan?.refunds.map((line) => (
              <p key={line.lineId}>Refund {nzd(line.amount)}{line.invoiceNumber ? ` for invoice ${line.invoiceNumber}` : ""}{line.alreadyPosted ? " — already posted" : ""}</p>
            ))}
            {plan?.fee && <p>Fees {nzd(Math.abs(plan.fee.amount))}{plan.fee.alreadyPosted ? " — already posted" : ""}, no GST.</p>}
            {plan?.skips.map((line) => (
              <p key={line.lineId} className="text-muted-foreground">{line.message}</p>
            ))}
            {plan?.clearing.gapMessage && <p>{plan.clearing.gapMessage}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-xero"
              disabled={blocked || preview.isLoading || post.isPending || !plan}
              onClick={(event) => {
                event.preventDefault();
                post.mutate();
              }}
            >
              {post.isPending ? "Posting…" : "Post to Xero"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
