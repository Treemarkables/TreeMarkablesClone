import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CreditCard, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Mirrors GET /api/billing/status (server/billingRoutes.ts)
interface BillingStatus {
  planKey: string;
  status: string; // active | trialing | past_due | canceled | none
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: string[];
  billingConfigured: boolean;
}

// Mirrors GET /api/billing/plans
interface Plan {
  key: string;
  name: string;
  priceNzd: string; // decimal as string
  interval: string;
  activeJobCap: number | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);

// Plan ordering for "is this an upgrade?" comparisons.
const PLAN_RANK: Record<string, number> = { freemium: 0, crew: 1, business: 2 };

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  none: "No subscription",
};

export default function Billing() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
  });
  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/billing/plans"],
  });

  // Checkout → redirect to Stripe-hosted page
  const checkoutMutation = useMutation({
    mutationFn: async (planKey: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { planKey });
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't start checkout",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stripe customer portal → redirect
  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't open billing portal",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-muted-foreground" data-testid="billing-restricted">
        Billing access is restricted to administrators.
      </div>
    );
  }

  const currentRank = status ? PLAN_RANK[status.planKey] ?? 0 : 0;
  const hasActiveSub = Boolean(status && status.status !== "none" && status.planKey !== "freemium");
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString("en-NZ")
    : null;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Subscription</h1>
          <p className="text-sm text-gray-600">Manage your plan and payment method</p>
        </div>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize" data-testid="current-plan-name">
                    {status?.planKey ?? "freemium"}
                  </p>
                  {periodEnd && (
                    <p className="text-sm text-muted-foreground">
                      {status?.cancelAtPeriodEnd ? "Ends" : "Renews"} {periodEnd}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    status?.status === "past_due"
                      ? "destructive"
                      : status?.status === "active" || status?.status === "trialing"
                        ? "default"
                        : "secondary"
                  }
                  data-testid="current-plan-status"
                >
                  {STATUS_LABEL[status?.status ?? "none"] ?? status?.status}
                </Badge>
              </div>

              {!status?.billingConfigured && (
                <p className="text-sm text-muted-foreground">
                  Online billing isn’t fully set up yet — subscribing may be unavailable.
                </p>
              )}

              {hasActiveSub && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    {portalMutation.isPending ? "Opening…" : "Manage billing & payment method"}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-3">
        {plansLoading
          ? null
          : (plans ?? []).map((plan) => {
              const rank = PLAN_RANK[plan.key] ?? 0;
              const isCurrent = status?.planKey === plan.key;
              const isPaid = plan.key !== "freemium";
              const isUpgrade = rank > currentRank;
              const price = Number(plan.priceNzd);

              return (
                <Card key={plan.key} className={isCurrent ? "border-primary" : undefined}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{plan.name}</span>
                      {isCurrent && <Badge variant="secondary">Current</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {price === 0 ? "Free" : `${formatCurrency(price)}/${plan.interval} + GST`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {plan.activeJobCap == null
                        ? "Unlimited jobs / month"
                        : `${plan.activeJobCap} jobs / month`}
                    </p>
                    {isCurrent ? (
                      <Button disabled className="w-full" variant="outline">
                        Your plan
                      </Button>
                    ) : isPaid && isUpgrade ? (
                      <Button
                        className="w-full"
                        onClick={() => checkoutMutation.mutate(plan.key)}
                        disabled={checkoutMutation.isPending || !status?.billingConfigured}
                        data-testid={`button-subscribe-${plan.key}`}
                      >
                        {checkoutMutation.isPending ? "Starting…" : hasActiveSub ? "Upgrade" : "Subscribe"}
                      </Button>
                    ) : (
                      // Downgrades / freemium are handled via the billing portal.
                      <Button disabled className="w-full" variant="outline">
                        {rank < currentRank ? "Manage to change" : "—"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
