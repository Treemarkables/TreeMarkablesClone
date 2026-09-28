/**
 * Thin JSON routes for the Inflow Ops bot. Data loading stays in opsRoutes.ts
 * so these handlers can be tested without a database.
 */
import type { Express, Request, Response } from "express";
import { DAILY_REVENUE_TARGET_GST_LABEL } from "@shared/dailyRevenueTarget";
import {
  nzWeekContaining,
  OPS_CURRENCY,
  readDailyRevenueTargetInput,
  type OpsLinks,
  type OpsUnscheduledJob,
  type OpsWeekRevenue,
} from "@shared/opsSchedule";
import type { OpsAccess } from "./opsAccess";

export interface UnscheduledPayload {
  todayNz: string;
  currency: typeof OPS_CURRENCY;
  gstLabel: typeof DAILY_REVENUE_TARGET_GST_LABEL;
  total: number;
  truncated: boolean;
  limit: number;
  jobs: OpsUnscheduledJob[];
  links: OpsLinks;
}

export interface TargetPayload {
  dailyRevenueTarget: number | null;
  currency: typeof OPS_CURRENCY;
  gstLabel: typeof DAILY_REVENUE_TARGET_GST_LABEL;
  links: { settingsPreferences: string };
}

export interface OpsQuoteFollowUp {
  id: string;
  quoteId: string;
  quoteNumber: string;
  jobId: string | null;
  customerName: string | null;
  kind: string;
  nudgeStep: number;
  channel: string;
  status: string;
  waiting: boolean;
  subject: string | null;
  message: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  requoteId: string | null;
  requoteNumber: string | null;
  snoozeUntil: string | null;
  links: { queue: string; job: string | null };
}

export interface OpsQuoteFollowUpList {
  waiting: number;
  followUps: OpsQuoteFollowUp[];
  links: { queue: string; settings: string };
}

export interface OpsFollowUpApproveResult {
  status: number;
  body: { success: boolean; message?: string };
}

export interface OpsInvoiceNotInXero {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  jobId: string | null;
  customerName: string | null;
  status: string;
  waiting: boolean;
  snoozeUntil: string | null;
  lastError: string | null;
  preview: {
    currency: "NZD";
    contact: { name: string; email: string | null; phone: string | null };
    invoiceNumber: string;
    reference: string | null;
    dueDate: string | null;
    statusInXero: "AUTHORISED";
    accountCode: string;
    taxType: string;
    gstRate: number;
    lineItems: {
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType: string;
      lineTotal: number;
    }[];
    subtotal: number;
    gst: number;
    total: number;
    blockingReason: string | null;
  };
  links: { queue: string; job: string | null };
}

export interface OpsInvoiceNotInXeroList {
  waiting: number;
  invoices: OpsInvoiceNotInXero[];
  links: { queue: string };
}

export interface OpsDeps {
  resolveAccess(req: Request): Promise<OpsAccess>;
  todayNz(): string;
  appUrl: string;
  listUnscheduled(businessId: string, todayNz: string): Promise<UnscheduledPayload>;
  weekRevenue(businessId: string, anchor: string): Promise<OpsWeekRevenue>;
  getDailyRevenueTarget(businessId: string): Promise<number | null>;
  setDailyRevenueTarget(businessId: string, amount: number): Promise<number | null>;
  listQuoteFollowUps(businessId: string): Promise<OpsQuoteFollowUpList>;
  updateQuoteFollowUpDraft(
    businessId: string,
    id: string,
    patch: { message?: unknown; subject?: unknown; channel?: unknown },
  ): Promise<OpsQuoteFollowUp | null>;
  approveQuoteFollowUp(businessId: string, id: string, confirm: true): Promise<OpsFollowUpApproveResult>;
  listInvoicesNotInXero(businessId: string): Promise<OpsInvoiceNotInXeroList>;
  syncInvoiceToXero(businessId: string, id: string, confirm: true): Promise<OpsFollowUpApproveResult>;
  listJobsNotBilled(businessId: string): Promise<{
    waiting: number;
    jobs: { id: string; jobId: string; jobNumber: string; step: string; links: { queue: string; job: string } }[];
    links: { queue: string };
  }>;
}

function links(appUrl: string): OpsLinks {
  const base = appUrl.replace(/\/$/, "");
  return {
    dispatch: `${base}/dispatch`,
    settingsPreferences: `${base}/settings/preferences`,
  };
}

function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

async function accessFor(
  deps: OpsDeps,
  req: Request,
  res: Response,
  write: boolean,
): Promise<Extract<OpsAccess, { ok: true }> | null> {
  const access = await deps.resolveAccess(req);
  if (!access.ok) {
    fail(res, access.status, access.message);
    return null;
  }
  if (write && !access.canSetDailyRevenueTarget) {
    fail(res, 403, "Admin access required");
    return null;
  }
  return access;
}

