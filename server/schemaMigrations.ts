// ============================================================================
// Boot-time idempotent schema migrations.
//
// When a code change adds a new column or table, add the corresponding SQL
// here (use `IF NOT EXISTS` / pre-checks so it's safe to re-run). The runtime
// calls `ensureSchemaUpToDate()` once at startup, so a fresh DO deploy makes
// the production database catch up automatically — no manual console step.
//
// Rules:
// - Append-only. Past migrations stay; new ones are added at the bottom.
// - Strictly idempotent: re-running must be a no-op.
// - Strictly additive: NO DROP, NO DELETE, NO type-changing ALTER COLUMN.
//   Anything destructive belongs in a manual one-shot script.
// - Each migration runs inside its own transaction.
// ============================================================================
import type { PoolClient } from 'pg';
import { pool } from './db';

interface Migration {
  // Stable name shown in logs. Append-only — do not rename existing entries.
  name: string;
  // Statements executed inside a single transaction, in order.
  statements: string[];
  // Optional follow-ups for things SQL `IF NOT EXISTS` doesn't cover (e.g.
  // foreign-key constraints, which need a pg_constraint pre-check).
  postChecks?: (client: PoolClient) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'role-tiers-and-employee-permissions',
    statements: [
      `CREATE TABLE IF NOT EXISTS "role_tiers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text,
        "name" text NOT NULL,
        "description" text,
        "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "is_system" boolean DEFAULT false NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "role_tier_id" varchar`,
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "permission_overrides" jsonb DEFAULT '{"grant":[],"deny":[]}'::jsonb`,
    ],
    postChecks: async (client) => {
      const fk = await client.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_tier_id_role_tiers_id_fk' LIMIT 1`,
      );
      if (fk.rowCount === 0) {
        await client.query(
          `ALTER TABLE "employees" ADD CONSTRAINT "employees_role_tier_id_role_tiers_id_fk"
             FOREIGN KEY ("role_tier_id") REFERENCES "role_tiers"("id")
             ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
      }
    },
  },
];

let migrationPromise: Promise<void> | null = null;

export function ensureSchemaUpToDate(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const client = await pool.connect();
      try {
        for (const migration of MIGRATIONS) {
          await client.query('BEGIN');
          try {
            for (const stmt of migration.statements) {
              await client.query(stmt);
            }
            if (migration.postChecks) await migration.postChecks(client);
            await client.query('COMMIT');
            console.log(`[schema] applied: ${migration.name}`);
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw new Error(
              `Schema migration "${migration.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        console.error('[schema] migration run failed:', err);
        // Reset so a later call can retry (e.g. transient Neon connectivity).
        migrationPromise = null;
        throw err;
      } finally {
        client.release();
      }
    })();
  }
  return migrationPromise;
}
