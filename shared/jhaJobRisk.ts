/**
 * Morning JHA linked to a job card.
 *
 * A job's risk status for a day is taken from `jha_assessments` rows whose
 * `jobId` matches and whose `date` falls on that Pacific/Auckland calendar
 * day (same NZ day helpers as Today / dispatch). Completed beats draft.
 * Archived or unlinked rows do not count. Starting a job is never blocked
 * by this status — callers only use it for the indicator and the soft reminder.
 */

import { getNZDateString } from "./dateUtils.ts";

export type RiskAssessmentStatus = "none" | "draft" | "completed";

export interface JhaRiskSnapshot {
  id: string;
  jobId: string | null;
  status: string | null;
  /** Assessment timestamp. Matched to an NZ calendar day. */
  date: Date | string | null;
  completedAt?: Date | string | null;
}

export interface JobRiskAssessmentLink {
  riskAssessmentStatus: RiskAssessmentStatus;
  riskAssessmentId: string | null;
}

export const EMPTY_JOB_RISK: JobRiskAssessmentLink = {
  riskAssessmentStatus: "none",
  riskAssessmentId: null,
};

export function normalizeJhaJobId(value: unknown): string | null {
  if (value == null) return null;
  const id = String(value).trim();
  if (!id || id === "null" || id === "undefined") return null;
  return id;
}

/** Completing a JHA (status completed) should carry a job card. */
export function jhaCompletionRequiresJob(status: string | null | undefined): boolean {
  return status === "completed";
}

function nzDay(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getNZDateString(date);
}

function statusRank(status: string | null | undefined): number {
  if (status === "completed") return 2;
  if (status === "draft") return 1;
  return 0;
}

function snapshotTime(row: JhaRiskSnapshot): number {
  const raw = row.completedAt ?? row.date;
  if (raw == null) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Best JHA for this job on `nzDate` (YYYY-MM-DD, Pacific/Auckland).
 * Completed outranks draft even if the draft is later the same day.
 */
export function riskAssessmentForJobDay(
  assessments: readonly JhaRiskSnapshot[],
  jobId: string,
  nzDate: string,
): JobRiskAssessmentLink {
  if (!jobId || !/^\d{4}-\d{2}-\d{2}$/.test(nzDate)) return EMPTY_JOB_RISK;

  let best: JhaRiskSnapshot | null = null;
  let bestRank = 0;
  let bestTime = -1;

  for (const row of assessments) {
    if (row.jobId !== jobId) continue;
    if (nzDay(row.date) !== nzDate) continue;
    const rank = statusRank(row.status);
    if (rank === 0) continue;
    const time = snapshotTime(row);
    if (rank > bestRank || (rank === bestRank && time >= bestTime)) {
      best = row;
      bestRank = rank;
      bestTime = time;
    }
  }

  if (!best || (best.status !== "completed" && best.status !== "draft")) {
    return EMPTY_JOB_RISK;
  }
  return {
    riskAssessmentStatus: best.status,
    riskAssessmentId: best.id,
  };
}

export function riskAssessmentsByJobForDay(
  assessments: readonly JhaRiskSnapshot[],
  jobIds: readonly string[],
  nzDate: string,
): Map<string, JobRiskAssessmentLink> {
  const map = new Map<string, JobRiskAssessmentLink>();
  for (const id of jobIds) {
    map.set(id, riskAssessmentForJobDay(assessments, id, nzDate));
  }
  return map;
}

/** Deep link used by the job card and the Start reminder. Drafts reopen in place. */
export function jhaAssessmentHref(
  jobId: string,
  link?: Partial<JobRiskAssessmentLink> | null,
): string {
  const params = new URLSearchParams();
  if (link?.riskAssessmentStatus === "draft" && link.riskAssessmentId) {
    params.set("id", link.riskAssessmentId);
  }
  params.set("jobId", jobId);
  return `/jha-assessment?${params.toString()}`;
}
