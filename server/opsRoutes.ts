/**
 * Database-backed Ops routes. Every read and write is filtered by the business
 * id resolved in opsAccess — never by a client-supplied tenant id, and never
 * via the unscoped owner query helpers.
 */
import type { Express, Request } from "express";
import { and, eq, gte, inArray, isNotNull, lte, notInArray, or, sql } from "drizzle-orm";
import { DAILY_REVENUE_TARGET_GST_LABEL, parseDailyRevenueTarget } from "@shared/dailyRevenueTarget";
import { getNZDateString, nzTimeToUTC } from "@shared/dateUtils";
import { REVENUE_EXCLUDE, type RevenueJob } from "@shared/dispatchRevenue";
import {
  addIsoDays,
  buildUnscheduledList,
  buildWeekRevenue,
  collectAssignedTeamIds,
  nzWeekContaining,
  OPS_CURRENCY,
  UNSCHEDULED_LIMIT,
  type UnscheduledSourceJob,
} from "@shared/opsSchedule";
import * as schema from "@shared/schema";
import { APP_URL } from "./config/appUrl";
import { ownerDb } from "./db";
import { mountOpsRoutes, type OpsDeps, type UnscheduledPayload } from "./opsHandlers";
import { resolveOpsAccess, type OpsApiKey, type OpsEmployee } from "./opsAccess";
import { storage } from "./storage";

function appBase(): string {
  return APP_URL.replace(/\/$/, "");
}

function pageLinks() {
  const base = appBase();
  return {
    dispatch: `${base}/dispatch`,
    settingsPreferences: `${base}/settings/preferences`,
  };
}

async function lookupEmployee(id: string): Promise<OpsEmployee | undefined> {
  const [employee] = await ownerDb
    .select({
      id: schema.employees.id,
      role: schema.employees.role,
      businessId: schema.employees.businessId,
    })
    .from(schema.employees)
    .where(eq(schema.employees.id, id))
    .limit(1);
  return employee;
}

async function lookupApiKey(keyHash: string): Promise<OpsApiKey | undefined> {
  const [apiKey] = await ownerDb
    .select({
      id: schema.apiKeys.id,
      businessId: schema.apiKeys.businessId,
      isActive: schema.apiKeys.isActive,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);
  return apiKey;
}

async function touchApiKey(id: string): Promise<void> {
  await ownerDb
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, id));
}

const unscheduledColumns = {
  id: schema.jobs.id,
  jobNumber: schema.jobs.jobNumber,
  title: schema.jobs.title,
  description: schema.jobs.description,
  address: schema.jobs.address,
  status: schema.jobs.status,
  subtotal: schema.jobs.subtotal,
  totalIncludingGst: schema.jobs.totalIncludingGst,
  totalAmount: schema.jobs.totalAmount,
  lineItems: schema.jobs.lineItems,
  equipment: schema.jobs.equipment,
  internalNotes: schema.jobs.internalNotes,
  estimatedManHours: schema.jobs.estimatedManHours,
  assignedTeam: schema.jobs.assignedTeam,
  assignedTo: schema.jobs.assignedTo,
  assignedStaffIds: schema.jobs.assignedStaffIds,
  customerConfirmed: schema.jobs.customerConfirmed,
  scheduledDate: schema.jobs.scheduledDate,
  scheduledEndDate: schema.jobs.scheduledEndDate,
  scheduledDates: schema.jobs.scheduledDates,
  workOrderAt: schema.jobs.workOrderAt,
};

async function employeeNames(businessId: string, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const rows = await ownerDb
    .select({
      id: schema.employees.id,
      firstName: schema.employees.firstName,
      lastName: schema.employees.lastName,
    })
    .from(schema.employees)
    .where(and(eq(schema.employees.businessId, businessId), inArray(schema.employees.id, ids)));
  for (const row of rows) {
    const name = `${row.firstName} ${row.lastName}`.trim();
    if (name) names.set(row.id, name);
  }
  return names;
}

