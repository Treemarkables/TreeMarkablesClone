/**
 * Two-way Google Calendar sync (unified calendar Phase C).
 *
 * PUSH  — jobs sync out to the Google Calendars of connected users. Audience is
 *         assigned-crew-only: a connection receives a job iff that user has an
 *         assignment on it; admins receive every scheduled job. Multi-day jobs
 *         sync as ONE EVENT PER NZ DAY (so weekend carve-outs stay accurate),
 *         tracked per (job, connection, nz_date) in google_event_links.
 *         queueJobPush() debounces ~5s so bursts of route writes coalesce.
 *
 * PULL  — a RUN_CRONS-gated poller (5 min) incrementally lists each connection's
 *         calendar with sync tokens and caches external events as UTC busy
 *         intervals in google_busy_events. Self-pushed events are skipped via
 *         the extendedProperties.private.inflowJobId tag (edit-loop guard).
 *
 * Runs on the global owner db connection (no session in route-deferred work or
 * the poller), so every write sets business_id explicitly.
 */
import { google, type calendar_v3 } from 'googleapis';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  googleCalendarConnections,
  googleEventLinks,
  googleBusyEvents,
  type GoogleCalendarConnection,
} from '@shared/schema';
import { storage } from '../storage';
import { getJobScheduledNZDates, getNZDateString, nzTimeToUTC } from '@shared/dateUtils';

const INFLOW_JOB_TAG = 'inflowJobId';
const PUSH_DEBOUNCE_MS = 5_000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const PULL_WINDOW_DAYS = 60;
// Jobs in these statuses never appear in Google (and get removed if they were pushed)
const SYNC_EXCLUDE_STATUSES = new Set(['archived', 'unsuccessful', 'cancelled', 'lead', 'quote']);

function oauthClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar OAuth not configured (GOOGLE_CALENDAR_CLIENT_ID/SECRET)');
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

function isAuthRevokedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('invalid_grant') || msg.includes('unauthorized_client');
}

async function deactivateConnection(conn: GoogleCalendarConnection, reason: string) {
  console.error(`❌ Google Calendar connection ${conn.id} deactivated: ${reason}`);
  await db
    .update(googleCalendarConnections)
    .set({ isActive: false, lastError: reason.slice(0, 500), updatedAt: new Date() })
    .where(eq(googleCalendarConnections.id, conn.id));
}

/**
 * Calendar client for a stored connection — refreshes the access token when
 * it's within a minute of expiry and persists the rotated credentials.
 * Throws (after deactivating the row) when the grant has been revoked.
 */
export async function getClientForConnection(conn: GoogleCalendarConnection): Promise<calendar_v3.Calendar> {
  const auth = oauthClient();
  auth.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiresAt ? new Date(conn.expiresAt).getTime() : undefined,
  });

  const expiresSoon = !conn.expiresAt || new Date(conn.expiresAt).getTime() < Date.now() + 60_000;
  if (expiresSoon) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      auth.setCredentials(credentials);
      await db
        .update(googleCalendarConnections)
        .set({
          accessToken: credentials.access_token ?? conn.accessToken,
          refreshToken: credentials.refresh_token ?? conn.refreshToken,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 50 * 60 * 1000),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(googleCalendarConnections.id, conn.id));
    } catch (error) {
      if (isAuthRevokedError(error)) {
        await deactivateConnection(conn, 'Refresh token revoked — reconnect Google Calendar');
      }
      throw error;
    }
  }

  return google.calendar({ version: 'v3', auth });
}

export async function getActiveConnectionsForBusiness(businessId: string | null | undefined): Promise<GoogleCalendarConnection[]> {
  if (!businessId) return [];
  return db
    .select()
    .from(googleCalendarConnections)
    .where(and(eq(googleCalendarConnections.businessId, businessId), eq(googleCalendarConnections.isActive, true)));
}

export async function getConnectionForUser(businessId: string | null | undefined, userId: string): Promise<GoogleCalendarConnection | undefined> {
  if (!businessId) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarConnections)
    .where(and(
      eq(googleCalendarConnections.businessId, businessId),
      eq(googleCalendarConnections.userId, userId),
      eq(googleCalendarConnections.isActive, true),
    ));
  return rows[0];
}

