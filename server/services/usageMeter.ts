/**
 * Inflow — usage metering + cap enforcement for SMS and AI (Phase B).
 *
 * Enforces the bundled monthly allowances in INFLOW_SAAS_PLAN.md (Crew 200 SMS / 75 AI,
 * Business 600 / 250). Counts an append-only `usage_events` log per NZ calendar month.
 *
 * DARK-LAUNCH DESIGN:
 *   - Recording usage (recordUsage) is ALWAYS on once deployed — accumulates real data.
 *   - checkAllowance ALWAYS reports whether a tenant is over cap, and callers log it.
 *   - Actual BLOCKING only happens when USAGE_CAPS_ENFORCE=true. Ship it off, watch the
 *     `USAGE_CAP_BLOCK ... enforced=false` log lines to see what *would* block, then flip on.
 *
 * FAIL-OPEN: any metering error allows the send/action (never block legit ops over a bug).
 *
 * AI is metered per *user-facing action* (1 Speech-to-Quote = 1, even though it makes
 * multiple OpenAI calls), NOT per token — see the plan.
 */
import { db } from "../db";
import { jobs, subscriptionPlans, subscriptions, usageEvents } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { getSubscriptionByBusiness, getPlanByKey } from "../billing";
import { nzTimeToUTC } from "@shared/dateUtils";
import { TREEMARKABLES_BUSINESS_IDS } from "@shared/roleChecklistAccess";

export type Metric = "sms" | "ai";

/** Only actually block when this is on. Off = record + log, never block. */
export const ENFORCE = process.env.USAGE_CAPS_ENFORCE === "true";

/** Businesses that are never capped (extra ones via comma-separated env). */
const COMPED = new Set(
  (process.env.INFLOW_COMPED_BUSINESS_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);

/**
 * Comped = never capped. The env list PLUS Treemarkables itself — TM is the platform
 * owner running Inflow, so it must never be throttled on its own product regardless of
 * whether INFLOW_COMPED_BUSINESS_IDS is set (avoids a footgun where flipping enforcement
 * on would cap the owner). Covers both the prod and dev-branch TM businessIds.
 */
function isComped(businessId: string): boolean {
  return COMPED.has(businessId) || TREEMARKABLES_BUSINESS_IDS.includes(businessId);
}

const ENTITLED = new Set(["active", "trialing", "past_due"]);

export interface Allowance {
  used: number;
  cap: number | null; // null = unlimited
  remaining: number;  // Infinity when unlimited
  blocked: boolean;   // used >= cap (only meaningful when cap !== null)
}

/** First instant of the current Pacific/Auckland calendar month, as a UTC Date. */
function nzMonthStartUtc(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  // nzTimeToUTC handles the +12/+13 DST offset for us.
  return nzTimeToUTC(`${y}-${m}-01`, "00:00");
}

/** Resolve the business's cap for a metric (null = unlimited) and its overage policy. */
async function resolveCap(metric: Metric, businessId: string): Promise<{ cap: number | null; overage: string }> {
  if (isComped(businessId)) return { cap: null, overage: "soft_stop" };

  const sub = await getSubscriptionByBusiness(businessId);
  let plan: typeof subscriptionPlans.$inferSelect | undefined;
  let overage = "soft_stop";
  if (sub && ENTITLED.has(sub.status) && sub.planId) {
    [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId));
    overage = (sub as any).overagePolicy ?? "soft_stop";
  }
  if (!plan) plan = await getPlanByKey("freemium");

  const cap = metric === "sms" ? plan?.smsCap : plan?.aiActionCap;
  return { cap: cap ?? null, overage };
}

