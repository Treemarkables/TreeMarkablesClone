/**
 * Inflow — create a new tenant (concierge onboarding).
 *
 * Creates a `business` row, a `business_settings` row, and a first admin `employee`
 * (bcrypt password) so a new company can log in immediately. Runs as the DB owner
 * (creating a tenant is a platform-operator action), so it sets `business_id` explicitly
 * on every insert — the column default is Treemarkables, which would be wrong here.
 *
 * Usage (set DATABASE_URL to the target branch — DEV to test, PROD to onboard a real customer):
 *   npx tsx scripts/create-tenant.mts \
 *     --name "Acme Trees Ltd" --email admin@acme.co.nz --password "TempPass1234" \
 *     --first Jane --last Doe [--position Owner]
 *
 * The admin should change their password on first login. Email must be globally unique
 * (login looks up employees by email across all tenants).
 */
import pg from "pg";
import bcrypt from "bcrypt";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = arg("--name");
const email = arg("--email")?.toLowerCase().trim();
const password = arg("--password");
const first = arg("--first");
const last = arg("--last");
const position = arg("--position") ?? "Owner";

if (!name || !email || !password || !first || !last) {
  console.error("Missing args. Required: --name --email --password --first --last  (optional --position)");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — point it at the target branch (dev to test, prod to onboard).");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  // guard: email + slug must be free
  const dupEmail = await c.query(`SELECT 1 FROM employees WHERE lower(email) = $1 LIMIT 1`, [email]);
  if (dupEmail.rowCount) throw new Error(`An employee with email ${email} already exists (login is by email, must be unique).`);
  const dupSlug = await c.query(`SELECT 1 FROM businesses WHERE slug = $1 LIMIT 1`, [slug]);
  if (dupSlug.rowCount) throw new Error(`A business with slug "${slug}" already exists. Pick a different --name.`);

  await c.query("BEGIN");
  const hash = await bcrypt.hash(password, 10);
  const { rows: [biz] } = await c.query(
    `INSERT INTO businesses (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`, [name, slug]);
  await c.query(
    `INSERT INTO business_settings (business_id, business_name) VALUES ($1, $2)`, [biz.id, name]);
  const { rows: [emp] } = await c.query(
    `INSERT INTO employees (business_id, first_name, last_name, position, email, password, role, status, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', 'active', true) RETURNING id`,
    [biz.id, first, last, position, email, hash]);
  await c.query("COMMIT");

  console.log(`\n✅ Tenant created`);
  console.log(`   business:  ${name}  (id ${biz.id}, slug ${slug})`);
  console.log(`   admin:     ${first} ${last} <${email}>  (employee ${emp.id})`);
  console.log(`   login at:  https://app.treemarkables.co.nz  with that email + the password you set`);
  console.log(`   ⚠ tell them to change the password on first login.\n`);
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("\n❌ Failed:", (e as Error).message, "\n");
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
