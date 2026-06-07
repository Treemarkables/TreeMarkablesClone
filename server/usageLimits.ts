/**
 * Inflow — usage-cap enforcement (the capacity layer of the tier matrix).
 *
 * Reads a business's per-tier caps from plan_limits (via tierMatrix.getBusinessLimits)
 * and checks current usage before an action. Countable dimensions (jobs/month, seats,
 * photos/job) are counted from existing tables; metered dimensions (SMS, AI per month)
 * use the usage_counters table, incremented after each successful use.
 *
 * Every check is a NO-OP unless ENTITLEMENT_ENFORCEMENT is on, and FAIL-OPEN on any
 * error — so wiring these into write paths never blocks a legit action due to the
 * enforcement layer. Each `*CapMessage` returns a user-facing string when the action
 * should be blocked, or null when it's allowed.
 */
import { db } from "./db";
import { and, eq, gte, sql } from "drizzle-orm";
import { jobs, employees, photos, usageCounters } from "@shared/schema";
import { getBusinessLimits } from "./tierMatrix";
import { getNZNow, nzTimeToUTC } from "@shared/dateUtils";

const enforce = (): boolean => process.env.ENTITLEMENT_ENFORCEMENT === "true";

/** Run a cap check only when enforcement is on, fail-open on any error. */
async function guard(fn: () => Promise<string | null>): Promise<string | null> {
  if (!enforce()) return null;
  try {
    return await fn();
  } catch (e) {
    console.error("usage-cap check failed (allowing action):", (e as Error)?.message);
    return null;
  }
}

/** "YYYY-MM" for the current Pacific/Auckland month. */
function nzMonthKey(): string {
  const now = getNZNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** UTC instant of the first day of the current NZ calendar month (for createdAt compares). */
function nzMonthStartUTC(): Date {
  return nzTimeToUTC(`${nzMonthKey()}-01`, "00:00");
}

async function countRows(table: any, where: any): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(table).where(where);
  return Number(r?.n ?? 0);
}

// ── Countable dimensions ─────────────────────────────────────────────────────
export function jobCapMessage(businessId: string): Promise<string | null> {
  return guard(async () => {
    const cap = (await getBusinessLimits(businessId)).activeJobs;
    if (cap === null) return null;
    const used = await countRows(jobs, and(eq(jobs.businessId, businessId), gte(jobs.createdAt, nzMonthStartUTC())));
    return used >= cap
      ? `You've hit your plan's limit of ${cap} jobs this month. Existing jobs stay open — upgrade to create more.`
      : null;
  });
}

export function seatCapMessage(businessId: string): Promise<string | null> {
  return guard(async () => {
    const cap = (await getBusinessLimits(businessId)).seats;
    if (cap === null) return null;
    const used = await countRows(employees, and(eq(employees.businessId, businessId), eq(employees.isActive, true)));
    return used >= cap
      ? `Your plan includes ${cap} user${cap === 1 ? "" : "s"}. Upgrade to add more of your team.`
      : null;
  });
}

export function photoCapMessage(businessId: string, jobId: string, adding = 1): Promise<string | null> {
  return guard(async () => {
    const cap = (await getBusinessLimits(businessId)).photosPerJob;
    if (cap === null) return null;
    const used = await countRows(photos, eq(photos.jobId, jobId));
    return used + adding > cap ? `Your plan allows ${cap} photos per job. Upgrade for unlimited photos.` : null;
  });
}

// ── Metered dimensions (monthly counters) ────────────────────────────────────
async function monthlyUsage(businessId: string, metric: string): Promise<number> {
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.businessId, businessId), eq(usageCounters.metric, metric), eq(usageCounters.period, nzMonthKey())));
  return row?.count ?? 0;
}

async function bumpUsage(businessId: string, metric: string, by = 1): Promise<void> {
  await db
    .insert(usageCounters)
    .values({ businessId, metric, period: nzMonthKey(), count: by })
    .onConflictDoUpdate({
      target: [usageCounters.businessId, usageCounters.metric, usageCounters.period],
      set: { count: sql`${usageCounters.count} + ${by}` },
    });
}

function meteredCapMessage(businessId: string, metric: "sms" | "ai", limitKey: string, adding: number): Promise<string | null> {
  return guard(async () => {
    const cap = (await getBusinessLimits(businessId))[limitKey];
    if (cap === null) return null;
    const used = await monthlyUsage(businessId, metric);
    return used + adding > cap
      ? `You've used your monthly allowance (${cap}). It resets on the 1st — upgrade or add a top-up for more.`
      : null;
  });
}

export const smsCapMessage = (businessId: string, adding = 1) => meteredCapMessage(businessId, "sms", "smsPerMonth", adding);
export const aiCapMessage = (businessId: string) => meteredCapMessage(businessId, "ai", "aiPerMonth", 1);

/** Record usage AFTER a successful action (only counts when enforcement is on). Best-effort. */
export async function recordSmsUsage(businessId: string, n = 1): Promise<void> {
  if (!enforce() || !businessId) return;
  try { await bumpUsage(businessId, "sms", n); } catch (e) { console.error("sms usage bump failed:", (e as Error)?.message); }
}
export async function recordAiUsage(businessId: string): Promise<void> {
  if (!enforce() || !businessId) return;
  try { await bumpUsage(businessId, "ai", 1); } catch (e) { console.error("ai usage bump failed:", (e as Error)?.message); }
}

/**
 * Combined AI gate middleware: blocks when over the monthly AI cap and records a use
 * on the way through. Mount after requireCapability on AI routes. No-op when the flag
 * is off. (Counts at entry, so a downstream failure may slightly over-count — fine for
 * a fair-use meter.)
 */
export function aiUsageGate() {
  return async (req: any, res: any, next: any): Promise<void> => {
    const businessId = req.session?.businessId;
    if (!enforce() || !businessId) {
      next();
      return;
    }
    const msg = await aiCapMessage(businessId);
    if (msg) {
      res.status(403).json({ success: false, message: msg });
      return;
    }
    await recordAiUsage(businessId);
    next();
  };
}
