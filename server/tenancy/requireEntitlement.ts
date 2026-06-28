/**
 * Inflow — feature-gate middleware.
 *
 * Blocks a route unless the current business's subscription entitlements satisfy
 * `requires` (e.g. "plan:crew", "plan:business"). This is the route-level half of
 * the entitlements layer — the capability catalog (capabilities.ts) defines which
 * tier each feature needs; this enforces it on the API surface.
 *
 * DARK-LAUNCHED behind FEATURE_GATES_ENFORCE: with the flag OFF (default) it logs a
 * `FEATURE_GATE_BLOCK ... enforced=false` line and lets the request through, so we
 * can watch exactly what WOULD block before flipping it on. FAIL-OPEN on any error.
 *
 * Treemarkables (the platform owner) and session-less / public requests are never
 * gated — a webhook or OAuth callback with no tenant context passes straight through.
 */
import type { Request, Response, NextFunction } from "express";
import { resolveEntitlements, hasEntitlement } from "./entitlements";
import { currentBusinessId } from "./tenantStore";
import { TREEMARKABLES_BUSINESS_IDS } from "@shared/roleChecklistAccess";
import type { Entitlement } from "./capabilities";

/** Only actually 403 when this is on. Off = log-only, never blocks. */
export const FEATURE_GATES_ENFORCE = process.env.FEATURE_GATES_ENFORCE === "true";

const UPSELL: Record<string, string> = {
  "plan:crew": "This feature is on the Crew plan and above — upgrade to unlock it.",
  "plan:business": "This feature is on the Business plan — upgrade to unlock it.",
};

/** Express middleware factory. `feature` is just a label for the structured log line. */
export function requireEntitlement(requires: Entitlement, feature?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = currentBusinessId();
      // No tenant (public/webhook) or Treemarkables (comped) → never gated.
      if (!businessId || TREEMARKABLES_BUSINESS_IDS.includes(businessId)) return next();

      const { planKey, entitlements } = await resolveEntitlements(businessId);
      if (!hasEntitlement(entitlements, requires)) {
        console.warn(
          `FEATURE_GATE_BLOCK requires=${requires} feature=${feature ?? "-"} business=${businessId} plan=${planKey} enforced=${FEATURE_GATES_ENFORCE}`,
        );
        if (FEATURE_GATES_ENFORCE) {
          return res.status(403).json({
            success: false,
            code: "feature_locked",
            requires,
            message: UPSELL[requires] ?? "Upgrade your plan to unlock this feature.",
          });
        }
      }
    } catch (e) {
      console.warn(`FEATURE_GATE_ERROR ${(e as Error)?.message}`); // fail-open
    }
    return next();
  };
}
