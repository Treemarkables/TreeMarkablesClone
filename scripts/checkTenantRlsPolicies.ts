/**
 * Tenant-isolation gate: exits non-zero if any table carrying a `business_id`
 * column lacks RLS + a policy (= cross-tenant readable under the app_tenant grant).
 * Use as a CI / pre-deploy check against the target database.
 *
 *   set -a && source .env && set +a && npx tsx scripts/checkTenantRlsPolicies.ts
 *
 * Honors TENANT_RLS_POLICY_EXEMPT (comma-separated). Unlike the boot guard
 * (assertTenantTablesHaveRlsPolicies, which only hard-fails under TENANT_RLS_STRICT),
 * this ALWAYS hard-fails on a gap — that is the point of a gate. Shares the exact
 * detection logic, so the two can never drift.
 */
import { findTenantTablesMissingRlsPolicy } from "../server/db";

async function main() {
  const gaps = await findTenantTablesMissingRlsPolicy();
  if (gaps.length === 0) {
    console.log("✅ every business_id table has RLS + a policy");
    process.exit(0);
  }
  console.error(`🔴 ${gaps.length} business_id table(s) missing RLS isolation:`);
  for (const g of gaps) console.error(`   ✗ ${g.table} (rls_on=${g.rlsOn}, has_policy=${g.hasPolicy})`);
  console.error(
    "\nAdd ENABLE ROW LEVEL SECURITY + a tenant_isolation policy (see " +
      "migrations/manual/20260627_equipment_compliance_reminders_rls.sql), or exempt a " +
      "genuinely-global table via TENANT_RLS_POLICY_EXEMPT.",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error("check failed to run:", e instanceof Error ? e.message : String(e));
  process.exit(2);
});
