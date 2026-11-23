// Admin payout list, on-demand Stripe pull, and the confirmed Xero post.
// Everything is scoped to the signed-in company.

import type { Express, Request, Response } from "express";
import { getNZDateString } from "../shared/dateUtils";
import { businessOwnsStripeAccount } from "./stripe";
import { storage } from "./storage";
import { currentBusinessId } from "./tenancy/tenantStore";
import { getConnectedXeroClient } from "./xeroRoutes";
import {
  STRIPE_CLEARING_ACCOUNT,
  clearingAccountIsBank,
  clearingAccountProblem,
  parseAccountCode,
  planXeroPost,
  resolvePayoutStripeAccount,
  type PayoutLineKind,
  type PostableLine,
} from "../shared/stripePayouts";
import { PayoutSyncError, syncStripePayoutsForBusiness } from "./stripePayoutSync";
import {
  getStripePayout,
  listStripePayoutLines,
  listStripePayouts,
  savePayoutLineXero,
  savePayoutXero,
  tryLockStripePayout,
  unlockStripePayout,
  type PayoutLineView,
} from "./stripePayoutStore";
import { executeXeroPost, type XeroPostMemory } from "./stripePayoutXero";
import { readXeroAccount, readXeroInvoice, xeroAccounting } from "./stripePayoutXeroAdapter";

const MIGRATION_MESSAGE = "Stripe payouts are not ready yet. The database migration has not been applied.";

function pgCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const rec = error as { code?: unknown; cause?: unknown };
  if (typeof rec.code === "string") return rec.code;
  return pgCode(rec.cause);
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const rec = error as { message?: unknown; cause?: unknown };
  const own = typeof rec.message === "string" ? rec.message : "";
  return `${own} ${errorText(rec.cause)}`;
}

function schemaMissing(error: unknown): boolean {
  const code = pgCode(error);
  if (code === "42P01" || code === "42703") return true;
  const text = errorText(error);
  return /stripe_payouts|stripe_payout_lines|stripe_clearing_account_code|stripe_fees_account_code/.test(text)
    && /does not exist|undefined_column|undefined_table/i.test(text);
}

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Request failed";
  return raw
    .replace(/\b(sk|rk)_(live|test)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "[redacted]")
    .slice(0, 400);
}

function lineKind(kind: string): PayoutLineKind {
  if (kind === "charge" || kind === "refund" || kind === "fee" || kind === "other") return kind;
  return "other";
}

