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

export interface OpsDeps {
  resolveAccess(req: Request): Promise<OpsAccess>;
  todayNz(): string;
  appUrl: string;
  listUnscheduled(businessId: string, todayNz: string): Promise<UnscheduledPayload>;
  weekRevenue(businessId: string, anchor: string): Promise<OpsWeekRevenue>;
  getDailyRevenueTarget(businessId: string): Promise<number | null>;
  setDailyRevenueTarget(businessId: string, amount: number): Promise<number | null>;
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
}
