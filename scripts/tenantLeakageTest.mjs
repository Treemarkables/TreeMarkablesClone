/**
 * Cross-tenant leakage test — the Phase-2 isolation go/no-go gate.
 *
 * Connects as the non-bypass `app_tenant` role on the DIRECT endpoint (mirroring
 * server/db.ts acquireTenantDb), sets each business's GUC, and asserts:
 *   1. a tenant sees ONLY its own rows (zero rows with a foreign business_id), and the
 *      visible count matches the owner-truth count for that business;
 *   2. an EMPTY GUC sees ZERO rows (fail-closed) — never another tenant's data.
 *
 * Run before onboarding a second tenant. Reads DATABASE_URL from env; pass two business
 * ids as argv (defaults to the dev Treemarkables + "Cut right" rows).
 *   node scripts/tenantLeakageTest.mjs [businessA] [businessB]
 *
 * Requires the DB to have the app_tenant role + RLS policies (Phase-2 fallback). Exits
 * non-zero if any table leaks.
 */
import pg from "pg";

const RAW = process.env.DATABASE_URL;
if (!RAW) { console.error("DATABASE_URL not set"); process.exit(2); }
// DIRECT endpoint: session SET ROLE/GUC only isolate on a direct (non-pooler) backend.
// Strip the query string (sslmode/channel_binding) — SSL is forced via the ssl option,
// which avoids a noisy pg sslmode deprecation warning on every run.
const DIRECT = (process.env.DIRECT_DATABASE_URL || RAW.replace("-pooler.", ".")).split("?")[0];

const A = process.argv[2] || "215d4e9b-2bf0-4ef8-98c4-1b02a435f7ce"; // dev Treemarkables
const B = process.argv[3] || "d554164a-fb5f-4cc4-874a-aa0bada0b3e1"; // dev "Cut right"

const TABLES = ["customers", "jobs", "photos", "invoices", "quotes", "leads", "employees", "tasks", "proposals"];

const pool = new pg.Pool({ connectionString: DIRECT, ssl: { rejectUnauthorized: false }, max: 4 });

async function ownerCount(table, biz) {
  const c = await pool.connect();
  try {
    const r = await c.query(`SELECT count(*)::int n FROM ${table} WHERE business_id = $1`, [biz]);
    return r.rows[0].n;
  } finally { c.release(); }
}

// What `app_tenant` sees with a given GUC. Returns {total, foreign} or {error}.
async function tenantView(table, guc) {
  const c = await pool.connect();
  try {
    await c.query("SET ROLE app_tenant");
    await c.query("SELECT set_config('app.current_business', $1, false)", [guc]);
    const probe = guc || "00000000-0000-0000-0000-000000000000";
    const r = await c.query(
      `SELECT count(*)::int total, count(*) FILTER (WHERE business_id <> $1)::int foreign_rows FROM ${table}`,
      [probe],
    );
    return { total: r.rows[0].total, foreign: r.rows[0].foreign_rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    try { await c.query("RESET ROLE"); await c.query("SELECT set_config('app.current_business','',false)"); } catch {}
    c.release();
  }
}

let failures = 0;
console.log(`\nCross-tenant leakage test\n  A = ${A}\n  B = ${B}\n  endpoint = ${DIRECT.replace(/:[^:@]+@/, ":***@")}\n`);
console.log("table".padEnd(14), "ownerA", "seesA", "ownerB", "seesB", "empty", "verdict");

for (const t of TABLES) {
  try {
    const [oA, oB] = [await ownerCount(t, A), await ownerCount(t, B)];
    const [vA, vB, vE] = [await tenantView(t, A), await tenantView(t, B), await tenantView(t, "")];
    if (vA.error || vB.error || vE.error) {
      console.log(t.padEnd(14), "—", "ERROR:", vA.error || vB.error || vE.error);
      failures++;
      continue;
    }
    const ok =
      vA.foreign === 0 && vA.total === oA &&        // A sees only A, all of A
      vB.foreign === 0 && vB.total === oB &&        // B sees only B, all of B
      vE.total === 0;                                // empty GUC sees nothing
    if (!ok) failures++;
    console.log(
      t.padEnd(14),
      String(oA).padEnd(6), String(vA.total).padEnd(5),
      String(oB).padEnd(6), String(vB.total).padEnd(5),
      String(vE.total).padEnd(5),
      ok ? "PASS" : `FAIL (A foreign=${vA.foreign}, B foreign=${vB.foreign}, empty=${vE.total})`,
    );
  } catch (e) {
    console.log(t.padEnd(14), "ERROR:", e.message);
    failures++;
  }
}

await pool.end();
console.log(`\n${failures === 0 ? "✅ ALL TABLES ISOLATED — safe to onboard tenant #2" : `❌ ${failures} table(s) FAILED isolation — DO NOT onboard`}\n`);
process.exit(failures === 0 ? 0 : 1);
