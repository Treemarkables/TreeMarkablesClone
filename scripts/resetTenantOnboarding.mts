/**
 * Reset a TEST tenant's onboarding/setup state back to "fresh signup" so the
 * setup checklist (/settings/setup + the dashboard banner) can be walked
 * through again — e.g. for recording how-to videos.
 *
 * The checklist (buildOnboardingChecklist in server/routes.ts) is fully
 * DERIVED — there is no stored "onboarding complete" flag — so resetting it
 * means blanking the fields it reads:
 *   - business_settings: owner name, bank account name/number, GST number,
 *     trade vocabulary, reply-forward email
 *   - document_templates (all of the tenant's): logo, company phone, company
 *     address (company name + email stay, matching a real fresh signup)
 *   - tenant_channels: all rows removed
 *   - customers created by seedMetricsShowcase: import_source flipped to
 *     'manual' so the optional "Import your data" item reads undone (rows
 *     stay tagged via notes so the seeder's SEED_WIPE still finds them)
 *
 * It does NOT touch jobs/proposals/invoices/leads — the seeded metrics data
 * survives, only the setup checklist resets.
 *
 * NOTE for recording: the "Finish setting up your account" banner dismissal is
 * per-browser localStorage ('onboarding_banner_dismissed') — record in a fresh
 * or incognito window if you've dismissed it before.
 *
 * Usage (DATABASE_URL = target branch; dev to test, prod via DO console):
 *   SEED_CONFIRM=yes SEED_BUSINESS_NAME='Cut above' npx tsx scripts/resetTenantOnboarding.mts
 */
import pg from "pg";

const CUSTOMER_TAG = "[demo-seed] Fictional showcase data — safe to delete.";
const TM_ID_PREFIXES = ["a985f349", "215d4e9b"];

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (process.env.SEED_CONFIRM !== "yes") {
  fail("Refusing to run without SEED_CONFIRM=yes (guards against accidental runs).");
}
const businessName = process.env.SEED_BUSINESS_NAME;
if (!businessName) {
  fail("SEED_BUSINESS_NAME is not set. Point it at the TEST tenant's exact business name, e.g. 'Cut above'.");
}
if (businessName.toLowerCase().includes("treemarkables")) {
  fail("This reset is for TEST tenants only — it will not touch Treemarkables.");
}
if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL not set — point it at the target branch (dev to test, prod for the real demo).");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();

try {
  const bizRes = await c.query(`SELECT id, name FROM businesses WHERE name = $1`, [businessName]);
  if (bizRes.rows.length !== 1) {
    const all = await c.query(`SELECT name FROM businesses ORDER BY created_at`);
    fail(
      `Expected exactly one business named '${businessName}', found ${bizRes.rows.length}.\n` +
        `   Businesses on this database: ${all.rows.map((r) => `'${r.name}'`).join(", ")}`,
    );
  }
  const bizId: string = bizRes.rows[0].id;
  if (TM_ID_PREFIXES.some((p) => bizId.startsWith(p))) {
    fail(`Business '${businessName}' resolves to a Treemarkables id (${bizId}) — refusing.`);
  }
  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`\nTarget: '${businessName}' (${bizId}) on ${host}\n`);

  await c.query("BEGIN");

  const settings = await c.query(
    `UPDATE business_settings SET
       owner_name = '',
       bank_account_name = '',
       bank_account_number = '',
       business_gst_number = '',
       trade_vocabulary = '',
       job_reply_forward_email = NULL,
       updated_at = now()
     WHERE business_id = $1`,
    [bizId],
  );
  console.log(`  blanked business settings (${settings.rowCount} row)`);

  const templates = await c.query(
    `UPDATE document_templates SET
       logo_url = NULL,
       company_phone = '',
       company_address = '',
       updated_at = now()
     WHERE business_id = $1`,
    [bizId],
  );
  console.log(`  blanked logo/phone/address on ${templates.rowCount} document templates`);

  const channels = await c.query(`DELETE FROM tenant_channels WHERE business_id = $1`, [bizId]);
  console.log(`  removed ${channels.rowCount} inbound channels`);

  // Seeded customers count as "imported" (import_source != manual), which
  // marks the Import-your-data item done. Flip them to manual but keep the
  // notes tag so seedMetricsShowcase's SEED_WIPE still finds them.
  const customers = await c.query(
    `UPDATE customers SET import_source = 'manual', notes = $2, updated_at = now()
     WHERE business_id = $1 AND (import_source = 'demo_seed' OR notes = $2)`,
    [bizId, CUSTOMER_TAG],
  );
  console.log(`  un-flagged ${customers.rowCount} seeded customers as imports`);

  await c.query("COMMIT");

  // Recompute the checklist the same way the server does, so the result is visible here.
  const [s] = (await c.query(`SELECT business_name, owner_name, bank_account_name, bank_account_number FROM business_settings WHERE business_id = $1`, [bizId])).rows;
  const [t] = (await c.query(`SELECT logo_url, company_phone, company_email, company_address FROM document_templates WHERE business_id = $1 AND type = 'invoice' AND is_default = true LIMIT 1`, [bizId])).rows ?? [];
  const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const required = [
    ["Business name", has(s?.business_name)],
    ["Owner name", has(s?.owner_name)],
    ["Logo", has(t?.logo_url)],
    ["Contact details", has(t?.company_phone) && has(t?.company_email)],
    ["Business address", has(t?.company_address)],
    ["Bank details", has(s?.bank_account_name) && has(s?.bank_account_number)],
    ["Inbound channels", false],
  ] as const;
  const done = required.filter(([, d]) => d).length;
  console.log(`\nChecklist after reset: ${done} of ${required.length} required items done`);
  for (const [label, d] of required) console.log(`  ${d ? "✓" : "○"} ${label}`);
  console.log(`\n✅ Done. Log in as '${businessName}' — the setup banner + /settings/setup start fresh.`);
  console.log(`   (Record in an incognito window if you've dismissed the banner before.)\n`);
} catch (err) {
  await c.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exit(1);
} finally {
  c.release();
  await pool.end();
}
