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

/**
 * Checklist item that belongs to the Risk assessment role. Ticking it, or
 * linking a completed morning JHA, both clear the job's due state.
 */
export const RISK_ASSESSMENT_CHECKLIST_ITEM_ID = "risk-assessment";

/**
 * A checklist tick clears "Risk needed" without throwing away a draft id, so
 * Start can still reopen that draft if the tick is later removed. A completed
 * JHA already wins and is left as-is. Callers must pass true only when the
 * tick falls on the same NZ day as the due check — the row is once per job,
 * and a previous day's tick does not cover this morning.
 */
export function riskLinkClearedByChecklist(
  link: JobRiskAssessmentLink,
  checklistItemDone: boolean,
): JobRiskAssessmentLink {
  if (link.riskAssessmentStatus === "completed" || !checklistItemDone) return link;
  return {
    riskAssessmentStatus: "completed",
    riskAssessmentId: link.riskAssessmentId,
  };
}

/** True when a job-level checklist tick was recorded on this NZ calendar day. */
export function checklistCompletionClearsRiskDue(
  completedAt: Date | string | null | undefined,
  nzDate: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nzDate)) return false;
  return nzDay(completedAt) === nzDate;
}

/**
 * Done ids for role outstanding / snapshots. A completed JHA for `nzDate`
 * counts as the Risk assessment item. A checklist tick counts only on the
 * NZ day it was recorded, so yesterday's tick does not hide this morning.
 */
export function doneIdsIncludingLinkedJha(
  completions: readonly { itemId: string; completedAt?: Date | string | null }[],
  link: JobRiskAssessmentLink | null | undefined,
  nzDate: string,
): Set<string> {
  const done = new Set<string>();
  for (const row of completions) {
    if (row.itemId !== RISK_ASSESSMENT_CHECKLIST_ITEM_ID) {
      done.add(row.itemId);
      continue;
    }
    if (
      link?.riskAssessmentStatus === "completed"
      || checklistCompletionClearsRiskDue(row.completedAt, nzDate)
    ) {
      done.add(row.itemId);
    }
  }
  if (link?.riskAssessmentStatus === "completed") {
    done.add(RISK_ASSESSMENT_CHECKLIST_ITEM_ID);
  }
  return done;
}

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
