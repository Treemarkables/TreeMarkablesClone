/**
 * Exc-GST revenue used by the Despatch day bar.
 *
 * Per-day share of a job's price. Multi-day jobs render in N day cells, so the
 * price is divided by the number of NZ days the job actually runs (scheduledDates
 * when that set is non-empty, otherwise scheduledDate..scheduledEndDate).
 *
 * Hierarchy: line items (ex GST) → subtotal → totalIncludingGst / 1.15 →
 * totalAmount / 1.15. Accepted proposals often have line items and no rolled-up
 * subtotal; skipping line items made those jobs contribute $0 to the bar.
 */
import { getJobScheduledNZDates, getNZDateString, jobRunsOnNZDate, type JobScheduleLike } from "./dateUtils";

export const REVENUE_EXCLUDE = new Set(["archived", "unsuccessful", "cancelled", "quote", "lead"]);

export interface RevenueLineItem {
  totalExGst?: unknown;
  priceExGst?: unknown;
  quantity?: unknown;
  total?: unknown;
  [key: string]: unknown;
}

export interface RevenueJob extends JobScheduleLike {
  id: string;
  status: string;
  subtotal?: string | number | null;
  totalIncludingGst?: string | number | null;
  totalAmount?: string | number | null;
  lineItems?: readonly RevenueLineItem[] | null;
}

export interface RevenueAssignment {
  jobId: string;
  startTime: Date | string;
}

function toNum(value: unknown): number {
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return 0;
}

function parseMoney(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  return toNum(value);
}

/** Full exc-GST price of the job, before splitting across booked days. */
export function jobQuoteExGst(job: Omit<RevenueJob, "id" | "status">): number {
  const lineItems = job.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const lineItemsTotal = lineItems.reduce((sum, item) => {
      const exGst =
        toNum(item.totalExGst) ||
        (item.priceExGst != null ? toNum(item.priceExGst) * toNum(item.quantity || 1) : 0);
      return sum + (exGst || toNum(item.total));
    }, 0);
    if (lineItemsTotal > 0) return Math.round(lineItemsTotal * 100) / 100;
  }
  const sub = parseMoney(job.subtotal);
  if (sub > 0) return sub;
  const incGst = parseMoney(job.totalIncludingGst);
  if (incGst > 0) return Math.round((incGst / 1.15) * 100) / 100;
  const total = parseMoney(job.totalAmount);
  if (total > 0) return Math.round((total / 1.15) * 100) / 100;
  return 0;
}

/** Day cells a job renders in (minimum 1). Matches getJobScheduledNZDates. */
export function jobDayCount(job: JobScheduleLike): number {
  if (!job.scheduledDate) return 1;
  return Math.max(1, getJobScheduledNZDates(job).length);
}

/** Per-day exc-GST share shown on the Despatch revenue bar. */
export function jobRevenue(job: Omit<RevenueJob, "id" | "status">): number {
  return jobQuoteExGst(job) / jobDayCount(job);
}

/**
 * Scheduled exc-GST revenue for one NZ date.
 * Same set as Despatch `revenueForDate`: staff assignments whose start falls on
 * that NZ day, plus jobs with a scheduledDate that run that day and have no
 * assignment already counted. Quotes, leads, and other REVENUE_EXCLUDE statuses
 * are left out. Each job is counted once.
 */
export function scheduledRevenueExGstForNzDate(
  jobs: readonly RevenueJob[],
  assignments: readonly RevenueAssignment[],
  nzDate: string,
): number {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const seen = new Set<string>();
  let sum = 0;

  const add = (job: RevenueJob) => {
    if (seen.has(job.id) || REVENUE_EXCLUDE.has(job.status)) return;
    seen.add(job.id);
    sum += jobRevenue(job);
  };

  for (const assignment of assignments) {
    if (getNZDateString(assignment.startTime) !== nzDate) continue;
    const job = byId.get(assignment.jobId);
    if (!job || job.status === "archived" || job.status === "unsuccessful") continue;
    add(job);
  }

  for (const job of jobs) {
    if (seen.has(job.id) || REVENUE_EXCLUDE.has(job.status) || !job.scheduledDate) continue;
    if (jobRunsOnNZDate(job, nzDate)) add(job);
  }

  return sum;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
