import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  GitMerge,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface XeroInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  reference: string | null;
  contactName: string | null;
  amountDue: number | null;
  subtotal: number | null;
  date: string | null;
  dueDate: string | null;
}

interface VibeJob {
  jobId: number;
  jobNumber: string | null;
  customerName: string | null;
  title: string | null;
  address: string | null;
  subtotal: number | null;
  totalAmount: number | null;
}

type MatchState = "accepted" | "rejected" | "pending";

interface MatchedRow {
  xeroInvoice: XeroInvoice;
  vibeJob: VibeJob | null;
  score: number;
  reasons: string[];
  state: MatchState;
}

// ─── Matching logic ──────────────────────────────────────────────────────────

function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  const tokenize = (s: string): Set<string> =>
    new Set(s.split(/\s+/).filter(Boolean));

  const setA = tokenize(normalize(a));
  const setB = tokenize(normalize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((t) => { if (setB.has(t)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function scoreMatch(
  xeroInv: XeroInvoice,
  vibeJob: VibeJob,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Criterion 1 — Job ID anywhere in Xero reference (highest weight)
  if (
    xeroInv.reference &&
    xeroInv.reference.includes(String(vibeJob.jobId))
  ) {
    score += 3;
    reasons.push("Job ID in reference");
  }

  // Criterion 2 — Fuzzy client name match
  if (xeroInv.contactName && vibeJob.customerName) {
    const sim = nameSimilarity(xeroInv.contactName, vibeJob.customerName);
    if (sim >= 0.5) {
      score += 2;
      reasons.push("Name match");
    }
  }

  // Criterion 3 — Subtotal (exc GST) match within 1%
  if (xeroInv.subtotal != null && vibeJob.subtotal != null) {
    const diff = Math.abs(xeroInv.subtotal - vibeJob.subtotal);
    const base = Math.max(Math.abs(xeroInv.subtotal), 0.01);
    if (diff / base < 0.01) {
      score += 1;
      reasons.push("Amount match");
    }
  }

  return { score, reasons };
}

function buildMatches(
  invoices: XeroInvoice[],
  jobs: VibeJob[],
): MatchedRow[] {
  return invoices.map((inv) => {
    let bestJob: VibeJob | null = null;
    let bestScore = 0;
    let bestReasons: string[] = [];

    for (const job of jobs) {
      const { score, reasons } = scoreMatch(inv, job);
      if (score > bestScore) {
        bestScore = score;
        bestJob = job;
        bestReasons = reasons;
      }
    }

    return {
      xeroInvoice: inv,
      vibeJob: bestScore > 0 ? bestJob : null,
      score: bestScore,
      reasons: bestReasons,
      // Auto-accept high-confidence matches (score >= 3 means job ID hit)
      state: bestScore >= 3 ? "accepted" : "pending",
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceBadge(score: number) {
  if (score >= 3)
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        High
      </Badge>
    );
  if (score === 2)
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
        Medium
      </Badge>
    );
  if (score === 1)
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-300">
        Low
      </Badge>
    );
  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-300">
      No match
    </Badge>
  );
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Reconciliation() {
  const { toast } = useToast();

  const {
    data: xeroData,
    isLoading: xeroLoading,
    error: xeroError,
    refetch: refetchXero,
  } = useQuery<{ success: boolean; data: XeroInvoice[] }>({
    queryKey: ["/api/reconciliation/xero-sales"],
    retry: false,
  });

  const {
    data: jobsData,
    isLoading: jobsLoading,
    error: jobsError,
  } = useQuery<{ success: boolean; data: VibeJob[] }>({
    queryKey: ["/api/reconciliation/vibe-jobs"],
    retry: false,
  });

  const isLoading = xeroLoading || jobsLoading;
  const fetchError =
    (xeroError as Error | null)?.message ||
    (jobsError as Error | null)?.message ||
    null;

  const rawMatches = useMemo(
    () =>
      xeroData?.data && jobsData?.data
        ? buildMatches(xeroData.data, jobsData.data)
        : [],
    [xeroData, jobsData],
  );

  const [rowStates, setRowStates] = useState<Record<string, MatchState>>({});

  // Merge computed matches with any user overrides
  const rows: MatchedRow[] = useMemo(
    () =>
      rawMatches.map((r) => ({
        ...r,
        state: rowStates[r.xeroInvoice.invoiceId] ?? r.state,
      })),
    [rawMatches, rowStates],
  );

  function setRowState(invoiceId: string, state: MatchState) {
    setRowStates((prev) => ({ ...prev, [invoiceId]: state }));
  }

  const acceptedRows = rows.filter(
    (r) => r.state === "accepted" && r.vibeJob !== null,
  );

  const commitMutation = useMutation({
    mutationFn: async () => {
      const matches = acceptedRows.map((r) => ({
        xeroInvoiceId: r.xeroInvoice.invoiceId,
        jobId: r.vibeJob!.jobId,
        amount: r.xeroInvoice.amountDue ?? r.xeroInvoice.subtotal ?? 0,
      }));
      const res = await apiRequest("POST", "/api/reconciliation/commit", {
        matches,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const { succeeded, failed, total } = data.summary ?? {};
      toast({
        title: "Reconciliation committed",
        description: `${succeeded}/${total} payments created${failed > 0 ? `, ${failed} failed` : ""}.`,
        variant: failed > 0 ? "destructive" : "default",
      });
      // Clear user overrides and refresh sales so reconciled invoices disappear
      setRowStates({});
      queryClient.invalidateQueries({
        queryKey: ["/api/reconciliation/xero-sales"],
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Commit failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <p className="text-sm text-gray-500">Loading reconciliation data…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Failed to load data</p>
              <p className="text-sm text-red-700 mt-1">{fetchError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  refetchXero();
                  queryClient.invalidateQueries({
                    queryKey: ["/api/reconciliation/vibe-jobs"],
                  });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  const pendingCount = rows.filter((r) => r.state === "pending").length;
  const rejectedCount = rows.filter((r) => r.state === "rejected").length;

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-orange-600" />
              Xero Reconciliation
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Match authorised Xero invoices to completed jobs, then commit
              payments.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-500">
              {rows.length} invoice{rows.length !== 1 ? "s" : ""}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchXero()}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={acceptedRows.length === 0 || commitMutation.isPending}
              onClick={() => commitMutation.mutate()}
            >
              {commitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Commit {acceptedRows.length > 0 ? `(${acceptedRows.length})` : ""}
            </Button>
          </div>
        </div>
      </div>

      {/* Commit result banner */}
      {commitMutation.isSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-4 md:px-6 py-3 flex items-center gap-2 text-green-800 text-sm">
          <CheckCircle className="h-4 w-4" />
          Payments committed successfully. Reconciled invoices have been
          removed from the list.
        </div>
      )}

      {/* Summary pills */}
      <div className="px-4 md:px-6 py-3 flex flex-wrap gap-2 text-sm border-b bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
        <Badge className="bg-green-100 text-green-800 border-green-200">
          {rows.filter((r) => r.state === "accepted").length} accepted
        </Badge>
        <Badge className="bg-gray-100 text-gray-600 border-gray-200">
          {pendingCount} pending
        </Badge>
        {rejectedCount > 0 && (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            {rejectedCount} rejected
          </Badge>
        )}
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          {rows.filter((r) => r.vibeJob === null).length} unmatched
        </Badge>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <p className="font-medium">All caught up</p>
          <p className="text-sm">No outstanding authorised invoices to reconcile.</p>
        </div>
      )}

      {/* Match rows */}
      <div className="p-4 md:p-6 space-y-3">
        {rows.map((row) => {
          const inv = row.xeroInvoice;
          const job = row.vibeJob;
          const isAccepted = row.state === "accepted";
          const isRejected = row.state === "rejected";

          return (
            <Card
              key={inv.invoiceId}
              className={`transition-opacity ${isRejected ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Xero invoice */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                      Xero Invoice
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {inv.contactName ?? "Unknown contact"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {inv.invoiceNumber ?? inv.invoiceId}
                      {inv.reference && (
                        <span className="ml-2 text-gray-400">
                          Ref: {inv.reference}
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {fmt(inv.subtotal)}{" "}
                      <span className="text-xs text-gray-400 font-normal">
                        exc GST
                      </span>
                    </p>
                  </div>

                  {/* Arrow + confidence */}
                  <div className="flex lg:flex-col items-center gap-2 lg:gap-1 flex-shrink-0">
                    <ChevronRight className="h-4 w-4 text-gray-400 rotate-90 lg:rotate-0" />
                    {confidenceBadge(row.score)}
                    {row.reasons.length > 0 && (
                      <p className="text-xs text-gray-400 text-center hidden lg:block">
                        {row.reasons.join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Vibe job */}
                  <div className="flex-1 min-w-0">
                    {job ? (
                      <>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                          Vibe Job
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {job.customerName ?? "Unknown customer"}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {job.jobNumber && (
                            <span className="mr-2">#{job.jobNumber}</span>
                          )}
                          {job.title ?? job.address ?? `Job ${job.jobId}`}
                        </p>
                        <p className="text-sm font-medium mt-1">
                          {fmt(job.subtotal)}{" "}
                          <span className="text-xs text-gray-400 font-normal">
                            exc GST
                          </span>
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">No match found</span>
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject buttons */}
                  {job && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant={isAccepted ? "default" : "outline"}
                        className={
                          isAccepted
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                        }
                        onClick={() =>
                          setRowState(
                            inv.invoiceId,
                            isAccepted ? "pending" : "accepted",
                          )
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {isAccepted ? "Accepted" : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant={isRejected ? "destructive" : "outline"}
                        onClick={() =>
                          setRowState(
                            inv.invoiceId,
                            isRejected ? "pending" : "rejected",
                          )
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {isRejected ? "Rejected" : "Reject"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline match reasons on mobile */}
                {row.reasons.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 lg:hidden">
                    Matched on: {row.reasons.join(" · ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky footer commit bar (when there are accepted rows) */}
      {acceptedRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {acceptedRows.length} match{acceptedRows.length !== 1 ? "es" : ""}{" "}
            ready to commit
          </span>
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            disabled={commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
          >
            {commitMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Commit payments
          </Button>
        </div>
      )}
    </div>
  );
}
