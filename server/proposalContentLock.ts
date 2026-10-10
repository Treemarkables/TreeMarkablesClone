/**
 * Proposal saves rewrite every section and line item.
 *
 * The old handler read the section ids, deleted those ids, then inserted the
 * payload. Two overlapping saves (the builder auto-save plus Send, or a
 * double tap) both read the same ids. Each deleted only those ids, so the
 * second delete missed the first insert and the proposal kept two copies of
 * every line. Job 4208 went from $850 ex GST to $1,700 that way.
 *
 * The rewrite now holds a short lease in `rate_limits` (shared by both app
 * instances — an in-memory lock would not) and, inside that lease, deletes
 * every current section and line for the proposal before inserting.
 */

import type pg from "pg";

const LEASE_TTL_MS = 60_000;
const WAIT_MS = 15_000;
const POLL_MS = 40;

export function proposalContentLockKey(proposalId: string): string {
  return `proposal-content-lock:${proposalId}`;
}

export interface LeaseLock {
  tryAcquire(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

export async function withLease<T>(
  lock: LeaseLock,
  key: string,
  fn: () => Promise<T>,
  opts?: { waitMs?: number; pollMs?: number; ttlMs?: number },
): Promise<T> {
  const waitMs = opts?.waitMs ?? WAIT_MS;
  const pollMs = opts?.pollMs ?? POLL_MS;
  const ttlMs = opts?.ttlMs ?? LEASE_TTL_MS;
  const deadline = Date.now() + waitMs;
  let acquired = false;
  while (Date.now() <= deadline) {
    if (await lock.tryAcquire(key, ttlMs)) {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  if (!acquired) {
    throw new Error("Timed out waiting to save this proposal. Try again.");
  }
  try {
    return await fn();
  } finally {
    await lock.release(key);
  }
}

/** In-memory lease. tryAcquire is atomic on the JS thread (no await before the write). */
export function createMemoryLeaseLock(): LeaseLock {
  const held = new Map<string, number>();
  return {
    async tryAcquire(key, ttlMs) {
      const now = Date.now();
      const expires = held.get(key);
      if (expires != null && expires > now) return false;
      held.set(key, now + ttlMs);
      return true;
    },
    async release(key) {
      held.delete(key);
    },
  };
}

async function getPool(): Promise<pg.Pool> {
  const { pool } = await import("./db");
  return pool;
}

export function createPostgresLeaseLock(): LeaseLock {
  return {
    async tryAcquire(key, ttlMs) {
      const pool = await getPool();
      const result = await pool.query(
        `INSERT INTO rate_limits (key, count, reset_at)
         VALUES ($1, 1, NOW() + ($2::int * interval '1 millisecond'))
         ON CONFLICT (key) DO UPDATE SET
           count = rate_limits.count + 1,
           reset_at = NOW() + ($2::int * interval '1 millisecond')
         WHERE rate_limits.reset_at <= NOW()
         RETURNING key`,
        [key, ttlMs],
      );
      return (result.rowCount ?? 0) > 0;
    },
    async release(key) {
      const pool = await getPool();
      await pool.query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
    },
  };
}

let lockImpl: LeaseLock = createPostgresLeaseLock();

export function setProposalContentLockForTests(next: LeaseLock | null): void {
  lockImpl = next ?? createPostgresLeaseLock();
}

export async function withProposalContentLock<T>(proposalId: string, fn: () => Promise<T>): Promise<T> {
  return withLease(lockImpl, proposalContentLockKey(proposalId), fn);
}

export interface ProposalContentDeps {
  listSections(proposalId: string): Promise<{ id: string }[]>;
  deleteSection(id: string): Promise<void>;
  listItems(proposalId: string): Promise<{ id: string }[]>;
  deleteItemChoices(itemId: string): Promise<void>;
  deleteItem(id: string): Promise<void>;
}

/**
 * Drop every section and line currently stored for this proposal, including
 * rows a save that just finished inserted and lines whose section is already
 * gone. Caller must hold `withProposalContentLock`.
 */
export async function clearProposalContent(proposalId: string, deps: ProposalContentDeps): Promise<void> {
  const sections = await deps.listSections(proposalId);
  for (const section of sections) {
    await deps.deleteSection(section.id);
  }
  const leftovers = await deps.listItems(proposalId);
  for (const item of leftovers) {
    await deps.deleteItemChoices(item.id);
    await deps.deleteItem(item.id);
  }
}
