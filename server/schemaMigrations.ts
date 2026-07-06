// ============================================================================
// Boot-time idempotent schema migrations ("self-healing schema").
//
// When a code change adds a new column or table, add the corresponding SQL here
// (use `IF NOT EXISTS` / pre-checks so it's safe to re-run). The runtime calls
// `ensureSchemaUpToDate()` once at startup, so a fresh deploy makes the production
// database catch up automatically — no manual Neon console step. This is what
// would have prevented the deposit-column and billing-table scrambles where the
// deployed code outran the prod DB schema.
//
// Rules:
// - Append-only. Past migrations stay; new ones are added at the bottom.
// - Strictly idempotent: re-running must be a no-op (every boot re-runs them).
// - Strictly additive: NO DROP, NO DELETE, NO type-changing ALTER COLUMN.
//   Anything destructive belongs in a manual one-shot script.
// - Each migration runs inside its own transaction.
// ============================================================================
import type { PoolClient } from "pg";
import { pool } from "./db";

interface Migration {
  // Stable name shown in logs. Append-only — do not rename existing entries.
  name: string;
  // Statements executed inside a single transaction, in order.
  statements: string[];
  // Optional follow-ups for things plain `IF NOT EXISTS` can't express
  // (RLS policies, FK constraints) — must be idempotent via pg_catalog pre-checks.
  postChecks?: (client: PoolClient) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    // Proposal-deposit feature columns (shipped in code; missing on prod until now).
    name: "business-settings-deposit-columns",
    statements: [
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_deposit_type text DEFAULT 'none'`,
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_deposit_value numeric(10,2) DEFAULT '0.00'`,
    ],
  },
  {
    // Subscription billing schema (plans + add-ons catalog, tenant-scoped subscriptions).
    name: "subscription-billing-tables",
    statements: [
      `CREATE TABLE IF NOT EXISTS subscription_plans (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE, name text NOT NULL,
        stripe_price_id text, price_nzd numeric(10,2) NOT NULL DEFAULT 0,
        interval text NOT NULL DEFAULT 'month', active_job_cap integer,
        sms_cap integer, ai_action_cap integer,
        is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS add_ons (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE, name text NOT NULL, stripe_price_id text,
        price_nzd numeric(10,2), billing_type text NOT NULL DEFAULT 'flat',
        is_active boolean NOT NULL DEFAULT true)`,
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id varchar NOT NULL REFERENCES businesses(id),
        plan_id varchar REFERENCES subscription_plans(id),
        stripe_customer_id text, stripe_subscription_id text,
        status text NOT NULL DEFAULT 'active', current_period_end timestamp,
        cancel_at_period_end boolean NOT NULL DEFAULT false, trial_end timestamp,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS business_add_ons (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id varchar NOT NULL REFERENCES businesses(id),
        add_on_id varchar REFERENCES add_ons(id),
        status text NOT NULL DEFAULT 'active', stripe_subscription_item_id text,
        activated_at timestamp DEFAULT now())`,
      `INSERT INTO subscription_plans (key, name, stripe_price_id, price_nzd, active_job_cap, sms_cap, ai_action_cap, sort_order) VALUES
        ('freemium','Freemium', NULL, 0, 15, 0, 0, 0),
        ('crew','Crew', 'price_1Tf0Z6LboGXT31TYwrPjNonb', 89, 75, 200, 75, 1),
        ('business','Business', 'price_1Tf0Z7LboGXT31TYR2GirPLw', 150, NULL, 600, 250, 2)
        ON CONFLICT (key) DO NOTHING`,
    ],
    postChecks: async (client) => {
      // RLS isolation + grants only when the app_tenant role exists (RLS-enabled
      // deployments). Each step is guarded so the whole thing re-runs as a no-op.
      const role = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant' LIMIT 1`);
      if (role.rowCount === 0) return;
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_plans, add_ons, subscriptions, business_add_ons TO app_tenant`,
      );
      for (const t of ["subscriptions", "business_add_ons"]) {
        await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
        const pol = await client.query(
          `SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = $1::regclass LIMIT 1`,
          [t],
        );
        if (pol.rowCount === 0) {
          await client.query(
            `CREATE POLICY tenant_isolation ON ${t}
               USING (business_id = nullif(current_setting('app.current_business', true), ''))
               WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''))`,
          );
        }
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
          await client.query("BEGIN");
          try {
            for (const stmt of migration.statements) {
              await client.query(stmt);
            }
            if (migration.postChecks) await migration.postChecks(client);
            await client.query("COMMIT");
            console.log(`[schema] ok: ${migration.name}`);
          } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw new Error(
              `Schema migration "${migration.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
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
