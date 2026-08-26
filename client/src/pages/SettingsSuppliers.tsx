import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Copy, Check, Mail, Pause, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SupplierConnection {
  id: string;
  supplierName: string;
  inboundAddress: string;
  allowedSenderDomains: string[];
  pendingSenderDomain: string | null;
  status: "pending_first_email" | "active" | "paused";
  createdAt: string;
}

interface ConnectionsResponse {
  success: boolean;
  data: SupplierConnection[];
  catchAllAddress: string;
  inboundDomain: string;
}

// Never show the enum values to the user.
const STATUS_LABEL: Record<SupplierConnection["status"], string> = {
  pending_first_email: "Waiting for first invoice",
  active: "Active",
  paused: "Paused",
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — the address is selectable text anyway */
        }
      }}
      data-testid="button-copy-address"
    >
      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
      {copied ? "Copied" : label || "Copy"}
    </Button>
  );
}

export default function SettingsSuppliers() {
  const { toast } = useToast();
  const [supplierName, setSupplierName] = useState("");
  const [justCreated, setJustCreated] = useState<SupplierConnection | null>(null);

  const { data, isLoading } = useQuery<ConnectionsResponse>({
    queryKey: ["/api/supplier-connections"],
  });
  const connections = data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/supplier-connections"] });

  const addSupplier = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/supplier-connections", { supplierName });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not add supplier.");
      return j.data as SupplierConnection;
    },
    onSuccess: (created) => {
      setSupplierName("");
      setJustCreated(created);
      invalidate();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't add supplier", description: e.message }),
  });

  const confirmSender = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/supplier-connections/${id}/confirm-sender`, {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not confirm sender.");
      return j;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-documents"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't confirm sender", description: e.message }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const r = await apiRequest("PATCH", `/api/supplier-connections/${id}`, { status });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not update supplier.");
      return j;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update supplier", description: e.message }),
  });

  const canAdd = supplierName.trim().length > 0 && !addSupplier.isPending;

  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-1">Suppliers</h1>
      <p className="text-muted-foreground mb-6">
        Each supplier gets its own Inflow email address. Invoices sent there land in your{" "}
        <Link href="/supplier-invoices" className="underline underline-offset-2">Supplier Invoices</Link> queue,
        already read and checked, ready to assign to a job.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add supplier</CardTitle>
          <CardDescription>One address per supplier — that's how Inflow knows who the bill is from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Label htmlFor="supplier-name">Supplier name</Label>
              <Input
                id="supplier-name"
                placeholder="e.g. Placemakers Gisborne"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canAdd) addSupplier.mutate(); }}
                data-testid="input-supplier-name"
              />
            </div>
            <Button onClick={() => addSupplier.mutate()} disabled={!canAdd} data-testid="button-add-supplier">
              {addSupplier.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add supplier
            </Button>
          </div>

          {justCreated && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3" data-testid="panel-new-address">
              <div className="text-sm font-medium">{justCreated.supplierName} — invoice address</div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <code className="text-sm break-all bg-background border rounded px-2 py-1 flex-1">{justCreated.inboundAddress}</code>
                <CopyButton value={justCreated.inboundAddress} label="Copy address" />
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Add this address as a second invoice delivery address in your supplier's trade portal, or ask the
                  branch to add it to your account. You'll keep receiving invoices where you do now — Inflow just gets a copy.
                </p>
                <p>First invoice usually arrives within a couple of days.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Your suppliers</CardTitle>
          <CardDescription>When the first invoice arrives we'll ask you to confirm the sender before it's processed.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : connections.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              No suppliers yet. Add your first one above.
            </div>
          ) : (
            <ul className="divide-y">
              {connections.map((c) => (
                <li key={c.id} className="py-3 space-y-2" data-testid={`supplier-connection-${c.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.supplierName}</span>
                    <Badge variant={c.status === "active" ? "default" : c.status === "paused" ? "secondary" : "outline"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                    <span className="ml-auto flex gap-1">
                      {c.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: "paused" })} aria-label="Pause">
                          <Pause className="h-4 w-4 mr-1" /> Pause
                        </Button>
                      )}
                      {c.status === "paused" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: "active" })} aria-label="Resume">
                          <Play className="h-4 w-4 mr-1" /> Resume
                        </Button>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs sm:text-sm break-all text-muted-foreground flex-1">{c.inboundAddress}</code>
                    <CopyButton value={c.inboundAddress} />
                  </div>
                  {c.status === "pending_first_email" && c.pendingSenderDomain && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="flex-1">
                        First email arrived from <span className="font-medium">@{c.pendingSenderDomain}</span>. Is that this supplier?
                      </span>
                      <Button size="sm" onClick={() => confirmSender.mutate(c.id)} disabled={confirmSender.isPending} data-testid={`button-confirm-sender-${c.id}`}>
                        <ShieldCheck className="h-4 w-4 mr-1" /> Confirm this sender
                      </Button>
                    </div>
                  )}
                  {c.allowedSenderDomains?.length > 0 && (
                    <div className="text-xs text-muted-foreground">Accepting mail from: {c.allowedSenderDomains.map((d) => `@${d}`).join(", ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data?.catchAllAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Forward from your own inbox</CardTitle>
            <CardDescription>
              Got a bill in your own email? Forward it here. These go into the same queue — the supplier is read off the document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="text-sm break-all bg-muted/40 border rounded px-2 py-1 flex-1">{data.catchAllAddress}</code>
              <CopyButton value={data.catchAllAddress} label="Copy address" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
