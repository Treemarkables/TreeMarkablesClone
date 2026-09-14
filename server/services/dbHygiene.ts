import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { alertOwner } from './healthCheck';

/**
 * Daily database-hygiene guard.
 *
 * Why this exists: in Aug/Sep 2026 the Neon bill quadrupled to $345/month and
 * nobody noticed for six weeks. Compute was flat; the cost was ~110 GB/day of
 * network egress caused by (a) a reminder cron creating ~1,900 notifications a
 * day that nothing ever archived, and (b) code that downloaded the whole
 * notifications table to answer "does one row exist?". Neither showed up in
 * any error log — the app worked, it was just quietly expensive.
 *
 * Two jobs, once a day:
 *
 * 1. RETENTION — archive notifications nobody will act on: reminder_* rows older
 *    than 14 days, anything else older than 90 days, plus anything past its own
 *    expiresAt. Archived rows stay in the table (the de-dup checks read them),
 *    they just leave the bell.
 *
 * 2. GROWTH GUARD — measure the things that blew up last time and alert the
 *    owner (email + admin push, same channel as the health check) when they
 *    cross a threshold:
 *      - notifications created in the last 24h
 *      - any single notification type > N in 24h (a runaway cron)
 *      - unarchived notifications (bell payload size)
 *      - notifications / job_diary_entries table size on disk
 *    Thresholds are generous multiples of normal Treemarkables volume
 *    (~50–100 notifications/day), so a healthy tenant onboarding won't trip
 *    them but a repeat of the Sep 2026 pattern trips within a day.
 *
 * Both instances run this (RUN_CRONS is per-app, not per-instance). The
 * retention UPDATE is idempotent, and alerts are state-transition based with a
 * 24h re-alert ceiling, so a duplicate run costs at most one extra email.
 */

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_RETENTION_DAYS = 14;
const GENERAL_RETENTION_DAYS = 90;

// Growth thresholds. Tune upward as tenant count grows — but each is a
// symptom of a bug, not of legitimate scale, at any count we expect soon.
const MAX_NOTIFICATIONS_PER_24H = 500;
const MAX_PER_TYPE_PER_24H = 250;
const MAX_UNARCHIVED_NOTIFICATIONS = 20_000;
const MAX_NOTIFICATIONS_TABLE_MB = 200;
const MAX_DIARY_TABLE_MB = 1024;

type Finding = { name: string; detail: string };

let lastHadFindings = false;
let lastAlertAt = 0;
const REALERT_MS = DAY_MS;

async function runRetention(): Promise<string> {
  const now = Date.now();
  const reminders = await storage.archiveNotificationsBefore(
    new Date(now - REMINDER_RETENTION_DAYS * DAY_MS),
    { typePrefix: 'reminder_' },
  );
  const general = await storage.archiveNotificationsBefore(
    new Date(now - GENERAL_RETENTION_DAYS * DAY_MS),
  );
  const expired = await db.execute(sql`
    UPDATE notifications SET archived = true
    WHERE archived = false AND expires_at IS NOT NULL AND expires_at < now()
  `);
  const expiredCount = Number((expired as unknown as { rowCount?: number }).rowCount ?? 0);
  return `archived ${reminders} stale reminders, ${general} notifications older than ${GENERAL_RETENTION_DAYS}d, ${expiredCount} expired`;
}

async function tableSizeMb(table: string): Promise<number> {
  const res = await db.execute(sql`
    SELECT pg_total_relation_size(${table}::regclass)::bigint AS bytes
  `);
  const row = (res as unknown as { rows?: Array<{ bytes: string | number }> }).rows?.[0];
  return row ? Number(row.bytes) / (1024 * 1024) : 0;
}

