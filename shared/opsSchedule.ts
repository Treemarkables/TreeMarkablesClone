/**
 * Pure helpers for the Inflow Ops read APIs.
 * Unscheduled matches the Despatch Active Jobs rail. Week revenue matches the
 * Despatch day bar. The NZ week is Monday–Sunday (Staff Schedule), not the
 * Sunday-start grid Despatch happens to render.
 */
import { DAILY_REVENUE_TARGET_GST_LABEL, parseDailyRevenueTarget } from "./dailyRevenueTarget";
import { getJobScheduledNZDates, hasUpcomingBookingNZ, type JobScheduleLike } from "./dateUtils";
import {
  jobQuoteExGst,
  roundMoney,
  scheduledRevenueExGstForNzDate,
  type RevenueAssignment,
  type RevenueJob,
} from "./dispatchRevenue";

export const OPS_CURRENCY = "NZD";
export const OPS_TIMEZONE = "Pacific/Auckland";
export const OPS_WEEK_STARTS_ON = "monday";
export const DESCRIPTION_SNIPPET_MAX = 160;
export const INTERNAL_NOTES_MAX = 400;
export const UNSCHEDULED_LIMIT = 200;
export const MAX_DAILY_REVENUE_TARGET = 99_999_999.99;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface OpsLinks {
  dispatch: string;
  settingsPreferences: string;
}

export interface OpsAssignedPerson {
  id: string;
  name: string | null;
}

export interface OpsUnscheduledJob {
  id: string;
  jobNumber: string;
  title: string | null;
  descriptionSnippet: string | null;
  address: string | null;
  quoteExGst: number;
  equipment: string[];
  internalNotes: string | null;
  internalNotesTruncated: boolean;
  estimatedManHours: number | null;
  assignedTeam: OpsAssignedPerson[];
  lastBookingNzDate: string | null;
  customerConfirmed: boolean;
  links: { job: string };
}

export interface UnscheduledSourceJob extends RevenueJob {
  jobNumber: string;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  equipment?: string[] | null;
  internalNotes?: string | null;
  estimatedManHours?: string | number | null;
  assignedTeam?: string[] | null;
  assignedTo?: string[] | null;
  assignedStaffIds?: string[] | null;
  customerConfirmed?: boolean | null;
  workOrderAt?: Date | string | null;
}

export interface OpsWeekDay {
  date: string;
  scheduledRevenueExGst: number;
  /** dailyRevenueTarget − scheduledRevenueExGst. Positive means short of target. */
  gapToTarget: number | null;
}

export interface OpsWeekRevenue {
  currency: typeof OPS_CURRENCY;
  gstLabel: typeof DAILY_REVENUE_TARGET_GST_LABEL;
  timezone: typeof OPS_TIMEZONE;
  weekStartsOn: typeof OPS_WEEK_STARTS_ON;
  weekStart: string;
  weekEnd: string;
  dailyRevenueTarget: number | null;
  days: OpsWeekDay[];
  weekScheduledRevenueExGst: number;
  weekTarget: number | null;
  weekGapToTarget: number | null;
  links: OpsLinks;
}

export interface NzWeek {
  weekStart: string;
  weekEnd: string;
  dates: string[];
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

/** Monday–Sunday NZ calendar week containing `anchor` (YYYY-MM-DD). */
export function nzWeekContaining(anchor: string): NzWeek | null {
  if (!ISO_DATE.test(anchor)) return null;
  const [year, month, day] = anchor.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (utc.toISOString().slice(0, 10) !== anchor) return null;
  const weekday = utc.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addIsoDays(anchor, mondayOffset);
  const dates = Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index));
  return { weekStart, weekEnd: dates[6], dates };
}

/** Despatch Unscheduled: status work_order and no booking on today or later (NZ). */
export function isUnscheduledWorkOrder(
  job: JobScheduleLike & { status: string },
  todayNZ: string,
): boolean {
  return job.status === "work_order" && !hasUpcomingBookingNZ(job, todayNZ);
}

/** Last booked NZ day when that day is already in the past. Otherwise null. */
export function lastPastBookingNzDate(job: JobScheduleLike, todayNZ: string): string | null {
  const dates = getJobScheduledNZDates(job);
  if (dates.length === 0) return null;
  const last = dates[dates.length - 1];
  return last < todayNZ ? last : null;
}