function dollars(value: string | null | undefined): number {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

async function requirePayoutAdmin(req: Request, res: Response): Promise<string | null> {
  const employeeId = req.session.employeeId;
  if (!employeeId) {
    res.status(403).json({ success: false, message: "Admin access required" });
    return null;
  }
  const employee = await storage.getEmployee(employeeId);
  if (!employee || employee.role !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" });
    return null;
  }
  const businessId = req.session.businessId || employee.businessId || currentBusinessId();
  if (!businessId) {
    res.status(403).json({ success: false, message: "Your account is not linked to a company." });
    return null;
  }
  return businessId;
}

async function accountContext(businessId: string): Promise<{
  stripeMode: "connect" | "platform" | "none";
  stripeModeMessage: string | null;
  xeroConnected: boolean;
  clearingAccountCode: string;
  feesAccountCode: string | null;
}> {
  const [settings, xeroSettings, xero] = await Promise.all([
    storage.getBusinessSettingsForBusiness(businessId),
    storage.getXeroSettings(),
    storage.getActiveXeroConnection(),
  ]);
  const resolved = resolvePayoutStripeAccount({
    stripeConnectAccountId: settings?.stripeConnectAccountId,
    ownsPlatformAccount: businessOwnsStripeAccount(businessId),
  });
  const stripeMode = "error" in resolved ? "none" : resolved.stripeAccountId ? "connect" : "platform";
  return {
    stripeMode,
    stripeModeMessage: "error" in resolved ? resolved.error : stripeMode === "platform"
      ? "These payouts come from the platform Stripe account. Charges that are not job payments, including Inflow subscription charges, stay unmatched and are not posted to Xero."
      : null,
    xeroConnected: !!xero,
    clearingAccountCode: parseAccountCode(xeroSettings?.stripeClearingAccountCode) ?? STRIPE_CLEARING_ACCOUNT,
    feesAccountCode: parseAccountCode(xeroSettings?.stripeFeesAccountCode ?? "") ,
  };
}

function sendError(res: Response, error: unknown, fallback: string): void {
  if (schemaMissing(error)) {
    res.status(503).json({ success: false, message: MIGRATION_MESSAGE });
    return;
  }
  if (error instanceof PayoutSyncError) {
    res.status(400).json({ success: false, message: safeMessage(error) });
    return;
  }
  const message = safeMessage(error);
  console.error(fallback, message);
  const show = /xero|account|invoice|payment|stripe/i.test(message) ? message : fallback;
  res.status(500).json({ success: false, message: show });
}

export function registerStripePayoutRoutes(app: Express): void {
  app.get("/api/stripe-payouts", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    try {
      const [payouts, context] = await Promise.all([
        listStripePayouts(businessId),
        accountContext(businessId),
      ]);
      res.json({ success: true, payouts, ...context });
    } catch (error) {
      sendError(res, error, "Could not load Stripe payouts.");
    }
  });

  app.post("/api/stripe-payouts/sync", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    const requested = Number(req.body?.limit);
    const limit = Number.isFinite(requested) ? requested : 15;
    try {
      const result = await syncStripePayoutsForBusiness(businessId, limit);
      const payouts = await listStripePayouts(businessId);
      res.json({ success: true, ...result, payouts });
    } catch (error) {
      if (error instanceof PayoutSyncError) {
        res.status(400).json({ success: false, message: safeMessage(error) });
        return;
      }
      if (schemaMissing(error)) {
        res.status(503).json({ success: false, message: MIGRATION_MESSAGE });
        return;
      }
      console.error("Stripe payout sync failed:", safeMessage(error));
      res.status(502).json({ success: false, message: safeMessage(error) || "Stripe did not return payouts." });
    }
  });

  app.put("/api/stripe-payouts/settings", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    const clearing = parseAccountCode(req.body?.clearingAccountCode);
    if (!clearing) {
      res.status(400).json({ success: false, message: "Enter a clearing account code such as 640." });
      return;
    }
    const rawFees = req.body?.feesAccountCode;
    let fees: string | null = null;
    if (rawFees != null && String(rawFees).trim() !== "") {
      fees = parseAccountCode(rawFees);
      if (!fees) {
        res.status(400).json({ success: false, message: "The fees account code is not valid." });
        return;
      }
    }
    try {
      await storage.updateXeroSettings({
        stripeClearingAccountCode: clearing,
        stripeFeesAccountCode: fees,
      });
      res.json({ success: true, clearingAccountCode: clearing, feesAccountCode: fees });
    } catch (error) {
      sendError(res, error, "Could not save the Xero account codes.");
    }
  });

  app.get("/api/stripe-payouts/:id", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    try {
      const payout = await getStripePayout(businessId, req.params.id);
      if (!payout) {
        res.status(404).json({ success: false, message: "Payout not found." });
        return;
      }
      const [lines, context] = await Promise.all([
        listStripePayoutLines(businessId, payout.id),
        accountContext(businessId),
      ]);
      res.json({ success: true, payout, lines, ...context });
    } catch (error) {
      sendError(res, error, "Could not load this payout.");
    }
  });

  app.post("/api/stripe-payouts/:id/xero-preview", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    try {
      const built = await buildPlan(businessId, req.params.id);
      if (!built.ok) {
        res.status(built.status).json({ success: false, message: built.message });
        return;
      }
      res.json({
        success: true,
        plan: built.plan,
        accountProblem: built.accountProblem,
        clearingIsBank: built.clearingIsBank,
        clearingAccountCode: built.clearingAccountCode,
        feesAccountCode: built.feesAccountCode,
        needsFeesAccount: !!built.plan.fee && !built.plan.fee.alreadyPosted && !built.feesAccountCode,
      });
    } catch (error) {
      sendError(res, error, "Could not preview the Xero post.");
    }
  });

  app.post("/api/stripe-payouts/:id/xero", async (req, res) => {
    const businessId = await requirePayoutAdmin(req, res);
    if (!businessId) return;
    if (req.body?.confirm !== true) {
      res.status(400).json({ success: false, message: "Confirm the Xero post before it runs." });
      return;
    }
    let locked = false;
    let payoutId = "";
    try {
      const payout = await getStripePayout(businessId, req.params.id);
      if (!payout) {
        res.status(404).json({ success: false, message: "Payout not found." });
        return;
      }
      payoutId = payout.id;
      locked = await tryLockStripePayout(businessId, payout.id);
      if (!locked) {
        res.status(409).json({ success: false, message: "A post to Xero is already running for this payout. Wait a moment and try again." });
        return;
      }
      const built = await buildPlan(businessId, payout.id);
      if (!built.ok) {
        res.status(built.status).json({ success: false, message: built.message });
        return;
      }
      if (built.plan.currencyBlocked) {
        res.status(400).json({ success: false, message: built.plan.currencyBlocked });
        return;
      }
      if (built.accountProblem) {
        res.status(400).json({ success: false, message: built.accountProblem });
        return;
      }
      if (built.plan.fee && !built.plan.fee.alreadyPosted && !built.feesAccountCode) {
        res.status(400).json({ success: false, message: "Enter the Stripe fees expense account before posting." });
        return;
      }
      const xeroSettings = await storage.getXeroSettings();
      const memory: XeroPostMemory = {
        payment: (lineId, xeroPaymentId, message) => savePayoutLineXero(businessId, lineId, {
          xeroPaymentId,
          xeroStatus: "posted",
          xeroMessage: message,
        }),
        refund: (lineId, creditNoteId, xeroPaymentId, message) => savePayoutLineXero(businessId, lineId, {
          xeroCreditNoteId: creditNoteId || null,
          xeroRefundPaymentId: xeroPaymentId,
          xeroStatus: "posted",
          xeroMessage: message,
        }),
        fee: (xeroId, kind, message) => savePayoutXero(businessId, payout.id, {
          xeroFeeId: xeroId,
          xeroFeeKind: kind,
          xeroFeeMessage: message,
        }),
        lineMessage: (lineId, status, message) => savePayoutLineXero(businessId, lineId, {
          xeroStatus: status,
          xeroMessage: message,
        }),
      };
      const results = await executeXeroPost({
        accounting: built.accounting,
        plan: built.plan,
        date: getNZDateString(payout.arrivalDate ?? new Date()),
        clearingAccountCode: built.clearingAccountCode,
        feesAccountCode: built.feesAccountCode ?? "",
        salesAccountCode: xeroSettings?.salesAccountCode || "200",
        salesTaxType: xeroSettings?.taxType || "OUTPUT2",
        clearingIsBank: built.clearingIsBank,
        memory,
      });
      const errors = results.filter((line) => line.status === "error");
      await savePayoutXero(businessId, payout.id, {
        xeroSummary: results,
        ...(errors.length === 0 ? { xeroPostedAt: new Date() } : {}),
      });
      res.json({
        success: errors.length === 0,
        results,
        clearing: built.plan.clearing,
        message: errors[0]?.message,
      });
    } catch (error) {
      sendError(res, error, "Could not post this payout to Xero.");
    } finally {
      if (locked && payoutId) {
        await unlockStripePayout(businessId, payoutId).catch((unlockErr: unknown) => {
          console.error("Stripe payout Xero unlock failed:", safeMessage(unlockErr));
        });
      }
    }
  });
}

