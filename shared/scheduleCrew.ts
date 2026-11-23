/**
 * Crew on the Schedule Job form.
 *
 * Reopening a booking must tick everyone already on the booked days, including
 * people whose start times differ by more than a minute (a second drop onto
 * the dispatch board). Saving sends that full set — one row per person per
 * day — and the server replaces the job's assignment rows with it.
 */
import { getNZDateString, nzTimeToUTC } from "./dateUtils.ts";

export const SCHEDULE_DURATION_MINUTES = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
  300, 360, 420, 480,
] as const;

export interface ScheduleAssignmentRow {
  employeeId?: string | null;
  startTime?: string | Date | null;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function asIdList(value: unknown): string[] {
  return Array.isArray(value) ? uniqueIds(value) : [];
}

/**
 * Staff who should be ticked when the schedule form opens.
 *
 * Assignment rows on the booked NZ days come first (they are the booking).
 * Job fields are unioned in so a crew stored only on the job still shows.
 * Rows on some other day are left out — those are leftover bookings, not
 * this one.
 */
export function crewIdsForScheduleEdit(input: {
  assignedTo?: unknown;
  assignedTeam?: unknown;
  assignedStaffIds?: unknown;
  assignments?: ScheduleAssignmentRow[] | null;
  /** NZ calendar days (YYYY-MM-DD) this booking covers. */
  days?: string[] | null;
}): string[] {
  const daySet = new Set(
    (input.days ?? []).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );
  const fromAssignments: string[] = [];
  for (const row of input.assignments ?? []) {
    if (!row?.employeeId) continue;
    if (daySet.size > 0 && row.startTime) {
      const parsed = new Date(row.startTime);
      if (!Number.isNaN(parsed.getTime())) {
        const day = getNZDateString(parsed);
        if (!daySet.has(day)) continue;
      }
    }
    fromAssignments.push(row.employeeId);
  }
  return uniqueIds([
    ...fromAssignments,
    ...asIdList(input.assignedTo),
    ...asIdList(input.assignedTeam),
    ...asIdList(input.assignedStaffIds),
  ]);
}

/**
 * Crew stored on the job after a save.
 * A full save is the submitted set (existing rows were deleted).
 * addOnly keeps everyone whose row was not removed, then adds the submission.
 */
export function crewIdsAfterSave(input: {
  addOnly: boolean;
  existing: { id: string; employeeId: string }[];
  removedAssignmentIds: string[];
  submittedEmployeeIds: string[];
}): string[] {
  const removed = new Set(input.removedAssignmentIds);
  const kept = input.addOnly
    ? input.existing
        .filter((row) => row.employeeId && !removed.has(row.id))
        .map((row) => row.employeeId)
    : [];
  return uniqueIds([...kept, ...input.submittedEmployeeIds]);
}

/** People in `nextIds` who were not already on the job. */
export function newlyAddedCrewIds(previousIds: string[], nextIds: string[]): string[] {
  const previous = new Set(uniqueIds(previousIds));
  return uniqueIds(nextIds).filter((id) => !previous.has(id));
}

/** Nearest duration the schedule dropdown can show. Blank when unknown. */
export function snapScheduleDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const rounded = Math.round(minutes);
  const exact = SCHEDULE_DURATION_MINUTES.find((m) => m === rounded);
  if (exact) return String(exact);
  let best: number = SCHEDULE_DURATION_MINUTES[0];
  let bestDiff = Infinity;
  for (const option of SCHEDULE_DURATION_MINUTES) {
    const diff = Math.abs(option - rounded);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option;
    }
  }
  return String(best);
}

/** 06:00–17:00 on the half hour, plus the booking's own time when it isn't one of those. */
export function scheduleStartTimes(current?: string): string[] {
  const times: string[] = [];
  for (let i = 0; i < 23; i++) {
    const actualIndex = i + 12;
    const hours = Math.floor(actualIndex / 2);
    const minutes = (actualIndex % 2) * 30;
    times.push(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  if (current && /^\d{2}:\d{2}$/.test(current) && !times.includes(current)) {
    times.push(current);
    times.sort();
  }
  return times;
}

export function formatScheduleStartLabel(time: string): string {
  const [hRaw, mRaw] = time.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * One assignment per person per selected day. This is the full crew, so a
 * save replaces the previous rows instead of appending a second copy.
 */
export function buildCrewAssignmentRows(input: {
  employeeIds: string[];
  days: string[];
  startTime: string;
  durationMinutes: number;
  lastDayDurationMinutes?: number;
  notes?: string;
}): Array<{ employeeId: string; startTime: string; endTime: string; notes: string }> {
  const days = [...input.days].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const ids = uniqueIds(input.employeeIds);
  if (days.length === 0 || ids.length === 0) return [];
  const durationMs = input.durationMinutes * 60_000;
  const lastMs = (input.lastDayDurationMinutes ?? input.durationMinutes) * 60_000;
  const lastDay = days[days.length - 1];
  const notes = input.notes ?? "";
  const rows: Array<{ employeeId: string; startTime: string; endTime: string; notes: string }> = [];
  for (const day of days) {
    const ms = days.length > 1 && day === lastDay ? lastMs : durationMs;
    const start = nzTimeToUTC(day, input.startTime);
    const end = new Date(start.getTime() + ms);
    for (const employeeId of ids) {
      rows.push({
        employeeId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes,
      });
    }
  }
  return rows;
}
