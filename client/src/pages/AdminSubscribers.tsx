import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Phone, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlanOpt { id: string; key: string; name: string; }
interface SubscriptionInfo { status: string; planId: string | null; planKey: string | null; planName: string | null; stripeManaged: boolean; }

interface SubscriberSummary {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  createdAt: string | null;
  requiredDone: number;
  requiredTotal: number;
}

interface Channel { id: string; channelType: string; identifier: string; label: string | null; isActive: boolean; }

// Company Info fields the operator can edit on a subscriber's behalf.
const FIELDS: { key: string; label: string; type?: "text" | "color" }[] = [
  { key: "businessName", label: "Business name" },
  { key: "ownerName", label: "Owner name" },
  { key: "businessTagline", label: "Tagline" },
  { key: "businessDiscipline", label: "Trade / discipline" },
  { key: "tradeVocabulary", label: "Trade vocabulary" },
  { key: "businessPhone", label: "Phone" },
  { key: "businessEmail", label: "Email" },
  { key: "businessAddress", label: "Address" },
  { key: "businessGstNumber", label: "GST number" },
  { key: "bankAccountName", label: "Bank account name" },
  { key: "bankAccountNumber", label: "Bank account number" },
  { key: "jobReplyForwardEmail", label: "Forward replies to" },
  { key: "brandHeaderColor", label: "Brand header colour", type: "color" },
  { key: "brandAccentColor", label: "Brand accent colour", type: "color" },
];

function ProgressPill({ done, total }: { done: number; total: number }) {
  const allDone = total > 0 && done >= total;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${allDone ? "border-primary/30 text-primary bg-primary/5" : "border-border text-muted-foreground"}`}>
      {allDone ? "Set up" : `${done}/${total}`}
    </span>
  );
}

function SubscriberDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ success: boolean; data: { business: SubscriberSummary; settings: Record<string, any> | null; channels: Channel[]; checklist: { requiredDone: number; requiredTotal: number }; plans: PlanOpt[]; subscription: SubscriptionInfo | null } }>({
    queryKey: [`/api/admin/subscribers/${id}`],
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data?.data) {
      const s = data.data.settings ?? {};
      const next: Record<string, string> = {};
      for (const f of FIELDS) next[f.key] = s[f.key] ?? (f.type === "color" ? (f.key === "brandHeaderColor" ? "#0b0b0b" : "#39FF14") : "");
      setForm(next);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PUT", `/api/admin/subscribers/${id}/settings`, form);
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not save.");
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/subscribers/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't save", description: e.message }),
  });

  const [planSel, setPlanSel] = useState<string>("");
  useEffect(() => {
    if (data?.data?.subscription?.planId) setPlanSel(data.data.subscription.planId);
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/subscribers/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
  };

  const setStatus = useMutation({
    mutationFn: async (status: "active" | "suspended") => {
      const r = await apiRequest("PUT", `/api/admin/subscribers/${id}/status`, { status });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not update status.");
      return j;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update status", description: e.message }),
  });

  const setPlan = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PUT", `/api/admin/subscribers/${id}/plan`, { planId: planSel });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not change plan.");
      return j;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't change plan", description: e.message }),
  });

  if (isLoading) {
    return <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</div>;
  }
  const biz = data?.data?.business;
  const channels = data?.data?.channels ?? [];
  const subscription = data?.data?.subscription ?? null;
  const plans = data?.data?.plans ?? [];
  const suspended = biz?.status === "suspended";

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> All subscribers
      </Button>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold">{biz?.name}</h2>
        {biz && <ProgressPill done={biz.requiredDone} total={biz.requiredTotal} />}
        {suspended && <span className="text-xs px-2 py-0.5 rounded-full border border-destructive/40 text-destructive">Suspended</span>}
      </div>

      <Card className="mb-6 border-border">
        <CardHeader><CardTitle>Plan &amp; status</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Account status</p>
              <p className="text-sm text-muted-foreground">{suspended ? "Suspended — this subscriber can't log in." : "Active."}</p>
            </div>
            <Button
              variant={suspended ? "default" : "destructive"}
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate(suspended ? "active" : "suspended")}
            >
              {setStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : suspended ? "Reactivate" : "Suspend"}
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="font-medium mb-1">Plan</p>
            {subscription?.stripeManaged ? (
              <p className="text-sm text-muted-foreground">
                {subscription.planName || subscription.planKey || "—"} · managed via Stripe (change it in Stripe, not here).
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="planSel" className="text-xs">Comp / set plan</Label>
                  <Select value={planSel} onValueChange={setPlanSel}>
                    <SelectTrigger id="planSel"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!planSel || planSel === subscription?.planId || setPlan.isPending}
                  onClick={() => setPlan.mutate()}
                >
                  {setPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 border-border">
        <CardHeader><CardTitle>Company info</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.type === "color" ? "" : ""}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type === "color" ? "color" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={f.type === "color" ? "h-10 w-20 p-1" : ""}
                  />
                </div>
              ))}
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle>Inbound channels</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels registered. The subscriber can add these under Settings → Inbound Channels.</p>
          ) : (
            channels.filter((c) => c.isActive).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                {c.channelType === "email" ? <Mail className="h-4 w-4 text-muted-foreground" /> : <Phone className="h-4 w-4 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.label || c.identifier}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.channelType} · {c.identifier}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSubscribers() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<{ success: boolean; data: SubscriberSummary[] }>({
    queryKey: ["/api/admin/subscribers"],
    retry: false,
  });

  const subscribers = data?.data ?? [];

  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      {selectedId ? (
        <SubscriberDetail id={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold mb-1">Subscribers</h1>
          <p className="text-muted-foreground mb-6">Set up and review any subscriber's account during onboarding.</p>

          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</div>
          ) : error ? (
            <Card className="border-border"><CardContent className="pt-6 text-sm text-muted-foreground">This area is restricted to platform administrators.</CardContent></Card>
          ) : subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers yet.</p>
          ) : (
            <div className="space-y-2">
              {subscribers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="w-full flex items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ProgressPill done={s.requiredDone} total={s.requiredTotal} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
