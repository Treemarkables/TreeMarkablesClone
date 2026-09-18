/**
 * Session hygiene over the connect-pg-simple `session` table (same store Wave 1
 * left in place). 30-day rolling cookies are untouched — this only lists and
 * deletes rows.
 */
import type pg from "pg";

export const SESSION_TABLE = "session";

export interface StoredSessionRow {
  sid: string;
  sess: Record<string, unknown>;
  expire: Date;
}

export interface SessionListItem {
  sid: string;
  current: boolean;
  createdAt: string | null;
  expiresAt: string;
  lastActiveAt: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceLabel: string;
  mfaVerified: boolean;
}

export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  const mobile = ios || android || /Mobile/i.test(ua);
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  const device = ios ? "iPhone" : android ? "Android" : mobile ? "Mobile" : "Desktop";
  return `${browser} on ${device}`;
}

function asObject(sess: unknown): Record<string, unknown> {
  if (sess && typeof sess === "object" && !Array.isArray(sess)) {
    return sess as Record<string, unknown>;
  }
  if (typeof sess === "string") {
    try {
      const parsed = JSON.parse(sess);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function cookieMaxAgeMs(sess: Record<string, unknown>): number {
  const cookie = sess.cookie as { originalMaxAge?: number } | undefined;
  const raw = cookie?.originalMaxAge;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return 1000 * 60 * 60 * 24 * 30;
}

export function toSessionListItem(row: StoredSessionRow, currentSid: string): SessionListItem {
  const sess = asObject(row.sess);
  const createdAt = typeof sess.sessionCreatedAt === "string" ? sess.sessionCreatedAt : null;
  const ua = typeof sess.userAgent === "string" ? sess.userAgent : null;
  const ip = typeof sess.ip === "string" ? sess.ip : null;
  const expiresAt = row.expire instanceof Date ? row.expire : new Date(row.expire);
  const lastActiveAt = new Date(expiresAt.getTime() - cookieMaxAgeMs(sess));
  return {
    sid: row.sid,
    current: row.sid === currentSid,
    createdAt,
    expiresAt: expiresAt.toISOString(),
    lastActiveAt: Number.isNaN(lastActiveAt.getTime()) ? null : lastActiveAt.toISOString(),
    ip,
    userAgent: ua,
    deviceLabel: summarizeUserAgent(ua),
    mfaVerified: sess.mfaVerified === true,
  };
}

const EMPLOYEE_SESSION_SQL = `(sess->>'employeeId' = $1 OR sess->>'pendingMfaEmployeeId' = $1)`;

async function getPool(): Promise<pg.Pool> {
  const { pool } = await import("../db");
  return pool;
}

export async function listEmployeeSessions(employeeId: string): Promise<StoredSessionRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT sid, sess, expire FROM ${SESSION_TABLE}
     WHERE expire > NOW()
       AND ${EMPLOYEE_SESSION_SQL}
     ORDER BY expire DESC`,
    [employeeId],
  );
  return result.rows.map((row) => ({
    sid: String(row.sid),
    sess: asObject(row.sess),
    expire: row.expire instanceof Date ? row.expire : new Date(row.expire),
  }));
}

export async function deleteEmployeeSession(employeeId: string, sid: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query(
    `DELETE FROM ${SESSION_TABLE}
     WHERE sid = $2
       AND ${EMPLOYEE_SESSION_SQL}`,
    [employeeId, sid],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteEmployeeSessions(
  employeeId: string,
  opts?: { keepSid?: string },
): Promise<number> {
  const pool = await getPool();
  if (opts?.keepSid) {
    const result = await pool.query(
      `DELETE FROM ${SESSION_TABLE}
       WHERE ${EMPLOYEE_SESSION_SQL}
         AND sid <> $2`,
      [employeeId, opts.keepSid],
    );
    return result.rowCount ?? 0;
  }
  const result = await pool.query(
    `DELETE FROM ${SESSION_TABLE}
     WHERE ${EMPLOYEE_SESSION_SQL}`,
    [employeeId],
  );
  return result.rowCount ?? 0;
}
