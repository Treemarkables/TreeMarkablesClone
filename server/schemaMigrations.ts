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
  {
    // AI voice agent (inbound IVR triage) settings + add-on catalog entry.
    name: "business-settings-voice-agent-columns",
    statements: [
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS voice_agent_enabled boolean DEFAULT false`,
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS voice_agent_greeting text DEFAULT 'Thanks for calling {businessName}. For a quick quote with our A.I. assistant, press 1. To speak to {ownerName}, press 2.'`,
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS voice_agent_voice text DEFAULT 'marin'`,
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS voice_agent_extra_instructions text DEFAULT ''`,
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS voice_agent_max_minutes integer DEFAULT 10`,
      `INSERT INTO add_ons (key, name, billing_type) VALUES ('voice_agent', 'AI Voice Agent', 'flat')
        ON CONFLICT (key) DO NOTHING`,
    ],
  },
  {
    // Shared AI knowledge document (Settings → AI Knowledge), injected into
    // AI prompts via buildBusinessKnowledgeBlock().
    name: "business-settings-ai-knowledge-column",
    statements: [
      `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS ai_knowledge text DEFAULT ''`,
    ],
  },
  {
    // Call recording add-on catalog entry — first gated add-on (calls sidebar/page/API
    // gate on addon:call_recording). Purchase path ships later; comped businesses get
    // it via resolveEntitlements.
    name: "add-on-call-recording",
    statements: [
      `INSERT INTO add_ons (key, name, billing_type) VALUES ('call_recording', 'Call Recording', 'flat')
        ON CONFLICT (key) DO NOTHING`,
    ],
  },
  {
    // ServiceM8 migration (Settings → Import & Migration): job-level import
    // provenance + source id so re-running an import dedups instead of duplicating.
    // Mirrors the columns customers has had since the original TM import.
    name: "jobs-import-source-columns",
    statements: [
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_source text DEFAULT 'manual'`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_id text`,
    ],
  },
  {
    // ServiceM8 import run lock + progress, shared across app instances.
    // The app runs 2 instances — an in-memory guard let overlapping runs start
    // (each blind to the other's), which duplicated every record ~11x on the
    // first real migration. One row per business: `running` is the lock,
    // `progress` the live state the status endpoint reports.
    name: "servicem8-import-runs-table",
    statements: [
      `CREATE TABLE IF NOT EXISTS servicem8_import_runs (
        business_id varchar PRIMARY KEY REFERENCES businesses(id),
        running boolean NOT NULL DEFAULT false,
        progress jsonb,
        started_at timestamp,
        finished_at timestamp,
        updated_at timestamp DEFAULT now()
      )`,
    ],
    postChecks: async (client) => {
      const role = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant' LIMIT 1`);
      if (role.rowCount === 0) return;
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON servicem8_import_runs TO app_tenant`);
      await client.query(`ALTER TABLE servicem8_import_runs ENABLE ROW LEVEL SECURITY`);
      const pol = await client.query(
        `SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'servicem8_import_runs'::regclass LIMIT 1`,
      );
      if (pol.rowCount === 0) {
        await client.query(
          `CREATE POLICY tenant_isolation ON servicem8_import_runs
             USING (business_id = nullif(current_setting('app.current_business', true), ''))
             WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''))`,
        );
      }
    },
  },
  {
    // Per-tenant job numbering (owner decision 2026-07-13): job numbers become
    // unique PER BUSINESS instead of globally, so one tenant's activity (or a
    // bulk migration) no longer inflates everyone else's numbers. The composite
    // index goes in FIRST; only then is the legacy global constraint dropped in
    // postChecks (globally-unique data always satisfies the composite, so the
    // create can't fail and there is never a window without uniqueness).
    // NOTE: the drop is a deliberate exception to the "strictly additive" rule —
    // it removes a CONSTRAINT (schema shape), never data, and is guarded +
    // idempotent via pg_catalog discovery (the constraint's name varies by how
    // the DB was provisioned).
    name: "jobs-per-tenant-numbering",
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS jobs_business_job_number_uniq ON jobs (business_id, job_number)`,
    ],
    postChecks: async (client) => {
      // Unique CONSTRAINTS on exactly (job_number)
      const cons = await client.query(`
        SELECT c.conname FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'jobs' AND c.contype = 'u' AND array_length(c.conkey, 1) = 1
          AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = c.conkey[1]) = 'job_number'
      `);
      for (const row of cons.rows) {
        await client.query(`ALTER TABLE jobs DROP CONSTRAINT "${row.conname}"`);
      }
      // Plain unique INDEXES on exactly (job_number) not backed by a constraint
      const idx = await client.query(`
        SELECT i.relname FROM pg_index x
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_class t ON t.oid = x.indrelid
        WHERE t.relname = 'jobs' AND x.indisunique AND x.indnatts = 1
          AND i.relname <> 'jobs_business_job_number_uniq'
          AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = x.indkey[0]) = 'job_number'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conindid = x.indexrelid)
      `);
      for (const row of idx.rows) {
        await client.query(`DROP INDEX "${row.relname}"`);
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
