/**
 * Inflow — Platform billing routes (Phase 4).
 *
 * Registered from routes.ts like registerXeroRoutes(). Endpoints:
 *   GET  /api/billing/status    — current subscription + resolved entitlements
 *   POST /api/billing/checkout  — start/upgrade a paid plan (returns Stripe URL)
 *   POST /api/billing/portal    — open the Stripe customer portal (returns URL)
 *   POST /api/billing/webhook   — Stripe → us; syncs subscription status (no auth)
 *
 * Inert until Stripe is configured: checkout/portal 503 without keys/price IDs;
 * the webhook 400s without STRIPE_BILLING_WEBHOOK_SECRET. No UI calls these yet.
 */

import type { Request, Response } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  isBillingConfigured,
  createSubscriptionCheckout,
  createCustomerPortalSession,
  constructBillingEvent,
  handleBillingEvent,
} from "./billing/stripeBilling";
import { resolveEntitlements } from "./tenancy/entitlements";

function appOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.startsWith("http")) return origin;
  return "https://app.treemarkables.co.nz";
}

export function registerBillingRoutes(app: any) {
  // ── Current subscription + entitlements (for the billing settings UI) ──────
  app.get("/api/billing/status", async (req: Request, res: Response) => {
    const businessId = req.session?.businessId;
    if (!req.session?.employeeId || !businessId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const [sub] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.businessId, businessId))
        .limit(1);
      const { planKey, entitlements } = await resolveEntitlements(businessId);
      return res.json({
        planKey,
        status: sub?.status ?? "none",
        billingInterval: sub?.billingInterval ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        entitlements: Array.from(entitlements),
        billingConfigured: isBillingConfigured(),
      });
    } catch (err: any) {
      console.error("[billing] status error:", err?.message);
      return res.status(500).json({ error: "Failed to load billing status" });
    }
  });

  // ── Start / upgrade a paid plan ────────────────────────────────────────────
  app.post("/api/billing/checkout", async (req: Request, res: Response) => {
    const businessId = req.session?.businessId;
    if (!req.session?.employeeId || !businessId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!isBillingConfigured()) {
      return res.status(503).json({ error: "Billing is not configured yet" });
    }
    const { planKey, interval } = req.body ?? {};
    if (planKey !== "crew" && planKey !== "business") {
      return res.status(400).json({ error: "planKey must be 'crew' or 'business'" });
    }
    const billingInterval = interval === "year" ? "year" : "month";
    try {
      const [emp] = await db
        .select({ email: schema.employees.email })
        .from(schema.employees)
        .where(eq(schema.employees.id, req.session.employeeId))
        .limit(1);
      const origin = appOrigin(req);
      const { url } = await createSubscriptionCheckout({
        businessId,
        planKey,
        interval: billingInterval,
        customerEmail: emp?.email ?? undefined,
        successUrl: `${origin}/settings/billing?status=success`,
        cancelUrl: `${origin}/settings/billing?status=cancelled`,
      });
      return res.json({ url });
    } catch (err: any) {
      console.error("[billing] checkout error:", err?.message);
      return res.status(502).json({ error: err?.message ?? "Checkout failed" });
    }
  });

  // ── Open the Stripe customer portal ────────────────────────────────────────
  app.post("/api/billing/portal", async (req: Request, res: Response) => {
    const businessId = req.session?.businessId;
    if (!req.session?.employeeId || !businessId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!isBillingConfigured()) {
      return res.status(503).json({ error: "Billing is not configured yet" });
    }
    try {
      const { url } = await createCustomerPortalSession({
        businessId,
        returnUrl: `${appOrigin(req)}/settings/billing`,
      });
      return res.json({ url });
    } catch (err: any) {
      console.error("[billing] portal error:", err?.message);
      return res.status(502).json({ error: err?.message ?? "Could not open portal" });
    }
  });

  // ── Stripe → us. Verifies signature, syncs subscription status. No auth. ───
  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    try {
      const event = await constructBillingEvent(req.rawBody as Buffer, req.headers["stripe-signature"] as string | undefined);
      await handleBillingEvent(event);
      return res.json({ received: true });
    } catch (err: any) {
      console.error("[billing] webhook error:", err?.message);
      return res.status(400).json({ error: `Webhook error: ${err?.message}` });
    }
  });
}
