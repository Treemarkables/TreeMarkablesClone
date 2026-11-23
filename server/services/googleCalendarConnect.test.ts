/**
 * Run: npx tsx --test server/services/googleCalendarConnect.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALENDAR_SYNC_BROKEN_NOTICE,
  GOOGLE_CALENDAR_TABLES,
  PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI,
  calendarSyncIsBroken,
  readGoogleCalendarStatus,
  connectionSyncErrorPatch,
  connectionSyncOkPatch,
  googleCalendarBrowserOrigin,
  googleCalendarRedirectUri,
  googleCalendarTablesWarning,
  isFutureScheduledWorkOrder,
  nextPushScope,
  selectWorkOrdersToBackfill,
} from "../../shared/googleCalendarConnect.ts";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listServerSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...listServerSources(full));
      continue;
    }
    if (!/\.(ts|tsx|mjs|js|cjs)$/.test(entry.name)) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    out.push(full);
  }
  return out;
}

describe("Google Calendar connect", () => {
  it("uses the production callback unless GOOGLE_CALENDAR_REDIRECT_URI is set", () => {
    assert.equal(
      PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI,
      "https://app.treemarkables.co.nz/api/google-calendar/callback",
    );
    assert.equal(
      googleCalendarRedirectUri({ NODE_ENV: "production" }, "https://ignored.example"),
      PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI,
    );
    assert.equal(
      googleCalendarRedirectUri({ NODE_ENV: "development" }, "http://localhost:5000"),
      "http://localhost:5000/api/google-calendar/callback",
    );
    assert.equal(
      googleCalendarRedirectUri(
        { NODE_ENV: "production", GOOGLE_CALENDAR_REDIRECT_URI: "  https://app.inflowapp.co.nz/api/google-calendar/callback  " },
        "https://app.treemarkables.co.nz",
      ),
      "https://app.inflowapp.co.nz/api/google-calendar/callback",
    );
    assert.equal(
      googleCalendarRedirectUri({ NODE_ENV: "production", GOOGLE_CALENDAR_REDIRECT_URI: "   " }, "http://localhost:5000"),
      PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI,
    );
  });

  it("sends the browser back to the same origin as the OAuth redirect", () => {
    assert.equal(
      googleCalendarBrowserOrigin(PRODUCTION_GOOGLE_CALENDAR_REDIRECT_URI, "http://localhost:5000", "production"),
      "https://app.treemarkables.co.nz",
    );
    assert.equal(
      googleCalendarBrowserOrigin(
        "https://app.inflowapp.co.nz/api/google-calendar/callback",
        "https://app.treemarkables.co.nz",
        "production",
      ),
      "https://app.inflowapp.co.nz",
    );
    assert.equal(
      googleCalendarBrowserOrigin("not a url", "http://localhost:5000/", "development"),
      "http://localhost:5000",
    );
  });

  it("warns only for the calendar tables that are absent", () => {
    assert.equal(googleCalendarTablesWarning(GOOGLE_CALENDAR_TABLES), null);
    const warning = googleCalendarTablesWarning(["google_calendar_connections"]);
    assert.match(warning ?? "", /google_event_links/);
    assert.match(warning ?? "", /google_busy_events/);
    assert.equal((warning ?? "").includes("google_calendar_connections"), false);
  });

  it("persists a bounded last_error and sync_status of error", () => {
    const patch = connectionSyncErrorPatch(new Error("invalid_grant\nfrom Google"));
    assert.deepEqual(patch, { syncStatus: "error", lastError: "invalid_grant from Google" });
    const long = connectionSyncErrorPatch("x".repeat(800));
    assert.equal(patch.syncStatus, "error");
    assert.equal(long.lastError.length, 500);
    assert.deepEqual(connectionSyncOkPatch(), { syncStatus: "synced", lastError: null });
    assert.equal(connectionSyncErrorPatch("").lastError, "Google Calendar sync failed");
  });

  it("treats sync_status error or a stored last_error as Calendar sync broken", () => {
    assert.equal(CALENDAR_SYNC_BROKEN_NOTICE, "Calendar sync broken");
    assert.equal(calendarSyncIsBroken({ syncStatus: "synced", lastError: null }), false);
    assert.equal(calendarSyncIsBroken({ syncStatus: "error", lastError: null }), true);
    assert.equal(calendarSyncIsBroken({ syncStatus: "synced", lastError: "token refresh failed" }), true);
    assert.equal(calendarSyncIsBroken({ syncStatus: "synced", lastError: "  " }), false);
    assert.equal(calendarSyncIsBroken(null), false);
    const parsed = readGoogleCalendarStatus({
      connected: true,
      calendarEmail: "crew@example.com",
      syncStatus: "error",
      lastError: "events.insert failed",
    });
    assert.equal(parsed.connected, true);
    assert.equal(calendarSyncIsBroken(parsed), true);
    assert.equal(readGoogleCalendarStatus(null).connected, false);
  });

  it("keeps a full push from being narrowed by a later connection-scoped push", () => {
    assert.equal(nextPushScope(null, "conn-1"), "conn-1");
    assert.equal(nextPushScope(null, undefined), undefined);
    assert.equal(nextPushScope(undefined, "conn-1"), undefined);
    assert.equal(nextPushScope("conn-1", undefined), undefined);
    assert.equal(nextPushScope("conn-1", "conn-1"), "conn-1");
    assert.equal(nextPushScope("conn-1", "conn-2"), undefined);
  });

  it("backfills future scheduled work orders for the connecting user", () => {
    const today = "2026-10-11";
    const future = { id: "future", status: "work_order", nzDates: ["2026-10-12"], assignedTo: ["crew-1"] };
    const todayJob = { id: "today", status: "work_order", nzDates: ["2026-10-11"], assignedTo: ["crew-2"] };
    const past = { id: "past", status: "work_order", nzDates: ["2026-10-01"], assignedTo: ["crew-1"] };
    const quote = { id: "quote", status: "quote", nzDates: ["2026-10-20"], assignedTo: ["crew-1"] };
    const unscheduled = { id: "bare", status: "work_order", nzDates: [], assignedTo: ["crew-1"] };
    const viaAssignment = { id: "assigned", status: "work_order", nzDates: ["2026-10-15"], assignedTo: [] as string[] };
    const jobs = [future, todayJob, past, quote, unscheduled, viaAssignment];

    assert.deepEqual(
      selectWorkOrdersToBackfill({ jobs, todayNZ: today, userId: "admin-1", isAdmin: true }),
      ["future", "today", "assigned"],
    );
    assert.deepEqual(
      selectWorkOrdersToBackfill({
        jobs,
        todayNZ: today,
        userId: "crew-1",
        isAdmin: false,
        assignedJobIds: ["assigned"],
      }),
      ["future", "assigned"],
    );
    assert.deepEqual(
      selectWorkOrdersToBackfill({ jobs, todayNZ: today, userId: "crew-2", isAdmin: false }),
      ["today"],
    );

    assert.equal(isFutureScheduledWorkOrder({ status: "work_order" }, ["2026-10-11", "2026-10-13"], today), true);
    assert.equal(isFutureScheduledWorkOrder({ status: "work_order" }, ["2026-10-01"], today), false);
  });

  it("does not call require() from server code that ships in the bundle", () => {
    const offenders: string[] = [];
    for (const file of listServerSources(SERVER_DIR)) {
      const text = fs.readFileSync(file, "utf8");
      if (/require\s*\(/.test(text)) offenders.push(path.relative(SERVER_DIR, file));
    }
    assert.deepEqual(offenders, []);

    const routes = fs.readFileSync(path.join(SERVER_DIR, "routes.ts"), "utf8");
    assert.match(routes, /import \{ google \} from "googleapis"/);
    assert.match(routes, /backfillFutureScheduledWorkOrders/);
    assert.match(routes, /googleCalendarRedirectUri/);

    const sync = fs.readFileSync(path.join(SERVER_DIR, "services", "googleCalendarSync.ts"), "utf8");
    assert.match(sync, /connectionSyncErrorPatch/);
    assert.match(sync, /backfillFutureScheduledWorkOrders/);

    const page = fs.readFileSync(
      path.resolve(SERVER_DIR, "../client/src/pages/Integrations.tsx"),
      "utf8",
    );
    assert.match(page, /CALENDAR_SYNC_BROKEN_NOTICE/);
    assert.match(page, /calendarSyncIsBroken/);
  });
});
