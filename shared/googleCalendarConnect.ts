/**
 * Pure Google Calendar connect helpers. Kept free of database and googleapis
 * imports so the OAuth redirect, sync-failure notice, and backfill selection
 * can be tested without booting the server.
 */

export const PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI =
  "https://app.treemarkables.co.nz/api/google-calendar/callback";

export const CALENDAR_SYNC_BROKEN_NOTICE = "Calendar sync broken";

export const GOOGLE_CALENDAR_TABLES = [
  "google_calendar_connections",
  "google_event_links",
  "google_busy_events",
] as const;

const SYNC_ERROR_MAX = 500;

export function googleCalendarRedirectUri(
  env: { NODE_ENV?: string; GOOGLE_CALENDAR_REDIRECT_URI?: string },
  requestOrigin: string,
): string {
  const override = env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (override) return override;
  if (env.NODE_ENV === "production") return PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI;
  return `${requestOrigin.replace(/\/$/, "")}/api/google-calendar/callback`;
}

/** Browser origin for the post-OAuth redirect back to /integrations. */
export function googleCalendarBrowserOrigin(
  redirectUri: string,
  requestOrigin: string,
  nodeEnv?: string,
): string {
  try {
    return new URL(redirectUri).origin;
  } catch {
    if (nodeEnv === "production") return "https://app.treemarkables.co.nz";
    return requestOrigin.replace(/\/$/, "");
  }
}

export function googleCalendarTablesWarning(existingTableNames: Iterable<string>): string | null {
  const have = new Set(existingTableNames);
  const missing = GOOGLE_CALENDAR_TABLES.filter((name) => !have.has(name));
  if (missing.length === 0) return null;
  return `⚠️ Google Calendar tables missing: ${missing.join(", ")}. Connect and calendar sync will fail until they exist.`;
}

export interface GoogleCalendarStatusView {
  connected: boolean;
  calendarEmail?: string;
  lastError: string | null;
  syncStatus: string | null;
}

export function readGoogleCalendarStatus(data: unknown): GoogleCalendarStatusView {
  if (!data || typeof data !== "object") {
    return { connected: false, lastError: null, syncStatus: null };
  }
  const row = data as Record<string, unknown>;
  return {
    connected: row.connected === true,
    calendarEmail: typeof row.calendarEmail === "string" ? row.calendarEmail : undefined,
    lastError: typeof row.lastError === "string" && row.lastError.trim() ? row.lastError : null,
    syncStatus: typeof row.syncStatus === "string" ? row.syncStatus : null,
  };
}

export function calendarSyncIsBroken(
  status: { syncStatus?: string | null; lastError?: string | null } | null | undefined,
): boolean {
  if (!status) return false;
  if (status.syncStatus === "error") return true;
  return typeof status.lastError === "string" && status.lastError.trim().length > 0;
}

export function connectionSyncErrorPatch(error: unknown): { syncStatus: "error"; lastError: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const lastError = (cleaned || "Google Calendar sync failed").slice(0, SYNC_ERROR_MAX);
  return { syncStatus: "error", lastError };
}

export function connectionSyncOkPatch(): { syncStatus: "synced"; lastError: null } {
  return { syncStatus: "synced", lastError: null };
}

/**
 * Coalesce debounced pushes. `null` means nothing is queued yet.
 * `undefined` means a full push (every active connection). A connection id
 * limits the push to that calendar. A full push is never narrowed, and two
 * different connection ids widen back to a full push so neither is dropped.
 */
export function nextPushScope(
  existing: string | undefined | null,
  incoming: string | undefined,
): string | undefined {
  if (existing === null) return incoming;
  if (existing === undefined || incoming === undefined) return undefined;
  if (existing === incoming) return existing;
  return undefined;
}

export interface BackfillJob {
  id: string;
  status?: string | null;
  /** NZ calendar dates (YYYY-MM-DD) the job runs on. */
  nzDates: readonly string[];
  assignedTo?: readonly string[] | null;
}

/**
 * Work orders with a booking on today or a later NZ date. Admins receive every
 * one; everyone else receives jobs they are assigned to (assignedTo or a
 * staff-assignment id).
 */
export function isFutureScheduledWorkOrder(
  job: { status?: string | null },
  nzDates: readonly string[],
  todayNZ: string,
): boolean {
  if (job.status !== "work_order") return false;
  if (nzDates.length === 0) return false;
  let last = nzDates[0];
  for (const day of nzDates) {
    if (day > last) last = day;
  }
  return last >= todayNZ;
}

export function selectWorkOrdersToBackfill(input: {
  jobs: readonly BackfillJob[];
  todayNZ: string;
  userId: string;
  isAdmin: boolean;
  assignedJobIds?: Iterable<string>;
}): string[] {
  const assigned = new Set(input.assignedJobIds ?? []);
  const ids: string[] = [];
  for (const job of input.jobs) {
    if (!isFutureScheduledWorkOrder(job, job.nzDates, input.todayNZ)) continue;
    if (input.isAdmin || (job.assignedTo ?? []).includes(input.userId) || assigned.has(job.id)) {
      ids.push(job.id);
    }
  }
  return ids;
}
