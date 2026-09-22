/**
 * Load morning JHA status for job cards and the Today briefing.
 * The NZ-day match itself lives in shared/jhaJobRisk.ts so it can be unit tested
 * without a database. This query only narrows rows to a window around that day.
 */
import { and, gte, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { getNZDateString, nzTimeToUTC } from "@shared/dateUtils";
import {
  riskAssessmentsByJobForDay,
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
