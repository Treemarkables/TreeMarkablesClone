import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Database, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportProgress {
  running: boolean;
  phase: "idle" | "connecting" | "fetching" | "customers" | "jobs" | "done" | "failed";
  customers?: { done: number; total: number; imported: number; skipped: number };
  jobs?: { done: number; total: number; imported: number; skipped: number; noCustomer: number };
  errors?: string[];
  message?: string;
}

const PHASE_LABEL: Record<string, string> = {
  connecting: "Connecting to ServiceM8…",
  fetching: "Fetching your ServiceM8 data…",
  customers: "Importing customers…",
  jobs: "Importing jobs…",
};

export default function SettingsImport() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: settingsData } = useQuery<{ success: boolean; data: { hasServicem8ApiKey?: boolean } }>({
    queryKey: ["/api/business-settings"],
  });
  const hasStoredKey = Boolean(settingsData?.data?.hasServicem8ApiKey);

  // Poll the background run while it's active. Also picks up an already-running
  // import on page load (e.g. after navigating away and back).
  const { data: statusData, refetch: refetchStatus } = useQuery<{ success: boolean; data: ImportProgress }>({
    queryKey: ["/api/import/servicem8/status"],
    refetchInterval: (query) => (query.state.data?.data?.running ? 2000 : false),
  });
  const status = statusData?.data;
  const running = Boolean(status?.running);

  // When a run transitions to finished, refresh everything the import touches.
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    }
    prevRunning.current = running;
  }, [running]);

  const testConnection = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/import/servicem8/test", { apiKey });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Connection test failed.");
      return j as { message: string };
    },
    onSuccess: (j) => setTestResult(j.message),
    onError: (e: Error) => {
      setTestResult(null);
      toast({ variant: "destructive", title: "Couldn't connect to ServiceM8", description: e.message });
    },
  });

  const runImport = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/import/servicem8/run", { apiKey });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Import failed to start.");
      return j;
    },
    onSuccess: () => refetchStatus(),
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Import didn't start", description: e.message });
    },
  });

  const busy = testConnection.isPending || runImport.isPending || running;
  const keyReady = apiKey.trim().length > 0 || hasStoredKey;

  const progressPct = (() => {
    if (!status || !running) return 0;
    const c = status.customers;
    const j = status.jobs;
    const total = (c?.total ?? 0) + (j?.total ?? 0);
    if (total === 0) return 5; // still connecting/fetching
    return Math.min(99, Math.round((((c?.done ?? 0) + (j?.done ?? 0)) / total) * 100));
  })();

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Import &amp; Migration</h1>
          <p className="text-sm text-muted-foreground">Bring your existing customers and jobs into Inflow.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Migrate from ServiceM8</CardTitle>
          </div>
          <CardDescription>
            Imports your ServiceM8 clients (with their contact details) and jobs — including each job's status,
            address, description and invoiced total. The import runs in the background and can take several
            minutes for a large account. Safe to re-run: anything already imported is skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sm8-key">ServiceM8 API key</Label>
            <Input
              id="sm8-key"
              type="password"
              autoComplete="off"
              placeholder={hasStoredKey ? "••••••••  (saved — leave blank to reuse)" : "Paste your ServiceM8 API key"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              disabled={running}
              data-testid="input-sm8-api-key"
            />
            <p className="text-xs text-muted-foreground">
              In the ServiceM8 web app, go to Settings &gt; API Keys (or Developer &gt; My Apps &gt; Private App) to generate a key.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={busy || !keyReady}
              data-testid="button-sm8-test"
            >
              {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test connection
            </Button>
            <Button
              onClick={() => runImport.mutate()}
              disabled={busy || !keyReady}
              data-testid="button-sm8-import"
            >
              {(runImport.isPending || running) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {running ? "Import running" : "Start import"}
            </Button>
          </div>

          {testResult && !running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="sm8-test-result">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              {testResult}
            </div>
          )}

          {running && status && (
            <div className="rounded-lg border border-border p-4 space-y-3" data-testid="sm8-import-progress">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{PHASE_LABEL[status.phase] ?? "Importing…"}</p>
                <span className="text-sm text-muted-foreground tabular-nums" data-testid="sm8-import-percent">
                  {progressPct}%
                </span>
              </div>
              <Progress value={progressPct} />
              <ul className="text-sm text-muted-foreground space-y-1">
                {(status.phase === "customers" || status.phase === "jobs") && (
                  <>
                    <li>
                      Customers: {status.customers?.done ?? 0} of {status.customers?.total ?? 0} processed
                      {" "}({status.customers?.imported ?? 0} imported)
                    </li>
                    <li>
                      Jobs: {status.jobs?.done ?? 0} of {status.jobs?.total ?? 0} processed
                      {" "}({status.jobs?.imported ?? 0} imported)
                    </li>
                  </>
                )}
                <li>You can leave this page — the import keeps running and this page picks it back up.</li>
              </ul>
            </div>
          )}

          {!running && status?.phase === "done" && (
            <div className="rounded-lg border border-border p-4 space-y-2" data-testid="sm8-import-summary">
              <p className="font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                Import finished
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  Customers: {status.customers?.imported ?? 0} imported
                  {(status.customers?.skipped ?? 0) > 0 && `, ${status.customers?.skipped} already present`}
                </li>
                <li>
                  Jobs: {status.jobs?.imported ?? 0} imported
                  {(status.jobs?.skipped ?? 0) > 0 && `, ${status.jobs?.skipped} already present`}
                  {(status.jobs?.noCustomer ?? 0) > 0 && ` (${status.jobs?.noCustomer} without a matching customer)`}
                </li>
              </ul>
              {(status.errors?.length ?? 0) > 0 && (
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-1.5 text-destructive font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {status.errors!.length} record{status.errors!.length === 1 ? "" : "s"} couldn't be imported
                  </p>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-0.5">
                    {status.errors!.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!running && status?.phase === "failed" && (
            <div className="rounded-lg border border-destructive/50 p-4 space-y-1" data-testid="sm8-import-failed">
              <p className="flex items-center gap-1.5 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Import failed
              </p>
              <p className="text-sm text-muted-foreground">{status.message ?? "Something went wrong — try again."}</p>
              <p className="text-sm text-muted-foreground">
                Re-running is safe: anything that already made it across will be skipped.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Import from CSV</CardTitle>
          </div>
          <CardDescription>
            Coming from another platform? Export your customers to CSV and upload them on the Clients page —
            the importer matches columns automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/clients" className="inline-flex items-center gap-1">
              Go to Clients <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