async function listUnscheduled(businessId: string, todayNz: string): Promise<UnscheduledPayload> {
  const rows = await ownerDb
    .select(unscheduledColumns)
    .from(schema.jobs)
    .where(and(eq(schema.jobs.businessId, businessId), eq(schema.jobs.status, "work_order")));

  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of collectAssignedTeamIds(row)) ids.add(id);
  }
  const names = await employeeNames(businessId, Array.from(ids));
  const base = appBase();
  const jobs = buildUnscheduledList(rows, names, todayNz, (jobId) => (
    `${base}/dispatch?job=${encodeURIComponent(jobId)}`
  ));
  const truncated = jobs.length > UNSCHEDULED_LIMIT;
  return {
    todayNz,
    currency: OPS_CURRENCY,
    gstLabel: DAILY_REVENUE_TARGET_GST_LABEL,
    total: jobs.length,
    truncated,
    limit: UNSCHEDULED_LIMIT,
    jobs: truncated ? jobs.slice(0, UNSCHEDULED_LIMIT) : jobs,
    links: pageLinks(),
  };
}

async function weekRevenue(businessId: string, anchor: string) {
  const week = nzWeekContaining(anchor);
  if (!week) {
    throw new Error("week anchor failed validation");
  }
  const slackStart = new Date(nzTimeToUTC(addIsoDays(week.weekStart, -1), "00:00").getTime());
  const slackEnd = new Date(nzTimeToUTC(addIsoDays(week.weekEnd, 2), "00:00").getTime());
  const assignments = await ownerDb
    .select({
      jobId: schema.jobStaffAssignments.jobId,
      startTime: schema.jobStaffAssignments.startTime,
    })
    .from(schema.jobStaffAssignments)
    .where(and(
      eq(schema.jobStaffAssignments.businessId, businessId),
      gte(schema.jobStaffAssignments.startTime, slackStart),
      lte(schema.jobStaffAssignments.startTime, slackEnd),
    ));

  const assignmentJobIds = Array.from(new Set(assignments.map((row) => row.jobId)));
  const dateClauses = week.dates.map((date) => (
    sql`${schema.jobs.scheduledDates} @> ${JSON.stringify([date])}::jsonb`
  ));
  const jobs = await ownerDb
    .select({
      id: schema.jobs.id,
      status: schema.jobs.status,
      subtotal: schema.jobs.subtotal,
      totalIncludingGst: schema.jobs.totalIncludingGst,
      totalAmount: schema.jobs.totalAmount,
      lineItems: schema.jobs.lineItems,
      scheduledDate: schema.jobs.scheduledDate,
      scheduledEndDate: schema.jobs.scheduledEndDate,
      scheduledDates: schema.jobs.scheduledDates,
    })
    .from(schema.jobs)
    .where(and(
      eq(schema.jobs.businessId, businessId),
      notInArray(schema.jobs.status, Array.from(REVENUE_EXCLUDE)),
      or(
        and(
          isNotNull(schema.jobs.scheduledDate),
          lte(schema.jobs.scheduledDate, slackEnd),
          gte(sql`COALESCE(${schema.jobs.scheduledEndDate}, ${schema.jobs.scheduledDate})`, slackStart),
        ),
        ...dateClauses,
        ...(assignmentJobIds.length > 0 ? [inArray(schema.jobs.id, assignmentJobIds)] : []),
      ),
    ));

  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const revenueJobs: RevenueJob[] = jobs;
  const payload = buildWeekRevenue({
    jobs: revenueJobs,
    assignments,
    anchor,
    dailyRevenueTarget: settings?.dailyRevenueTarget,
    links: pageLinks(),
  });
  if (!payload) throw new Error("week anchor failed validation");
  return payload;
}

async function getDailyRevenueTarget(businessId: string): Promise<number | null> {
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  return parseDailyRevenueTarget(settings?.dailyRevenueTarget);
}

async function setDailyRevenueTarget(businessId: string, amount: number): Promise<number | null> {
  const existing = await storage.getBusinessSettingsForBusiness(businessId);
  if (!existing) return null;
  const updated = await storage.updateBusinessSettingsForBusiness(businessId, {
    dailyRevenueTarget: amount.toFixed(2),
  });
  return parseDailyRevenueTarget(updated?.dailyRevenueTarget);
}

function realDeps(): OpsDeps {
  return {
    resolveAccess: (req: Request) => resolveOpsAccess({
      sessionEmployeeId: req.session?.employeeId,
      sessionBusinessId: req.session?.businessId,
      authorizationHeader: req.header("authorization"),
      lookupEmployee,
      lookupApiKey,
      touchApiKey,
    }),
    todayNz: () => getNZDateString(new Date()),
    appUrl: APP_URL,
    listUnscheduled,
    weekRevenue,
    getDailyRevenueTarget,
    setDailyRevenueTarget,
  };
}

export function registerOpsRoutes(app: Express): void {
  mountOpsRoutes(app, realDeps());
}
