/**
 * Deep tenant-isolation audit — FK-reachability + policy-quality.
 *
 * The existing gate (scripts/checkTenantRlsPolicies.ts / db.ts
 * findTenantTablesMissingRlsPolicy) only inspects tables that carry a `business_id`
 * column. But under the Phase-2 blanket `GRANT … TO app_tenant`, ANY table without
 * RLS + a policy is cross-tenant readable — and a lot of tenant data lives in CHILD
 * tables that have no `business_id` of their own, only a foreign key to a parent
 * tenant table (job_diary_entries → jobs, customer_contacts → customers, …). RLS on
 * the parent does NOT cascade to the child, so those children can be wide open while
 * the business_id-only check reports "all clear."
 *
 * This audit closes that blind spot:
 *   1. TENANT CLOSURE — seed = every table with a `business_id` column, then expand
 *      over foreign keys: any table with an FK path to a tenant table is tenant data.
 *   2. CRITICAL — a table in the closure with RLS off OR no policy → cross-tenant
 *      readable/writable under the app_tenant grant. Exit code counts these.
 *   3. WARN — RLS on + a policy exists, but NO policy references the tenant GUC
 *      (`app.current_business`). The policy may be permissive (USING (true)) and not
 *      actually isolate — worth a human look.
 *
 * READ-ONLY (only queries pg catalogs) — safe to run against ANY database, prod
 * included. This is where you want to run it: the prod Neon branch is what matters.
 *
 *   set -a && source .env && set +a && npx tsx scripts/auditTenantRlsReachability.ts
 *
 * Honors TENANT_RLS_POLICY_EXEMPT (comma-separated) — same knob as the boot guard,
 * for genuinely-global tables that happen to carry a business_id / FK.
 * Exit code = number of CRITICAL findings (0 = clean), so CI can gate on it.
 */
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — point it at the database you want to audit (prod is fine, read-only).");
  process.exit(2);
}

const exempt = new Set(
  (process.env.TENANT_RLS_POLICY_EXEMPT || "").split(",").map((s) => s.trim()).filter(Boolean),
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface TableInfo { rlsOn: boolean; forceOn: boolean; hasBiz: boolean }
interface Policy { table: string; using: string | null; check: string | null }

async function main() {
  // 1) Every base table in `public` with its RLS flags + whether it carries business_id.
  const tablesRes = await pool.query(`
    SELECT c.relname                    AS tbl,
           c.relrowsecurity             AS rls_on,
           c.relforcerowsecurity        AS force_on,
           EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public'
                      AND col.table_name = c.relname
                      AND col.column_name = 'business_id') AS has_biz
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind = 'r'
     ORDER BY 1`);

  const tables = new Map<string, TableInfo>();
  for (const r of tablesRes.rows as Array<{ tbl: string; rls_on: boolean; force_on: boolean; has_biz: boolean }>) {
    tables.set(r.tbl, { rlsOn: r.rls_on, forceOn: r.force_on, hasBiz: r.has_biz });
  }

  // 2) Foreign-key edges (child → parent), both endpoints in `public`.
  const fkRes = await pool.query(`
    SELECT cc.relname AS child, pc.relname AS parent
      FROM pg_constraint con
      JOIN pg_class cc ON cc.oid = con.conrelid
      JOIN pg_class pc ON pc.oid = con.confrelid
      JOIN pg_namespace nn ON nn.oid = cc.relnamespace AND nn.nspname = 'public'
     WHERE con.contype = 'f' AND cc.relname <> pc.relname`);
  const edges = fkRes.rows as Array<{ child: string; parent: string }>;

  // 3) Policies with their USING / WITH CHECK expressions rendered to text.
  const polRes = await pool.query(`
    SELECT c.relname AS tbl,
           pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'`);
  const policiesByTable = new Map<string, Policy[]>();
  for (const r of polRes.rows as Array<{ tbl: string; using_expr: string | null; check_expr: string | null }>) {
    const list = policiesByTable.get(r.tbl) ?? [];
    list.push({ table: r.tbl, using: r.using_expr, check: r.check_expr });
    policiesByTable.set(r.tbl, list);
  }

  // 1→2 CLOSURE: a table is tenant data if it has business_id, or has an FK path to a
  // table that is tenant data. Iterate the edge set to a fixpoint.
  const tenant = new Set<string>();
  const reachVia = new Map<string, string>(); // table → "business_id" | "FK via <parent>"
  for (const [t, info] of tables) if (info.hasBiz) { tenant.add(t); reachVia.set(t, "business_id"); }
  let changed = true;
  while (changed) {
    changed = false;
    for (const { child, parent } of edges) {
      if (tenant.has(parent) && !tenant.has(child) && tables.has(child)) {
        tenant.add(child);
        reachVia.set(child, `FK → ${parent}`);
        changed = true;
      }
    }
  }

  const referencesGuc = (p: Policy) =>
    (p.using ?? "").includes("app.current_business") || (p.check ?? "").includes("app.current_business");

  const critical: Array<{ table: string; via: string; rlsOn: boolean; hasPolicy: boolean }> = [];
  const warn: Array<{ table: string; via: string }> = [];
  let fkOnlyCount = 0;

  for (const t of [...tenant].sort()) {
    if (exempt.has(t)) continue;
    const info = tables.get(t)!;
    const via = reachVia.get(t) ?? "?";
    if (!info.hasBiz) fkOnlyCount++;
    const policies = policiesByTable.get(t) ?? [];
    const hasPolicy = policies.length > 0;
    if (!info.rlsOn || !hasPolicy) {
      critical.push({ table: t, via, rlsOn: info.rlsOn, hasPolicy });
    } else if (!policies.some(referencesGuc)) {
      warn.push({ table: t, via });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const seed = [...tenant].filter((t) => tables.get(t)!.hasBiz).length;
  console.log(`Tenant-data closure: ${tenant.size} tables (${seed} via business_id, ${fkOnlyCount} via FK only).`);
  console.log(`Exemptions: ${exempt.size ? [...exempt].join(", ") : "(none)"}\n`);

  if (warn.length) {
    console.log(`⚠️  ${warn.length} table(s) have RLS + a policy that does NOT reference app.current_business`);
    console.log(`    (policy may be permissive / not actually isolating — verify):`);
    for (const w of warn) console.log(`    · ${w.table}  (${w.via})`);
    console.log("");
  }

  if (critical.length === 0) {
    console.log("✅ No cross-tenant-readable tenant tables. Every table in the closure has RLS + a policy.");
    process.exit(0); // warns are advisory and don't fail the gate; only criticals do
  }

  console.error(`🔴 ${critical.length} tenant table(s) are cross-tenant readable/writable (no RLS policy):`);
  for (const g of critical) {
    console.error(`   ✗ ${g.table}  (${g.via}; rls_on=${g.rlsOn}, has_policy=${g.hasPolicy})`);
  }
  console.error(
    "\nAdd ENABLE ROW LEVEL SECURITY + a tenant_isolation policy (see " +
      "migrations/manual/20260627_equipment_compliance_reminders_rls.sql), or exempt a " +
      "genuinely-global table via TENANT_RLS_POLICY_EXEMPT.",
  );
  process.exit(critical.length);
}

main()
  .catch((e) => {
    console.error("audit failed to run:", e instanceof Error ? e.message : String(e));
    process.exit(2);
  })
  .finally(() => pool.end());