/** Count this NZ-month's usage of a metric for a business. */
async function monthUsage(metric: Metric, businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)::int` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.businessId, businessId),
        eq(usageEvents.metric, metric),
        gte(usageEvents.createdAt, nzMonthStartUtc()),
      ),
    );
  return row?.n ?? 0;
}

/** Read-only: is this business over its cap for `metric` right now? Fail-open. */
export async function checkAllowance(metric: Metric, businessId: string): Promise<Allowance> {
  try {
    const { cap, overage } = await resolveCap(metric, businessId);
    if (cap === null) return { used: 0, cap: null, remaining: Infinity, blocked: false };
    const used = await monthUsage(metric, businessId);
    // 'metered' overage never soft-stops — it bills the overflow (Phase E). Today: allow.
    const blocked = overage !== "metered" && used >= cap;
    return { used, cap, remaining: Math.max(0, cap - used), blocked };
  } catch (e) {
    console.warn(`USAGE_METER_ERROR check metric=${metric} business=${businessId}: ${(e as Error)?.message}`);
    return { used: 0, cap: null, remaining: Infinity, blocked: false }; // fail-open
  }
}

/** Append a usage event (after a successful send/action). Best-effort, never throws. */
export async function recordUsage(
  metric: Metric,
  businessId: string,
  opts: { feature?: string; ref?: string; quantity?: number } = {},
): Promise<void> {
  try {
    await db.insert(usageEvents).values({
      businessId,
      metric,
      quantity: opts.quantity ?? 1,
      feature: opts.feature ?? null,
      ref: opts.ref ?? null,
    });
  } catch (e) {
    console.warn(`USAGE_METER_ERROR record metric=${metric} business=${businessId}: ${(e as Error)?.message}`);
  }
}

/**
 * Guard helper for a send/action: checks the cap, logs a structured line if over, and
 * returns whether the caller should proceed. Recording happens separately AFTER success
 * (so failed sends don't burn allowance). Returns true when the action may proceed.
 */
export async function guard(metric: Metric, businessId: string, feature?: string): Promise<boolean> {
  const a = await checkAllowance(metric, businessId);
  if (a.blocked) {
    console.warn(
      `USAGE_CAP_BLOCK metric=${metric} business=${businessId} feature=${feature ?? "-"} used=${a.used} cap=${a.cap} enforced=${ENFORCE}`,
    );
    if (ENFORCE) return false;
  }
  return true;
}

// ── Active-job cap (jobs CREATED per NZ calendar month) ─────────────────────
// Unlike SMS/AI this is counted from the jobs table itself (one row per job), not
// the usage_events log. "Active jobs / month" is interpreted as the number of jobs
// CREATED in the current NZ month (a monthly throughput allowance that resets) —
// Free 15, Crew 75, Business unlimited (activeJobCap = null). Same dark-launch +
// fail-open + comp rules as the SMS/AI meters.

/** Resolve the active-job cap for a business (null = unlimited). */
async function resolveJobCap(businessId: string): Promise<number | null> {
  if (isComped(businessId)) return null;
  const sub = await getSubscriptionByBusiness(businessId);
  let plan: typeof subscriptionPlans.$inferSelect | undefined;
  if (sub && ENTITLED.has(sub.status) && sub.planId) {
    [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId));
  }
  if (!plan) plan = await getPlanByKey("freemium");
  return plan?.activeJobCap ?? null;
}

/** Count jobs CREATED this NZ calendar month for a business. */
async function monthJobCount(businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.businessId, businessId), gte(jobs.createdAt, nzMonthStartUtc())));
  return row?.n ?? 0;
}

/** Read-only: is this business at/over its monthly job-creation cap? Fail-open. */
export async function checkJobAllowance(businessId: string): Promise<Allowance> {
  try {
    const cap = await resolveJobCap(businessId);
    if (cap === null) return { used: 0, cap: null, remaining: Infinity, blocked: false };
    const used = await monthJobCount(businessId);
    return { used, cap, remaining: Math.max(0, cap - used), blocked: used >= cap };
  } catch (e) {
    console.warn(`USAGE_METER_ERROR check metric=jobs business=${businessId}: ${(e as Error)?.message}`);
    return { used: 0, cap: null, remaining: Infinity, blocked: false }; // fail-open
  }
}

/**
 * Guard for job creation: logs a structured line when at/over cap and returns whether
 * creation may proceed. Returns false (block) ONLY when over cap AND USAGE_CAPS_ENFORCE
 * is on. Call this right before inserting a genuinely-new job.
 */
export async function guardJobCreation(businessId: string): Promise<boolean> {
  const a = await checkJobAllowance(businessId);
  if (a.blocked) {
    console.warn(
      `USAGE_CAP_BLOCK metric=jobs business=${businessId} used=${a.used} cap=${a.cap} enforced=${ENFORCE}`,
    );
    if (ENFORCE) return false;
  }
  return true;
}

/** For GET /api/billing/usage — all three meters + the period start. */
export async function getUsageSummary(businessId: string) {
  const [sms, ai, jobsAllowance] = await Promise.all([
    checkAllowance("sms", businessId),
    checkAllowance("ai", businessId),
    checkJobAllowance(businessId),
  ]);
  return {
    periodStart: nzMonthStartUtc().toISOString(),
    enforced: ENFORCE,
    sms: { used: sms.used, cap: sms.cap, remaining: sms.remaining },
    ai: { used: ai.used, cap: ai.cap, remaining: ai.remaining },
    jobs: { used: jobsAllowance.used, cap: jobsAllowance.cap, remaining: jobsAllowance.remaining },
  };
}
