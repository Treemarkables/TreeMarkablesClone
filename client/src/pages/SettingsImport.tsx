import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Database, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportSummary {
  customers: { imported: number; skipped: number };
  jobs: { imported: number; skipped: number; noCustomer: number };
  errors: string[];
}

export default function SettingsImport() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const { data: settingsData } = useQuery<{ success: boolean; data: { hasServicem8ApiKey?: boolean } }>({
    queryKey: ["/api/business-settings"],
  });
  const hasStoredKey = Boolean(settingsData?.data?.hasServicem8ApiKey);

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
      if (!j.success) throw new Error(j.message || "Import failed.");
      return j.data as ImportSummary;
    },
    onSuccess: (data) => {
      setSummary(data);
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    },
  });

  const busy = testConnection.isPending || runImport.isPending;
  const keyReady = apiKey.trim().length > 0 || hasStoredKey;

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
            address, description and invoiced total. Safe to re-run: anything already imported is skipped.
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
              data-testid="input-sm8-api-key"
            />
            <p className="text-xs text-muted-foreground">
              In ServiceM8, go to Settings &gt; Integrations &gt; API to generate a key for your account.
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
              {runImport.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {runImport.isPending ? "Importing — this can take a few minutes" : "Start import"}
            </Button>
          </div>

          {testResult && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="sm8-test-result">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              {testResult}
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-border p-4 space-y-2" data-testid="sm8-import-summary">
              <p className="font-medium">Import finished</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  Customers: {summary.customers.imported} imported
                  {summary.customers.skipped > 0 && `, ${summary.customers.skipped} already present`}
                </li>
                <li>
                  Jobs: {summary.jobs.imported} imported
                  {summary.jobs.skipped > 0 && `, ${summary.jobs.skipped} already present`}
                  {summary.jobs.noCustomer > 0 && ` (${summary.jobs.noCustomer} without a matching customer)`}
                </li>
              </ul>
              {summary.errors.length > 0 && (
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-1.5 text-destructive font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {summary.errors.length} record{summary.errors.length === 1 ? "" : "s"} couldn't be imported
                  </p>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-0.5">
                    {summary.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
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
