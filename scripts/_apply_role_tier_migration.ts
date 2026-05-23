// One-off migration: add role_tiers table + employee.role_tier_id + employee.permission_overrides.
// Idempotent — safe to re-run. Run from worktree root:
//   set -a && source .env && set +a && npx tsx scripts/_apply_role_tier_migration.ts
import pg from "pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("sslmode=")
      ? undefined
      : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. role_tiers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "role_tiers" (
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
      );
    `);

    // 2. employees.role_tier_id + FK (use IF NOT EXISTS so this is rerun-safe)
    await client.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "role_tier_id" varchar;
    `);

    // FK can't use IF NOT EXISTS; check pg_constraint first
    const fk = await client.query(`
      SELECT 1 FROM pg_constraint
       WHERE conname = 'employees_role_tier_id_role_tiers_id_fk'
    `);
    if (fk.rowCount === 0) {
      await client.query(`
        ALTER TABLE "employees"
          ADD CONSTRAINT "employees_role_tier_id_role_tiers_id_fk"
          FOREIGN KEY ("role_tier_id") REFERENCES "role_tiers"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      `);
    }

    // 3. employees.permission_overrides
    await client.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "permission_overrides" jsonb
        DEFAULT '{"grant":[],"deny":[]}'::jsonb;
    `);

    await client.query("COMMIT");

    // Sanity check
    const { rows: tierRows } = await client.query(
      `SELECT to_regclass('public.role_tiers') AS exists`,
    );
    const { rows: colRows } = await client.query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_name = 'employees'
         AND column_name IN ('role_tier_id', 'permission_overrides')
       ORDER BY column_name;
    `);

    console.log("\n=== migration applied ===");
    console.log("role_tiers table:", tierRows[0]?.exists);
    console.log("new employees columns:");
    for (const r of colRows) console.log(`  ${r.column_name} (${r.data_type})`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
