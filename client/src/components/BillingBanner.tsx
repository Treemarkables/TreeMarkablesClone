import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

// In-app dunning. When a subscriber's renewal fails, Stripe flips the subscription to
// past_due (synced by the webhook), but nothing tells the owner — so they'd slide toward
// losing access silently. This banner nudges them to fix the card via the Stripe portal
// before that happens. Only the payment-problem statuses show it; active/trialing (and a
// deliberate cancel) show nothing, and comped Treemarkables has no subscription so it's
// invisible for the owner.
const PROBLEM_MESSAGE: Record<string, string> = {
  past_due: "Your last subscription payment didn't go through. Update your card to keep your access.",
  unpaid: "Your subscription is unpaid — update your card to restore access.",
  incomplete: "Your subscription isn't active yet — finish adding payment to unlock your plan.",
  incomplete_expired: "Your subscription setup expired — re-subscribe to unlock your plan.",
};

export function BillingBanner() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const { data } = useQuery<{ success: boolean; data: { status?: string } | null }>({
    queryKey: ["/api/billing/subscription"],
    staleTime: 5 * 60 * 1000,
  });
  const status = data?.data?.status;
  const message = status ? PROBLEM_MESSAGE[status] : undefined;

  const portal = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/billing/portal", {});
      const j = await r.json();
      if (!j.success || !j.url) throw new Error(j.message || "Could not open billing.");
      window.location.href = j.url;
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "Couldn't open billing", description: e?.message }),
  });

  if (!message) return null;

  return (
    <div
      className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
      data-testid="billing-banner"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-sm text-destructive">{message}</span>
      </div>
      {isAdmin ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => portal.mutate()}
          disabled={portal.isPending}
          className="shrink-0"
          data-testid="billing-banner-action"
        >
          {portal.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Update payment
        </Button>
      ) : (
        <span className="text-xs text-destructive shrink-0">Ask an admin to update the card.</span>
      )}
    </div>
  );
}
