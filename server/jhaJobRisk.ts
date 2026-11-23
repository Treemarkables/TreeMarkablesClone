/**
 * Load morning JHA status for job cards and the Today briefing.
 * The NZ-day match itself lives in shared/jhaJobRisk.ts so it can be unit tested
 * without a database. This query only narrows rows to a window around that day.
 */
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { withTenant } from "./tenancy/tenantStore";
import * as schema from "@shared/schema";
import { getNZDateString, nzTimeToUTC } from "@shared/dateUtils";
import {
  checklistCompletionClearsRiskDue,
  EMPTY_JOB_RISK,
  RISK_ASSESSMENT_CHECKLIST_ITEM_ID,
  riskAssessmentsByJobForDay,
  riskLinkClearedByChecklist,
  type JobRiskAssessmentLink,
} from "@shared/jhaJobRisk";

function windowAroundNzDate(nzDate: string): { from: Date; to: Date } {
  const [year, month, day] = nzDate.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  const after = new Date(Date.UTC(year, month - 1, day + 2));
  return {
    from: nzTimeToUTC(prev.toISOString().slice(0, 10), "00:00"),
    to: nzTimeToUTC(after.toISOString().slice(0, 10), "00:00"),
  };
}

export async function loadRiskLinksForJobs(
  jobIds: readonly string[],
  nzDate: string = getNZDateString(new Date()),
): Promise<Map<string, JobRiskAssessmentLink>> {
  const unique = Array.from(new Set(jobIds.filter((id) => !!id)));
  if (unique.length === 0) return new Map();
  const { from, to } = windowAroundNzDate(nzDate);
  const rows = await db
    .select({
      id: schema.jhaAssessments.id,
      jobId: schema.jhaAssessments.jobId,
      status: schema.jhaAssessments.status,
      date: schema.jhaAssessments.date,
      completedAt: schema.jhaAssessments.completedAt,
    })
    .from(schema.jhaAssessments)
    .where(
      and(
        inArray(schema.jhaAssessments.jobId, unique),
        gte(schema.jhaAssessments.date, from),
        lt(schema.jhaAssessments.date, to),
      ),
    );
  return riskAssessmentsByJobForDay(rows, unique, nzDate);
}

/**
 * Same as loadRiskLinksForJobs, plus a ticked Risk assessment checklist item.
 * Either signal clears the due chip and the Start reminder.
 */
export async function loadEffectiveRiskLinksForJobs(
  jobIds: readonly string[],
  nzDate: string = getNZDateString(new Date()),
): Promise<Map<string, JobRiskAssessmentLink>> {
  const links = await loadRiskLinksForJobs(jobIds, nzDate);
  const unique = Array.from(links.keys());
  if (unique.length === 0) return links;
  const ticks = await db
    .select({
      jobId: schema.jobChecklistCompletions.jobId,
      completedAt: schema.jobChecklistCompletions.completedAt,
    })
    .from(schema.jobChecklistCompletions)
    .where(
      and(
        inArray(schema.jobChecklistCompletions.jobId, unique),
        eq(schema.jobChecklistCompletions.itemId, RISK_ASSESSMENT_CHECKLIST_ITEM_ID),
      ),
    );
  const tickedToday = new Set(
    ticks
      .filter((row) => checklistCompletionClearsRiskDue(row.completedAt, nzDate))
      .map((row) => row.jobId),
  );
  for (const id of unique) {
    links.set(
      id,
      riskLinkClearedByChecklist(links.get(id) ?? EMPTY_JOB_RISK, tickedToday.has(id)),
    );
  }
  return links;
}

/**
 * Mark the Risk assessment checklist item done for a job. Does not overwrite
 * a tick that is already there, so a later JHA save keeps the original name
 * and time. No-op when the row already exists.
 */
export async function recordRiskAssessmentChecklistDone(
  jobId: string,
  by?: { employeeId?: string | null; employeeName?: string | null },
): Promise<void> {
  if (!jobId) return;
  const today = getNZDateString(new Date());
  const [existing] = await db
    .select({ completedAt: schema.jobChecklistCompletions.completedAt })
    .from(schema.jobChecklistCompletions)
    .where(
      and(
        eq(schema.jobChecklistCompletions.jobId, jobId),
        eq(schema.jobChecklistCompletions.itemId, RISK_ASSESSMENT_CHECKLIST_ITEM_ID),
      ),
    )
    .limit(1);
  // Already ticked today — keep whoever did it and when.
  if (existing && checklistCompletionClearsRiskDue(existing.completedAt, today)) return;

  let completedByName = by?.employeeName?.trim() || "";
  if (!completedByName && by?.employeeId) {
    const [emp] = await db
      .select({
        firstName: schema.employees.firstName,
        lastName: schema.employees.lastName,
      })
      .from(schema.employees)
      .where(eq(schema.employees.id, by.employeeId))
      .limit(1);
    completedByName = [emp?.firstName, emp?.lastName].filter(Boolean).join(" ").trim();
  }
  const completer = {
    completedAt: new Date(),
    completedByEmployeeId: by?.employeeId ?? null,
    completedByName: completedByName || "Risk assessment",
  };
  await db
    .insert(schema.jobChecklistCompletions)
    .values(withTenant({
      jobId,
      itemId: RISK_ASSESSMENT_CHECKLIST_ITEM_ID,
      ...completer,
    }))
    .onConflictDoUpdate({
      target: [schema.jobChecklistCompletions.jobId, schema.jobChecklistCompletions.itemId],
      set: completer,
    });
}