// ── Push pipeline ─────────────────────────────────────────────────────────────

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced job push — safe to call from any route's post-response work. */
export function queueJobPush(jobId: string): void {
  const existing = pushTimers.get(jobId);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    jobId,
    setTimeout(() => {
      pushTimers.delete(jobId);
      pushJob(jobId).catch((err) => console.error(`❌ Google Calendar push failed for job ${jobId}:`, err));
    }, PUSH_DEBOUNCE_MS),
  );
}

interface DayWindow {
  nzDate: string;
  start: Date;
  end: Date;
}

function windowsForDays(params: {
  days: string[];
  assignments: Array<{ employeeId: string; startTime: Date | string; endTime: Date | string }>;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
}): DayWindow[] {
  const { days, assignments, scheduledStartTime, scheduledEndTime } = params;
  const byDay = new Map<string, { start: number; end: number }>();
  for (const a of assignments) {
    const day = getNZDateString(typeof a.startTime === 'string' ? a.startTime : a.startTime.toISOString());
    const startMs = new Date(a.startTime).getTime();
    const endMs = new Date(a.endTime).getTime();
    const cur = byDay.get(day);
    byDay.set(day, {
      start: cur ? Math.min(cur.start, startMs) : startMs,
      end: cur ? Math.max(cur.end, endMs) : endMs,
    });
  }
  return days.map((nzDate) => {
    const fromAssignments = byDay.get(nzDate);
    if (fromAssignments) {
      return { nzDate, start: new Date(fromAssignments.start), end: new Date(fromAssignments.end) };
    }
    const startStr = scheduledStartTime || '08:00';
    const endStr = scheduledEndTime || '17:00';
    return { nzDate, start: nzTimeToUTC(nzDate, startStr), end: nzTimeToUTC(nzDate, endStr) };
  });
}

function eventHash(payload: { summary: string; location: string; start: string; end: string }): string {
  return JSON.stringify(payload);
}

/** Remove every pushed event for a job (cancel/unschedule/archive/delete). */
export async function removeJobEvents(jobId: string): Promise<void> {
  const links = await db.select().from(googleEventLinks).where(eq(googleEventLinks.jobId, jobId));
  if (links.length === 0) return;
  const connCache = new Map<string, GoogleCalendarConnection | null>();
  for (const link of links) {
    try {
      let conn = connCache.get(link.connectionId);
      if (conn === undefined) {
        const rows = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.id, link.connectionId));
        conn = rows[0] ?? null;
        connCache.set(link.connectionId, conn);
      }
      if (conn && conn.isActive) {
        const calendar = await getClientForConnection(conn);
        await calendar.events
          .delete({ calendarId: conn.calendarId || 'primary', eventId: link.googleEventId })
          .catch((err: unknown) => {
            // 404/410 = already gone in Google — fine, we just drop the link
            const status = (err as { code?: number }).code;
            if (status !== 404 && status !== 410) throw err;
          });
      }
    } catch (error) {
      console.error(`❌ Failed to delete Google event ${link.googleEventId}:`, error);
    }
    await db.delete(googleEventLinks).where(eq(googleEventLinks.id, link.id));
  }
}

