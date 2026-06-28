import { ReactNode } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

// Plan-based UI gating. Mirrors the server feature gates (server/tenancy/
// requireEntitlement.ts) so what the UI hides/locks matches what the API enforces.
// A feature is unlocked by the BUSINESS's subscription (useAuth().can), never the
// staff member's role. Treemarkables (comped) gets full entitlements from the server,
// so these gates are transparent for the owner.

const PLAN_LABEL: Record<string, string> = {
  "plan:crew": "Crew",
  "plan:business": "Business",
};

/**
 * Renders children only when the business's plan satisfies `requires`; otherwise
 * nothing. Use to HIDE gated nav items / action buttons for tenants who can't use them.
 */
export function PlanGate({ requires, children }: { requires: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(requires) ? <>{children}</> : null;
}

/**
 * Page-level gate: shows an upgrade prompt INSTEAD of the page when the plan doesn't
 * satisfy `requires`. Wrap a gated page's content so a direct visit to its URL shows an
 * upsell rather than an empty screen or a raw 403 once enforcement is on.
 */
export function UpgradeGate({
  requires,
  feature,
  children,
}: {
  requires: string;
  feature?: string;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (can(requires)) return <>{children}</>;

  const plan = PLAN_LABEL[requires] ?? "a higher";
  const what = feature ?? "This feature";
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6" data-testid="upgrade-gate">
      <div className="rounded-full bg-muted p-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{what} is on the {plan} plan</h2>
        <p className="text-muted-foreground mt-1 max-w-md">
          Upgrade your plan to unlock {feature ? feature.toLowerCase() : "this feature"}.
        </p>
      </div>
      <Button asChild>
        <Link href="/settings/billing">View plans</Link>
      </Button>
    </div>
  );
}