async function runGrowthGuard(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const stats = await storage.getNotificationVolumeStats();

  if (stats.createdLast24h > MAX_NOTIFICATIONS_PER_24H) {
    findings.push({
      name: 'Notification volume',
      detail: `${stats.createdLast24h} notifications created in the last 24h (limit ${MAX_NOTIFICATIONS_PER_24H}). ` +
        `Top types: ${stats.byTypeLast24h.slice(0, 3).map(t => `${t.type}=${t.count}`).join(', ')}`,
    });
  }
  for (const t of stats.byTypeLast24h) {
    if (t.count > MAX_PER_TYPE_PER_24H) {
      findings.push({
        name: `Runaway notification type "${t.type}"`,
        detail: `${t.count} created in 24h (limit ${MAX_PER_TYPE_PER_24H}) — a cron or poller is probably re-notifying instead of de-duping`,
      });
    }
  }
  if (stats.unarchived > MAX_UNARCHIVED_NOTIFICATIONS) {
    findings.push({
      name: 'Unarchived notifications',
      detail: `${stats.unarchived} unarchived rows (limit ${MAX_UNARCHIVED_NOTIFICATIONS}) — retention is not keeping up`,
    });
  }

  const notificationsMb = await tableSizeMb('notifications');
  if (notificationsMb > MAX_NOTIFICATIONS_TABLE_MB) {
    findings.push({
      name: 'notifications table size',
      detail: `${notificationsMb.toFixed(0)} MB on disk (limit ${MAX_NOTIFICATIONS_TABLE_MB} MB)`,
    });
  }
  const diaryMb = await tableSizeMb('job_diary_entries');
  if (diaryMb > MAX_DIARY_TABLE_MB) {
    findings.push({
      name: 'job_diary_entries table size',
      detail: `${diaryMb.toFixed(0)} MB on disk (limit ${MAX_DIARY_TABLE_MB} MB) — inline-image email bodies?`,
    });
  }

  console.log(
    `[db-hygiene] notifications: ${stats.createdLast24h}/24h, ${stats.unarchived} unarchived, ` +
    `${stats.total} total, ${notificationsMb.toFixed(0)} MB; diary ${diaryMb.toFixed(0)} MB`,
  );
  return findings;
}

export async function runDbHygiene(): Promise<void> {
  try {
    const summary = await runRetention();
    console.log(`[db-hygiene] retention: ${summary}`);
  } catch (e) {
    console.error('[db-hygiene] retention failed:', (e as Error).message);
  }

  let findings: Finding[] = [];
  try {
    findings = await runGrowthGuard();
  } catch (e) {
    console.error('[db-hygiene] growth guard failed:', (e as Error).message);
    return;
  }

  const hasFindings = findings.length > 0;
  const shouldAlert = hasFindings && (!lastHadFindings || Date.now() - lastAlertAt > REALERT_MS);
  if (shouldAlert) {
    await alertOwner({
      subject: `[ALERT] Database growth guard: ${findings.length} finding${findings.length === 1 ? '' : 's'}`,
      intro: 'The daily database-hygiene check found growth that will show up on the Neon bill:',
      lines: findings.map(f => ({ label: f.name, detail: f.detail })),
      outro: 'This is the pattern behind the Sep 2026 $345 Neon invoice (runaway notifications + full-table reads). ' +
        'Check Neon → Monitoring → Query performance on the production branch.',
      pushTitle: 'Database growth guard',
      pushBody: findings.map(f => f.name).join(', '),
    });
    lastAlertAt = Date.now();
  } else if (!hasFindings && lastHadFindings) {
    console.log('[db-hygiene] growth guard back within limits');
  }
  lastHadFindings = hasFindings;
}

/** Start the daily worker. Gated by RUN_CRONS at the call site. */
export function startDbHygieneWorker(): void {
  console.log('[db-hygiene] starting daily notification retention + growth guard');
  setTimeout(() => {
    runDbHygiene().catch(e => console.error('[db-hygiene] run error:', (e as Error).message));
  }, INITIAL_DELAY_MS);
  setInterval(() => {
    runDbHygiene().catch(e => console.error('[db-hygiene] run error:', (e as Error).message));
  }, INTERVAL_MS);
}