type BuiltPlan =
  | {
      ok: true;
      plan: ReturnType<typeof planXeroPost>;
      accountProblem: string | null;
      clearingIsBank: boolean;
      clearingAccountCode: string;
      feesAccountCode: string | null;
      accounting: ReturnType<typeof xeroAccounting>;
    }
  | { ok: false; status: number; message: string };

async function buildPlan(businessId: string, payoutId: string): Promise<BuiltPlan> {
  const payout = await getStripePayout(businessId, payoutId);
  if (!payout) return { ok: false, status: 404, message: "Payout not found." };
  const connection = await storage.getActiveXeroConnection();
  const client = await getConnectedXeroClient();
  if (!connection || !client) {
    return { ok: false, status: 400, message: "Connect Xero before posting payouts." };
  }
  const tenantId = connection.tenantId;
  const context = await accountContext(businessId);
  const lines = await listStripePayoutLines(businessId, payout.id);
  const account = await readXeroAccount(client, tenantId, context.clearingAccountCode);
  const accountProblem = clearingAccountProblem(context.clearingAccountCode, account);
  const invoiceIds = [...new Set(lines.map((line) => line.xeroInvoiceId).filter((id): id is string => !!id))];
  const invoices = new Map<string, { status: string | null; amountDue: number | null }>();
  for (const invoiceId of invoiceIds) {
    invoices.set(invoiceId, await readXeroInvoice(client, tenantId, invoiceId));
  }
  const postable: PostableLine[] = lines.map((line) => toPostable(line, invoices.get(line.xeroInvoiceId ?? "")));
  const plan = planXeroPost({
    stripePayoutId: payout.stripePayoutId,
    payoutDollars: dollars(payout.amount),
    currency: payout.currency,
    lines: postable,
    feeAlreadyPosted: !!payout.xeroFeeId,
  });
  return {
    ok: true,
    plan,
    accountProblem,
    clearingIsBank: clearingAccountIsBank(account),
    clearingAccountCode: context.clearingAccountCode,
    feesAccountCode: context.feesAccountCode,
    accounting: xeroAccounting(client, tenantId),
  };
}

function toPostable(
  line: PayoutLineView,
  xero: { status: string | null; amountDue: number | null } | undefined,
): PostableLine {
  const kind = lineKind(line.kind);
  return {
    lineId: line.id,
    kind,
    amount: dollars(line.amount),
    fee: dollars(line.fee),
    net: dollars(line.net),
    matched: line.matchStatus === "matched",
    xeroInvoiceId: line.xeroInvoiceId,
    xeroStatus: xero?.status ?? null,
    amountDue: xero?.amountDue ?? null,
    xeroPaymentId: line.xeroPaymentId,
    xeroRefundPaymentId: line.xeroRefundPaymentId,
    jobNumber: line.jobNumber,
    invoiceNumber: line.invoiceNumber,
    stripeSourceId: line.stripeSourceId,
    balanceTransactionId: line.balanceTransactionId,
  };
}
