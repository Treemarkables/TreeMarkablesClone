import { useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ChevronLeft, Check, CreditCard, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { isNativeApp } from "@/lib/platform";

interface Plan {
  id: string;
  key: string;
  name: string;
  priceNzd: string;
  activeJobCap: number | null;
  stripePriceId: string | null;
}
interface Subscription {
  status: string;
  planId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}
interface Usage {
  periodStart: string;
  enforced: boolean;
  sms: { used: number; cap: number | null; remaining: number };
  ai: { used: number; cap: number | null; remaining: number };
}

const FEATURES: Record<string, string[]> = {
  freemium: ["15 active jobs / month", "1 user", "Core jobs, quotes & invoicing", "Up to 3 photos per job"],
  crew: [
    "75 active jobs / month",
    "Unlimited users",
    "Unlimited photos + voice captions",
    "Full safety suite (SWMS, toolbox talks)",
    "200 SMS / month",
    "75 AI actions / month (Speech-to-Quote, extraction)",
    "Advanced analytics & job costing",
    "Integrations: Xero, Google Calendar, Gmail, Mailchimp",
    "Custom roles & permissions",
  ],
  business: [
    "Unlimited active jobs",
    "Everything in Crew, plus:",
    "600 SMS / month",
    "250 AI actions / month",
    "Workflow automation",
    "Priority support",
  ],
};

function UsageBar({ label, icon, used, cap }: { label: string; icon: ReactNode; used: number; cap: number | null }) {
  const unlimited = cap === null;
  const pct = unlimited || cap === 0 ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const over = !unlimited && cap > 0 && used >= cap;
  const near = !over && pct >= 80;
  const barColor = over ? "bg-destructive" : near ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-2">{icon}{label}</span>
        <span className="text-muted-foreground">{unlimited ? `${used} · Unlimited` : `${used} / ${cap}`}</span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {over && <p className="text-xs text-destructive mt-1">Included allowance used up for this month.</p>}
    </div>
  );
}

export default function SettingsBilling() {
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const { data: plansRes, isLoading: plansLoading } = useQuery<{ success: boolean; data: Plan[] }>({
    queryKey: ["/api/billing/plans"],
  });
  const { data: subRes } = useQuery<{ success: boolean; data: Subscription | null }>({
    queryKey: ["/api/billing/subscription"],
  });
  const { data: usageRes } = useQuery<{ success: boolean; data: Usage }>({
    queryKey: ["/api/billing/usage"],
  });

  const plans = plansRes?.data ?? [];
  const sub = subRes?.data ?? null;
  const usage = usageRes?.data ?? null;
  const isLive = sub && (sub.status === "active" || sub.status === "trialing");
  const currentPlanId = isLive ? sub!.planId : null;

  // App Store Guideline 3.1.1: the iOS shell must not surface any subscription
  // purchase / billing-management CTA (we bill via Stripe on the web). On native
  // we show plans read-only and point the owner to inflowapp.co.nz.
  const native = isNativeApp();

  const checkout = useMutation({
    mutationFn: async (planKey: string) => {
      const r = await apiRequest("POST", "/api/billing/checkout", { planKey });
      const j = await r.json();
      if (!j.success || !j.url) throw new Error(j.message || "Could not start checkout.");
      return j.url as string;
    },
    onMutate: (planKey: string) => setPending(planKey),
    onSuccess: (url: string) => {
      window.location.href = url; // redirect to Stripe's hosted card page
    },
    onError: (e: Error) => {
      setPending(null);
      toast({ variant: "destructive", title: "Couldn't start checkout", description: e.message });
    },
  });

  const portal = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/billing/portal", {});
      const j = await r.json();
      if (!j.success || !j.url) throw new Error(j.message || "Could not open billing portal.");
      return j.url as string;
    },
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't open billing", description: e.message }),
  });

  return (
    <div className="pt-20 px-4 md:px-8 max-w-5xl mx-auto pb-16">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to settings
      </Link>

      <h1 className="text-2xl font-semibold mb-1">Billing &amp; plan</h1>
      <p className="text-muted-foreground mb-6">
        {native
          ? "Your current plan and what each plan includes. Prices in NZD, excluding GST."
          : "Choose the plan that fits your business. Prices in NZD, excluding GST. Cancel anytime."}
      </p>

      {sub && (isLive || sub.status === "past_due") && (
        <Card className="mb-6 border-border">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="font-medium">
                {plans.find((p) => p.id === sub.planId)?.name ?? "—"} ·{" "}
                <span className="capitalize">{sub.status.replace("_", " ")}</span>
              </p>
              {sub.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString("en-NZ")}
                  {sub.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                </p>
              )}
            </div>
            {!native && (
              <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                <CreditCard className="h-4 w-4 mr-2" /> Manage billing
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {usage && !(usage.sms.cap === 0 && usage.ai.cap === 0) && (
        <Card className="mb-6 border-border">
          <CardHeader>
            <CardTitle className="text-base">This month&apos;s usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="SMS"
              icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
              used={usage.sms.used}
              cap={usage.sms.cap}
            />
            <UsageBar
              label="AI actions"
              icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
              used={usage.ai.used}
              cap={usage.ai.cap}
            />
            <p className="text-xs text-muted-foreground">Resets on the 1st of the month (NZ time).</p>
          </CardContent>
        </Card>
      )}

      {native && (
        <Card className="mb-6 border-border">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              To change your plan or manage payment details, sign in to your account at
              inflowapp.co.nz from a web browser.
            </p>
          </CardContent>
        </Card>
      )}

      {plansLoading ? (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading plans…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const paid = !!plan.stripePriceId;
            return (
              <Card key={plan.id} className={`border-border flex flex-col ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    <span>{plan.name}</span>
                    <span className="text-2xl font-bold">
                      ${Number(plan.priceNzd).toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-2 text-sm mb-6 flex-1">
                    {(FEATURES[plan.key] ?? []).map((f, i) => (
                      <li key={i} className="flex items-start">
                        <Check className="h-4 w-4 mr-2 mt-0.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button disabled className="w-full">Current plan</Button>
                  ) : native ? (
                    // No purchase CTA inside the iOS app (App Store 3.1.1).
                    <Button variant="outline" disabled className="w-full">
                      {paid ? "Available on the web" : "Free"}
                    </Button>
                  ) : paid ? (
                    <Button className="w-full" onClick={() => checkout.mutate(plan.key)} disabled={pending !== null}>
                      {pending === plan.key ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                      ) : (
                        `Subscribe to ${plan.name}`
                      )}
                    </Button>
                  ) : (
                    <Button variant="outline" disabled className="w-full">Free</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
