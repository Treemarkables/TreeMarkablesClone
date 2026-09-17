/**
 * Shared rate-limit store used by the login throttle and public write limiter.
 *
 * Postgres (not Redis / in-memory) because:
 * - Production runs 2 App Platform instances; an in-memory Map is the same class
 *   of bug as the cron duplicate-send (each instance has its own ceiling).
 * - Sessions already live in this Postgres (`connect-pg-simple`); no new infra.
 * - Rows survive deploys. Redis is not in the stack.
 *
 * Owner-pool only (no tenant RLS). Fail-open on store errors so a missing table
 * after a non-fatal boot-migration hiccup cannot lock field crews out of login.
 */
import type pg from "pg";

async function getPool(): Promise<pg.Pool> {
  const { pool } = await import("../db");
  return pool;
}

export interface RateLimitRow {
  count: number;
  resetAt: Date;
}

export interface RateLimitBackend {
  increment(key: string, windowMs: number, now?: Date): Promise<RateLimitRow>;
  resetKey(key: string): Promise<void>;
  get(key: string): Promise<RateLimitRow | undefined>;
}

/** Pure windowed-counter semantics — mirrored by the Postgres UPSERT. */
export function applyIncrement(
  existing: { count: number; resetAtMs: number } | undefined,
  nowMs: number,
  windowMs: number,
): { count: number; resetAtMs: number } {
  if (!existing || existing.resetAtMs <= nowMs) {
    return { count: 1, resetAtMs: nowMs + windowMs };
  }
  return { count: existing.count + 1, resetAtMs: existing.resetAtMs };
}

const PRUNE_EVERY = 100;
let incrementCount = 0;

const postgresBackend: RateLimitBackend = {
  async increment(key, windowMs, now = new Date()) {
    const pool = await getPool();
    const resetAt = new Date(now.getTime() + windowMs);
    const result = await pool.query<{ count: number; reset_at: Date }>(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE
           WHEN rate_limits.reset_at <= NOW() THEN 1
           ELSE rate_limits.count + 1
         END,
         reset_at = CASE
           WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at
           ELSE rate_limits.reset_at
         END
       RETURNING count, reset_at`,
      [key, resetAt],
    );
    incrementCount += 1;
    if (incrementCount % PRUNE_EVERY === 0) {
      void getPool()
        .then((p) => p.query(`DELETE FROM rate_limits WHERE reset_at < NOW()`))
        .catch((err: unknown) => {
          console.error("[rate-limit] prune failed:", err instanceof Error ? err.message : err);
        });
    }
    const row = result.rows[0];
    return { count: row.count, resetAt: row.reset_at };
  },

  async resetKey(key) {
    const pool = await getPool();
    await pool.query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
  },

  async get(key) {
    const pool = await getPool();
    const result = await pool.query<{ count: number; reset_at: Date }>(
      `SELECT count, reset_at FROM rate_limits WHERE key = $1 AND reset_at > NOW()`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return { count: row.count, resetAt: row.reset_at };
  },
};

let backend: RateLimitBackend = postgresBackend;

export function setRateLimitBackendForTests(next: RateLimitBackend | null): void {
  backend = next ?? postgresBackend;
}

export async function incrementRateLimit(key: string, windowMs: number): Promise<RateLimitRow> {
  try {
    return await backend.increment(key, windowMs);
  } catch (err) {
    console.error(
      "[rate-limit] store increment failed (fail-open):",
      err instanceof Error ? err.message : err,
    );
    return { count: 1, resetAt: new Date(Date.now() + windowMs) };
  }
}

export async function resetRateLimitKey(key: string): Promise<void> {
  try {
    await backend.resetKey(key);
  } catch (err) {
    console.error(
      "[rate-limit] store reset failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getRateLimit(key: string): Promise<RateLimitRow | undefined> {
  try {
    return await backend.get(key);
  } catch (err) {
    console.error(
      "[rate-limit] store get failed:",
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

/** In-memory backend that matches the Postgres UPSERT semantics (tests / local). */
export function createMemoryRateLimitBackend(): RateLimitBackend {
  const rows = new Map<string, { count: number; resetAtMs: number }>();
  return {
    async increment(key, windowMs, now = new Date()) {
      const next = applyIncrement(rows.get(key), now.getTime(), windowMs);
      rows.set(key, next);
      return { count: next.count, resetAt: new Date(next.resetAtMs) };
    },
    async resetKey(key) {
      rows.delete(key);
    },
    async get(key) {
      const row = rows.get(key);
      if (!row || row.resetAtMs <= Date.now()) return undefined;
      return { count: row.count, resetAt: new Date(row.resetAtMs) };
    },
  };
}