export function collectAssignedTeamIds(job: {
  assignedTeam?: string[] | null;
  assignedTo?: string[] | null;
  assignedStaffIds?: string[] | null;
}): string[] {
  const ids = [
    ...(job.assignedTeam ?? []),
    ...(job.assignedTo ?? []),
    ...(job.assignedStaffIds ?? []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function textSnippet(
  value: string | null | undefined,
  max: number,
): { text: string | null; truncated: boolean } {
  if (typeof value !== "string") return { text: null, truncated: false };
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return { text: null, truncated: false };
  if (collapsed.length <= max) return { text: collapsed, truncated: false };
  return { text: `${collapsed.slice(0, max - 3).trimEnd()}...`, truncated: true };
}

function cleanTags(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function decimalOrNull(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function sortTime(value: Date | string | null | undefined): number {
  if (value == null || value === "") return Number.POSITIVE_INFINITY;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function toUnscheduledJob(
  job: UnscheduledSourceJob,
  nameById: ReadonlyMap<string, string>,
  todayNZ: string,
  jobUrl: string,
): OpsUnscheduledJob | null {
  if (!isUnscheduledWorkOrder(job, todayNZ)) return null;
  const notes = textSnippet(job.internalNotes, INTERNAL_NOTES_MAX);
  const description = textSnippet(job.description, DESCRIPTION_SNIPPET_MAX);
  const title = typeof job.title === "string" ? job.title.trim() : "";
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: title || null,
    descriptionSnippet: description.text,
    address: typeof job.address === "string" && job.address.trim() ? job.address.trim() : null,
    quoteExGst: roundMoney(jobQuoteExGst(job)),
    equipment: cleanTags(job.equipment),
    internalNotes: notes.text,
    internalNotesTruncated: notes.truncated,
    estimatedManHours: decimalOrNull(job.estimatedManHours),
    assignedTeam: collectAssignedTeamIds(job).map((id) => ({
      id,
      name: nameById.get(id) ?? null,
    })),
    lastBookingNzDate: lastPastBookingNzDate(job, todayNZ),
    customerConfirmed: job.customerConfirmed === true,
    links: { job: jobUrl },
  };
}

export function buildUnscheduledList(
  jobs: readonly UnscheduledSourceJob[],
  nameById: ReadonlyMap<string, string>,
  todayNZ: string,
  jobUrlFor: (jobId: string) => string,
): OpsUnscheduledJob[] {
  const rows = jobs.flatMap((job) => {
    const shaped = toUnscheduledJob(job, nameById, todayNZ, jobUrlFor(job.id));
    return shaped ? [shaped] : [];
  });
  const byId = new Map(jobs.map((job) => [job.id, job]));
  rows.sort((a, b) => {
    const aTime = sortTime(byId.get(a.id)?.workOrderAt);
    const bTime = sortTime(byId.get(b.id)?.workOrderAt);
    if (aTime !== bTime) return aTime - bTime;
    return a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true });
  });
  return rows;
}

export function buildWeekRevenue(input: {
  jobs: readonly RevenueJob[];
  assignments: readonly RevenueAssignment[];
  anchor: string;
  dailyRevenueTarget: unknown;
  links: OpsLinks;
}): OpsWeekRevenue | null {
  const week = nzWeekContaining(input.anchor);
  if (!week) return null;
  const target = parseDailyRevenueTarget(input.dailyRevenueTarget);
  const days = week.dates.map((date) => {
    const scheduledRevenueExGst = roundMoney(
      scheduledRevenueExGstForNzDate(input.jobs, input.assignments, date),
    );
    return {
      date,
      scheduledRevenueExGst,
      gapToTarget: target == null ? null : roundMoney(target - scheduledRevenueExGst),
    };
  });
  const weekScheduledRevenueExGst = roundMoney(
    days.reduce((sum, day) => sum + day.scheduledRevenueExGst, 0),
  );
  const weekTarget = target == null ? null : roundMoney(target * days.length);
  return {
    currency: OPS_CURRENCY,
    gstLabel: DAILY_REVENUE_TARGET_GST_LABEL,
    timezone: OPS_TIMEZONE,
    weekStartsOn: OPS_WEEK_STARTS_ON,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    dailyRevenueTarget: target,
    days,
    weekScheduledRevenueExGst,
    weekTarget,
    weekGapToTarget: weekTarget == null ? null : roundMoney(weekTarget - weekScheduledRevenueExGst),
    links: input.links,
  };
}

/** Positive NZD amount the ops write will store. Does not invent 3500 or 4000. */
export function readDailyRevenueTargetInput(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = parseDailyRevenueTarget(value);
  if (amount == null || amount > MAX_DAILY_REVENUE_TARGET) return null;
  return roundMoney(amount);
}
