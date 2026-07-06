/**
 * Pure schedule-overlap helpers shared by the calendar client (instant
 * pre-drop warning against already-loaded assignments) and the API routes
 * (authoritative 409 check). Interval test is on UTC milliseconds.
 */

export interface AssignmentIntervalLike {
  id?: string;
  jobId: string;
  employeeId: string;
  startTime: Date | string;
  endTime: Date | string;
  status?: string | null;
}

/** External busy time (e.g. a pulled Google Calendar event) for an employee. */
export interface BusyBlockLike {
  summary?: string | null;
  startTime: Date | string;
  endTime: Date | string;
}

export interface ScheduleConflict {
  kind: "assignment" | "busy";
  employeeId: string;
  /** Set for kind === "assignment" */
  jobId?: string;
  assignmentId?: string;
  /** Set for kind === "busy" */
  summary?: string;
  startTime: string; // ISO UTC
  endTime: string; // ISO UTC
}

const toMs = (v: Date | string): number =>
  (typeof v === "string" ? new Date(v) : v).getTime();

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Find everything that overlaps the proposed [startUtc, endUtc) window for an
 * employee. `assignments` may be the full list for the business — non-matching
 * employees, cancelled rows, the job being moved (`excludeJobId`) and the
 * specific row being rescheduled (`excludeAssignmentId`) are skipped.
 */
export function findAssignmentConflicts(params: {
  employeeId: string;
  startUtc: Date | string;
  endUtc: Date | string;
  assignments: AssignmentIntervalLike[];
  excludeJobId?: string | null;
  excludeAssignmentId?: string | null;
  busyBlocks?: BusyBlockLike[];
}): ScheduleConflict[] {
  const { employeeId, assignments, excludeJobId, excludeAssignmentId, busyBlocks } = params;
  const startMs = toMs(params.startUtc);
  const endMs = toMs(params.endUtc);
  if (!(endMs > startMs)) return [];

  const conflicts: ScheduleConflict[] = [];

  for (const a of assignments) {
    if (a.employeeId !== employeeId) continue;
    if (a.status === "cancelled") continue;
    if (excludeJobId && a.jobId === excludeJobId) continue;
    if (excludeAssignmentId && a.id === excludeAssignmentId) continue;
    const aStart = toMs(a.startTime);
    const aEnd = toMs(a.endTime);
    if (overlaps(startMs, endMs, aStart, aEnd)) {
      conflicts.push({
        kind: "assignment",
        employeeId,
        jobId: a.jobId,
        assignmentId: a.id,
        startTime: new Date(aStart).toISOString(),
        endTime: new Date(aEnd).toISOString(),
      });
    }
  }

  for (const b of busyBlocks ?? []) {
    const bStart = toMs(b.startTime);
    const bEnd = toMs(b.endTime);
    if (overlaps(startMs, endMs, bStart, bEnd)) {
      conflicts.push({
        kind: "busy",
        employeeId,
        summary: b.summary ?? undefined,
        startTime: new Date(bStart).toISOString(),
        endTime: new Date(bEnd).toISOString(),
      });
    }
  }

  return conflicts;
}