export function mountOpsRoutes(app: Express, deps: OpsDeps): void {
  const pageLinks = links(deps.appUrl);

  app.get("/api/ops/unscheduled", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const data = await deps.listUnscheduled(access.businessId, deps.todayNz());
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing unscheduled work orders:", error);
      fail(res, 500, "Error listing unscheduled work orders");
    }
  });

  app.get("/api/ops/week-revenue", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const requested = req.query.week;
      const anchor = typeof requested === "string" && requested.length > 0
        ? requested
        : deps.todayNz();
      if (!nzWeekContaining(anchor)) {
        fail(res, 400, "week must be a YYYY-MM-DD date in Pacific/Auckland");
        return;
      }
      const data = await deps.weekRevenue(access.businessId, anchor);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error reading week revenue:", error);
      fail(res, 500, "Error reading week revenue");
    }
  });

  app.get("/api/ops/daily-revenue-target", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const dailyRevenueTarget = await deps.getDailyRevenueTarget(access.businessId);
      const data: TargetPayload = {
        dailyRevenueTarget,
        currency: OPS_CURRENCY,
        gstLabel: DAILY_REVENUE_TARGET_GST_LABEL,
        links: { settingsPreferences: pageLinks.settingsPreferences },
      };
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error reading daily revenue target:", error);
      fail(res, 500, "Error reading daily revenue target");
    }
  });

  app.put("/api/ops/daily-revenue-target", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, true);
      if (!access) return;
      const body = req.body;
      if (body == null || typeof body !== "object" || Array.isArray(body)) {
        fail(res, 400, "Daily revenue target must be a positive NZD amount (exc. GST)");
        return;
      }
      const amount = readDailyRevenueTargetInput(
        (body as { dailyRevenueTarget?: unknown }).dailyRevenueTarget,
      );
      if (amount == null) {
        fail(res, 400, "Daily revenue target must be a positive NZD amount (exc. GST)");
        return;
      }
      const dailyRevenueTarget = await deps.setDailyRevenueTarget(access.businessId, amount);
      if (dailyRevenueTarget == null) {
        fail(res, 404, "Business settings are not set up yet");
        return;
      }
      const data: TargetPayload = {
        dailyRevenueTarget,
        currency: OPS_CURRENCY,
        gstLabel: DAILY_REVENUE_TARGET_GST_LABEL,
        links: { settingsPreferences: pageLinks.settingsPreferences },
      };
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error setting daily revenue target:", error);
      fail(res, 500, "Error setting daily revenue target");
    }
  });

  app.get("/api/ops/quote-follow-ups", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const data = await deps.listQuoteFollowUps(access.businessId);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing quote follow-ups:", error);
      fail(res, 500, "Error listing quote follow-ups");
    }
  });

  app.patch("/api/ops/quote-follow-ups/:id", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const body = req.body;
      if (body == null || typeof body !== "object" || Array.isArray(body)) {
        fail(res, 400, "Send a message, subject, or channel to update.");
        return;
      }
      const data = await deps.updateQuoteFollowUpDraft(access.businessId, req.params.id, body as {
        message?: unknown;
        subject?: unknown;
        channel?: unknown;
      });
      if (!data) {
        fail(res, 404, "Follow-up not found.");
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error editing quote follow-up:", error);
      const message = error instanceof Error ? error.message : "Error editing quote follow-up";
      const status = (error as { status?: number } | null)?.status;
      fail(res, typeof status === "number" ? status : 400, message);
    }
  });

  // Sends only when the body is { confirm: true }. The handler does not call
  // the approve dependency otherwise, so a read or a draft edit cannot send.
  app.post("/api/ops/quote-follow-ups/:id/approve", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const body = req.body;
      const confirm = body != null && typeof body === "object" && !Array.isArray(body)
        ? (body as { confirm?: unknown }).confirm
        : undefined;
      if (confirm !== true) {
        fail(res, 400, "Sending needs confirm: true. Nothing was sent.");
        return;
      }
      const result = await deps.approveQuoteFollowUp(access.businessId, req.params.id, true);
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error approving quote follow-up:", error);
      fail(res, 500, "Couldn't send the follow-up. Nothing was marked as sent.");
    }
  });

  app.get("/api/ops/invoices-not-in-xero", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const data = await deps.listInvoicesNotInXero(access.businessId);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing invoices not in Xero:", error);
      fail(res, 500, "Error listing invoices not in Xero");
    }
  });

  // Syncs only when the body is { confirm: true } and the caller is an admin.
  // The handler does not call the sync dependency otherwise.
  app.post("/api/ops/invoices-not-in-xero/:id/sync", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const body = req.body;
      const confirm = body != null && typeof body === "object" && !Array.isArray(body)
        ? (body as { confirm?: unknown }).confirm
        : undefined;
      if (confirm !== true) {
        fail(res, 400, "Syncing needs confirm: true. Nothing was sent to Xero.");
        return;
      }
      if (!access.canSetDailyRevenueTarget) {
        fail(res, 403, "Admin access required");
        return;
      }
      const result = await deps.syncInvoiceToXero(access.businessId, req.params.id, true);
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error syncing invoice to Xero:", error);
      fail(res, 500, "Couldn't sync to Xero. Nothing was marked as synced.");
    }
  });

  // Read only. Creating, sending, and syncing stay on the signed-in app screens.
  app.get("/api/ops/jobs-not-billed", async (req: Request, res: Response) => {
    try {
      const access = await accessFor(deps, req, res, false);
      if (!access) return;
      const data = await deps.listJobsNotBilled(access.businessId);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing jobs not billed:", error);
      fail(res, 500, "Error listing jobs not billed");
    }
  });
}
