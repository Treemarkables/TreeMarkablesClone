import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ChevronLeft, Check, CreditCard, Loader2, MessageSquare, Phone, Sparkles } from "lucide-react";

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
interface AddOn {
  id: string;
  key: string;
  name: string;
  priceNzd: string | null;
  billingType: string;
  active: boolean;
}

// Per-add-on copy + icon. Keyed by the catalog `key` (matches the capability
// `requires` entitlement keys in server/tenancy/capabilities.ts).
const ADDON_META: Record<string, { icon: typeof MessageSquare; blurb: string }> = {
  sms: { icon: MessageSquare, blurb: "Text customers and send automated booking reminders." },
  call_recording: { icon: Phone, blurb: "In-app calling with recorded, searchable call history." },
  ai: { icon: Sparkles, blurb: "AI Smart Dispatch, Speech-to-Quote, lead & video transcription." },
};

const FEATURES: Record<string, string[]> = {
  freemium: ["15 active jobs / month", "1 user", "Core jobs, quotes & invoicing", "Up to 3 photos per job"],
  crew: [
    "75 active jobs / month",
    "Unlimited users",
    "Unlimited photos + voice captions",
    "Full safety suite (SWMS, toolbox talks)",
    "SMS & booking reminders",
    "Custom roles & permissions",
  ],
  business: [
    "Unlimited active jobs",
    "Everything in Crew, plus:",
    "Marketing & reputation suite",
    "Advanced analytics & job costing",
    "AI Smart Dispatch & Speech-to-Quote",
    "Workflow automation",
    "Priority support",
  ],
};

export default function SettingsBilling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [togglingAddOn, setTogglingAddOn] = useState<string | null>(null);

  const { data: plansRes, isLoading: plansLoading } = useQuery<{ success: boolean; data: Plan[] }>({
    queryKey: ["/api/billing/plans"],
  });
  const { data: subRes } = useQuery<{ success: boolean; data: Subscription | null }>({
    queryKey: ["/api/billing/subscription"],
  });
  const { data: addOnsRes } = useQuery<{ success: boolean; data: AddOn[] }>({
    queryKey: ["/api/billing/addons"],
  });

  const plans = plansRes?.data ?? [];
  const sub = subRes?.data ?? null;
  const addOns = addOnsRes?.data ?? [];
  const isLive = sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
  const currentPlanId = isLive ? sub!.planId : null;
  const currentPlanKey = plans.find((p) => p.id === currentPlanId)?.key;
  // Extras ride on a paid plan — a comped Business sub (no Stripe id) counts too.
  const onPaidPlan = !!isLive && !!currentPlanKey && currentPlanKey !== "freemium";

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

  const toggleAddOn = useMutation({
    mutationFn: async ({ key, on }: { key: string; on: boolean }) => {
      const action = on ? "activate" : "deactivate";
      const r = await apiRequest("POST", `/api/billing/addons/${key}/${action}`, {});
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Could not update add-on.");
    },
    onMutate: ({ key }: { key: string; on: boolean }) => setTogglingAddOn(key),
    onSettled: () => {
      setTogglingAddOn(null);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/addons"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update add-on", description: e.message }),
  });

  return (
    <div className="pt-20 px-4 md:px-8 max-w-5xl mx-auto pb-16">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to settings
      </Link>

      <h1 className="text-2xl font-semibold mb-1">Billing &amp; plan</h1>
      <p className="text-muted-foreground mb-6">
        Choose the plan that fits your business. Prices in NZD, excluding GST. Cancel anytime.
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
            <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <CreditCard className="h-4 w-4 mr-2" /> Manage billing
            </Button>
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

      {addOns.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-1">Extras</h2>
          <p className="text-muted-foreground mb-4">
            {onPaidPlan
              ? "Switch on the add-ons your team needs. Billed monthly on top of your plan, prorated. Turn off anytime."
              : "Add-ons are available on the Crew and Business plans. Upgrade above to switch them on."}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {addOns.map((addOn) => {
              const meta = ADDON_META[addOn.key];
              const Icon = meta?.icon ?? CreditCard;
              const busy = togglingAddOn === addOn.key;
              return (
                <Card key={addOn.id} className={`border-border flex flex-col ${addOn.active ? "ring-2 ring-primary" : ""}`}>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-base">{addOn.name}</span>
                      </span>
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin mt-1" />
                      ) : (
                        <Switch
                          checked={addOn.active}
                          disabled={!onPaidPlan || toggleAddOn.isPending}
                          onCheckedChange={(on) => toggleAddOn.mutate({ key: addOn.key, on })}
                        />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    {meta?.blurb && <p className="text-sm text-muted-foreground mb-4 flex-1">{meta.blurb}</p>}
                    {addOn.priceNzd && Number(addOn.priceNzd) > 0 && (
                      addOn.billingType === "metered" ? (
                        <p className="text-sm">
                          <span className="text-lg font-bold">{(Number(addOn.priceNzd) * 100).toFixed(0)}c</span>
                          <span className="text-muted-foreground"> / message · billed to usage</span>
                        </p>
                      ) : (
                        <p className="text-sm">
                          <span className="text-lg font-bold">${Number(addOn.priceNzd).toFixed(0)}</span>
                          <span className="text-muted-foreground">/mo</span>
                        </p>
                      )
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
