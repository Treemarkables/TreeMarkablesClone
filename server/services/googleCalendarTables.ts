import { pool } from "../db";
import { GOOGLE_CALENDAR_TABLES, googleCalendarTablesWarning } from "@shared/googleCalendarConnect";

/**
 * Startup check. Returns a warning string when google_calendar_connections,
 * google_event_links, or google_busy_events is absent. Does not create them.
 */
export async function warnIfGoogleCalendarTablesMissing(): Promise<string | null> {
  try {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [[...GOOGLE_CALENDAR_TABLES]],
    );
    return googleCalendarTablesWarning(result.rows.map((row) => row.table_name));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `⚠️ Google Calendar table check failed: ${message}`;
  }
}