export async function pushJob(jobId: string): Promise<void> {
  const job = await storage.getJob(jobId);
  if (!job) {
    await removeJobEvents(jobId);
    return;
  }
  if (!job.scheduledDate || SYNC_EXCLUDE_STATUSES.has(job.status as string)) {
    await removeJobEvents(jobId);
    return;
  }

  const businessId = (job as { businessId?: string | null }).businessId ?? null;
  const connections = await getActiveConnectionsForBusiness(businessId);
  if (connections.length === 0) return;

  const assignments = await storage.getJobStaffAssignmentsByJob(jobId);
  const assignedEmployeeIds = new Set(assignments.map((a) => a.employeeId));
  (job.assignedTo ?? []).forEach((id: string) => assignedEmployeeIds.add(id));
  const jobDays = getJobScheduledNZDates(job);

  const customer = job.customerId ? await storage.getCustomer(job.customerId) : undefined;
  const customerName = customer?.name || job.title || 'Job';
  const summary = `#${job.jobNumber ?? ''} ${customerName}`.trim();
  const location = job.address || '';
  const description = [
    `Job #${job.jobNumber ?? ''}`,
    `Customer: ${customerName}`,
    job.description ? `\n${job.description}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  for (const conn of connections) {
    try {
      const employee = await storage.getEmployee(conn.userId);
      const isAdmin = employee?.role === 'admin';
      const isAssigned = assignedEmployeeIds.has(conn.userId);
      // Assigned-crew audience: crew see their jobs, admins see everything
      const wanted: DayWindow[] =
        isAssigned
          ? windowsForDays({
              days: jobDays.filter((d) =>
                assignments.some((a) => a.employeeId === conn.userId && getNZDateString(new Date(a.startTime)) === d),
              ).length > 0
                ? jobDays.filter((d) =>
                    assignments.some((a) => a.employeeId === conn.userId && getNZDateString(new Date(a.startTime)) === d),
                  )
                : jobDays,
              assignments: assignments.filter((a) => a.employeeId === conn.userId),
              scheduledStartTime: job.scheduledStartTime,
              scheduledEndTime: job.scheduledEndTime,
            })
          : isAdmin
            ? windowsForDays({
                days: jobDays,
                assignments,
                scheduledStartTime: job.scheduledStartTime,
                scheduledEndTime: job.scheduledEndTime,
              })
            : [];

      const links = await db
        .select()
        .from(googleEventLinks)
        .where(and(eq(googleEventLinks.jobId, jobId), eq(googleEventLinks.connectionId, conn.id)));
      const linkByDay = new Map(links.map((l) => [l.nzDate, l]));
      const wantedDays = new Set(wanted.map((w) => w.nzDate));

      const calendar = await getClientForConnection(conn);
      const calendarId = conn.calendarId || 'primary';

      // Delete events for days no longer scheduled (or no longer in audience)
      for (const link of links) {
        if (wantedDays.has(link.nzDate)) continue;
        await calendar.events
          .delete({ calendarId, eventId: link.googleEventId })
          .catch((err: unknown) => {
            const status = (err as { code?: number }).code;
            if (status !== 404 && status !== 410) throw err;
          });
        await db.delete(googleEventLinks).where(eq(googleEventLinks.id, link.id));
      }

      // Create / patch the rest
      for (const w of wanted) {
        const payload = {
          summary,
          location,
          start: w.start.toISOString(),
          end: w.end.toISOString(),
        };
        const hash = eventHash(payload);
        const existing = linkByDay.get(w.nzDate);
        const requestBody: calendar_v3.Schema$Event = {
          summary,
          description,
          location,
          start: { dateTime: payload.start, timeZone: 'Pacific/Auckland' },
          end: { dateTime: payload.end, timeZone: 'Pacific/Auckland' },
          extendedProperties: { private: { [INFLOW_JOB_TAG]: jobId } },
        };

        if (!existing) {
          const res = await calendar.events.insert({ calendarId, requestBody });
          if (res.data.id) {
            await db.insert(googleEventLinks).values({
              businessId,
              jobId,
              connectionId: conn.id,
              nzDate: w.nzDate,
              googleEventId: res.data.id,
              lastPushedHash: hash,
              syncStatus: 'synced',
            });
          }
        } else if (existing.lastPushedHash !== hash) {
          try {
            await calendar.events.patch({ calendarId, eventId: existing.googleEventId, requestBody });
            await db
              .update(googleEventLinks)
              .set({ lastPushedHash: hash, syncStatus: 'synced', lastError: null, updatedAt: new Date() })
              .where(eq(googleEventLinks.id, existing.id));
          } catch (err: unknown) {
            const status = (err as { code?: number }).code;
            if (status === 404 || status === 410) {
              // Event was deleted in Google — recreate it
              const res = await calendar.events.insert({ calendarId, requestBody });
              await db
                .update(googleEventLinks)
                .set({ googleEventId: res.data.id ?? existing.googleEventId, lastPushedHash: hash, syncStatus: 'synced', lastError: null, updatedAt: new Date() })
                .where(eq(googleEventLinks.id, existing.id));
            } else {
              throw err;
            }
          }
        }
      }

      console.log(`✅ Google Calendar push: job ${job.jobNumber ?? jobId} → ${conn.googleEmail ?? conn.userId} (${wanted.length} day event(s))`);
    } catch (error) {
      if (!isAuthRevokedError(error)) {
        console.error(`❌ Google Calendar push failed for connection ${conn.id}:`, error);
        await db
          .update(googleEventLinks)
          .set({ syncStatus: 'error', lastError: error instanceof Error ? error.message.slice(0, 500) : String(error), updatedAt: new Date() })
          .where(and(eq(googleEventLinks.jobId, jobId), eq(googleEventLinks.connectionId, conn.id)));
      }
    }
  }
}

// ── Pull pipeline (poller) ────────────────────────────────────────────────────

async function pullConnection(conn: GoogleCalendarConnection): Promise<void> {
  const calendar = await getClientForConnection(conn);
  const calendarId = conn.calendarId || 'primary';

  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let syncToken = conn.syncToken ?? null;

  const processItems = async (items: calendar_v3.Schema$Event[]) => {
    for (const item of items) {
      if (!item.id) continue;
      // Skip our own pushed events — edit-loop/dedup guard
      if (item.extendedProperties?.private?.[INFLOW_JOB_TAG]) continue;

      if (item.status === 'cancelled') {
        await db
          .delete(googleBusyEvents)
          .where(and(eq(googleBusyEvents.connectionId, conn.id), eq(googleBusyEvents.googleEventId, item.id)));
        continue;
      }
      // Timed events only — all-day events would mark the whole day busy
      const startDateTime = item.start?.dateTime;
      const endDateTime = item.end?.dateTime;
      if (!startDateTime || !endDateTime) continue;

      await db
        .insert(googleBusyEvents)
        .values({
          businessId: conn.businessId,
          connectionId: conn.id,
          googleEventId: item.id,
          summary: item.summary ?? null,
          startTime: new Date(startDateTime),
          endTime: new Date(endDateTime),
          status: item.status ?? 'confirmed',
        })
        .onConflictDoUpdate({
          target: [googleBusyEvents.connectionId, googleBusyEvents.googleEventId],
          set: {
            summary: item.summary ?? null,
            startTime: new Date(startDateTime),
            endTime: new Date(endDateTime),
            status: item.status ?? 'confirmed',
            updatedAt: new Date(),
          },
        });
    }
  };

  const runList = async (useSyncToken: string | null) => {
    do {
      const res = await calendar.events.list({
        calendarId,
        singleEvents: true,
        maxResults: 250,
        pageToken,
        ...(useSyncToken
          ? { syncToken: useSyncToken }
          : {
              timeMin: new Date(Date.now() - PULL_WINDOW_DAYS * 86_400_000).toISOString(),
              timeMax: new Date(Date.now() + PULL_WINDOW_DAYS * 86_400_000).toISOString(),
            }),
      });
      await processItems(res.data.items ?? []);
      pageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    } while (pageToken);
  };

  try {
    await runList(syncToken);
  } catch (error) {
    const status = (error as { code?: number }).code;
    if (status === 410) {
      // Sync token expired — reset and re-window
      pageToken = undefined;
      syncToken = null;
      await runList(null);
    } else {
      throw error;
    }
  }

  await db
    .update(googleCalendarConnections)
    .set({ syncToken: nextSyncToken ?? syncToken, lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(googleCalendarConnections.id, conn.id));
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startGoogleCalendarPoller(): void {
  if (pollTimer) return;
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    console.log('📅 Google Calendar poller not started — OAuth client not configured');
    return;
  }

  const tick = async () => {
    try {
      const connections = await db
        .select()
        .from(googleCalendarConnections)
        .where(eq(googleCalendarConnections.isActive, true));
      for (const conn of connections) {
        // One bad tenant must not stall the loop
        try {
          await pullConnection(conn);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Google Calendar pull failed for connection ${conn.id}: ${msg}`);
          if (!isAuthRevokedError(error)) {
            await db
              .update(googleCalendarConnections)
              .set({ lastError: msg.slice(0, 500), updatedAt: new Date() })
              .where(eq(googleCalendarConnections.id, conn.id));
          }
        }
      }
    } catch (error) {
      console.error('❌ Google Calendar poller tick failed:', error);
    }
  };

  pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  // First pass shortly after boot so a fresh connection shows busy time quickly
  setTimeout(tick, 15_000);
  console.log('📅 Google Calendar poller started (5 min interval)');
}
