/**
 * Inflow — cross-tenant isolation test ("the gate before tenant #2").
 *
 * Seeds two throwaway tenants (A + B) with distinct customers / leads / jobs, logs in as
 * each tenant's admin over HTTP, then drives a matrix of real endpoints and asserts that
 * tenant A never sees ANY of tenant B's rows (and vice-versa). Because every seeded row id
 * is a UUID, the leak check is simply: does A's response body contain any of B's ids?
 *
 * It also probes the session-less / owner-path surfaces I expect to be weak (the customer
 * portal, public resource links) so the output tells you exactly which routes isolate vs
 * leak vs fail-closed — not just "RLS works."
 *
 *   SECURITY FAIL  = a tenant saw the OTHER tenant's data (cross-tenant leak). Hard fail.
 *   FUNCTIONAL WARN = a tenant could not see its OWN data (likely fail-closed / broken),
 *                     or an endpoint errored. Not a leak, but worth knowing.
 *
 * Usage (point DATABASE_URL at a NON-PROD branch — it seeds + tears down real rows):
 *   # start the dev server first (it must run with TENANT_RLS_ENABLED=true to mean anything)
 *   set -a && source .env && set +a
 *   TEST_BASE_URL=http://localhost:5001 npx tsx scripts/tenancyIsolationTest.mts
 *
 * Flags:
 *   --allow-remote   permit a non-localhost TEST_BASE_URL (otherwise refused, prod guard)
 *   --keep           skip teardown (leave the __isotest__ tenants for manual inspection)
 *
 * Exit code = number of SECURITY failures (0 = clean), so CI can gate on it.
 */
import pg from "pg";
import bcrypt from "bcrypt";

const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:5001").replace(/\/$/, "");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const KEEP = process.argv.includes("--keep");

// ── Guards ──────────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — point it at a NON-PROD Neon branch.");
  process.exit(2);
}
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
if (!isLocal && !ALLOW_REMOTE) {
  console.error(`Refusing non-local TEST_BASE_URL (${BASE_URL}) without --allow-remote.`);
  console.error("This test SEEDS AND DELETES rows — never run it against production.");
  process.exit(2);
}
if (/app\.treemarkables\.co\.nz/.test(BASE_URL)) {
  console.error("TEST_BASE_URL points at the production customer domain. Aborting.");
  process.exit(2);
}

const TAG = "__isotest__";
const rnd = Math.floor(Number(process.hrtime.bigint() % 100000n)); // unique-ish, no Date/random

type Tenant = {
  label: "A" | "B";
  businessId: string;
  email: string;
  password: string;
  employeeId: string;
  customerId: string;
  leadId: string;
  jobId: string;
  cookie?: string;
  ids(): string[]; // every seeded id for this tenant (for leak scanning)
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seedTenant(c: pg.PoolClient, label: "A" | "B"): Promise<Tenant> {
  const name = `${TAG} Tenant ${label} ${rnd}`;
  const slug = `isotest-${label.toLowerCase()}-${rnd}`;
  const email = `isotest+${label.toLowerCase()}-${rnd}@example.test`;
  const password = "IsoTestPass1234";
  const hash = await bcrypt.hash(password, 10);

  const { rows: [biz] } = await c.query(
    `INSERT INTO businesses (name, slug, status) VALUES ($1,$2,'active') RETURNING id`,
    [name, slug],
  );
  await c.query(`INSERT INTO business_settings (business_id, business_name) VALUES ($1,$2)`, [biz.id, name]);
  const { rows: [emp] } = await c.query(
    `INSERT INTO employees (business_id, first_name, last_name, position, email, password, role, status, is_active)
     VALUES ($1,$2,'Admin','Owner',$3,$4,'admin','active',true) RETURNING id`,
    [biz.id, `Iso${label}`, email, hash],
  );
  const { rows: [cust] } = await c.query(
    `INSERT INTO customers (business_id, name, email, is_active) VALUES ($1,$2,$3,true) RETURNING id`,
    [biz.id, `${TAG} Customer ${label} ${rnd}`, `cust-${label}-${rnd}@example.test`],
  );
  const { rows: [lead] } = await c.query(
    `INSERT INTO leads (business_id, name, status) VALUES ($1,$2,'new') RETURNING id`,
    [biz.id, `${TAG} Lead ${label} ${rnd}`],
  );
  const { rows: [job] } = await c.query(
    `INSERT INTO jobs (business_id, customer_id, job_number, status, title)
     VALUES ($1,$2,$3,'work_order',$4) RETURNING id`,
    [biz.id, cust.id, `${TAG}-${label}-${rnd}`, `${TAG} Job ${label} ${rnd}`],
  );

  return {
    label, businessId: biz.id, email, password,
    employeeId: emp.id, customerId: cust.id, leadId: lead.id, jobId: job.id,
    ids() { return [this.businessId, this.employeeId, this.customerId, this.leadId, this.jobId]; },
  };
}

async function login(t: Tenant): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: t.email, password: t.password }),
  });
  if (!res.ok) throw new Error(`login ${t.label} failed: HTTP ${res.status} ${await res.text()}`);

  // The login response carries TWO `treemarkables.sid` Set-Cookie headers: the real
  // session cookie AND a clearCookie for the legacy domain (empty value). Pick the
  // non-empty one — grabbing the blank clear-cookie sends an unauthenticated session.
  const setCookie = (res.headers as any).getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
  const sid = (setCookie as string[])
    .map((s) => s.split(";")[0])
    .filter((s) => s.startsWith("treemarkables.sid="))
    .find((s) => s.length > "treemarkables.sid=".length); // non-empty value only
  if (!sid) throw new Error(`login ${t.label}: no non-empty session cookie returned`);
  t.cookie = sid;

  // Verify the cookie actually authenticates before we trust the matrix. If this
  // fails, every "isolated" result below is just fail-closed noise, not real proof.
  const me = await getAs(t, "/api/auth/me");
  if (me.status !== 200 || !me.body.includes(t.employeeId)) {
    throw new Error(
      `login ${t.label}: session did not authenticate (/api/auth/me → HTTP ${me.status}). ` +
      `Body: ${me.body.slice(0, 300)}`,
    );
  }
}

async function getAs(t: Tenant | null, path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: t?.cookie ? { Cookie: t.cookie } : {},
  });
  return { status: res.status, body: await res.text() };
}

function containsAny(body: string, ids: string[]): string[] {
  return ids.filter((id) => body.includes(id));
}

/**
 * DB-level RLS probe — bypasses the server entirely. Becomes the non-bypass `app_tenant`
 * role, sets the tenant GUC by hand, and counts a tenant's OWN seeded rows per table.
 * This separates two failure modes the HTTP matrix can't tell apart:
 *   - own rows VISIBLE here but NOT over HTTP  → session.businessId isn't reaching the GUC
 *     (app plumbing bug)
 *   - own rows NOT visible here either          → the table's RLS policy is too strict
 *     (policy/migration bug — would also break the real tenant)
 *   - a huge count (all rows)                   → app_tenant bypasses RLS (enforcement off)
 * Run with an empty GUC too, to confirm fail-closed = 0.
 */
async function dbProbe(gucBusinessId: string, tables: string[]): Promise<Record<string, number | string>> {
  const p = await pool.connect();
  const out: Record<string, number | string> = {};
  try {
    await p.query("SET ROLE app_tenant");
    await p.query("SELECT set_config('app.current_business', $1, false)", [gucBusinessId]);
    for (const t of tables) {
      try {
        out[t] = (await p.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
      } catch (e) {
        out[t] = `ERR:${(e as Error).message.split("\n")[0]}`;
      }
    }
    await p.query("RESET ROLE").catch(() => {});
    await p.query("SELECT set_config('app.current_business', '', false)").catch(() => {});
  } catch (e) {
    out.__role = `ERR:${(e as Error).message.split("\n")[0]}`;
  } finally {
    p.release();
  }
  return out;
}

type Row = { name: string; verdict: "PASS" | "SECURITY FAIL" | "WARN" | "N/A"; detail: string };
const results: Row[] = [];
function record(name: string, verdict: Row["verdict"], detail = "") {
  results.push({ name, verdict, detail });
}

// Authenticated list endpoints: viewer must never see the OTHER tenant's ids.
// `ownCheck` = also assert the viewer DOES see its own seeded row. Only enabled for
// endpoints we seed AND that echo the row id in their list response — customers + jobs.
// The rest are isolation-only: either not seeded (invoices/equipment/calls) or shaped so
// a bare seed won't appear (today-overview = today's jobs only; leads = minimal/filtered).
const LIST_ENDPOINTS: { path: string; ownCheck: boolean }[] = [
  { path: "/api/customers", ownCheck: true },
  { path: "/api/jobs", ownCheck: true },
  { path: "/api/leads", ownCheck: false },
  { path: "/api/invoices", ownCheck: false },
  { path: "/api/equipment", ownCheck: false },
  { path: "/api/calls", ownCheck: false },
  { path: "/api/today-overview", ownCheck: false },
];

async function testListEndpoint(ep: { path: string; ownCheck: boolean }, viewer: Tenant, other: Tenant) {
  const { path, ownCheck } = ep;
  const { status, body } = await getAs(viewer, path);
  const name = `${path}  (as ${viewer.label})`;
  if (status >= 500) { record(name, "WARN", `HTTP ${status} (endpoint error)`); return; }
  if (status === 404) { record(name, "N/A", `HTTP 404 (route absent)`); return; }
  const leaked = containsAny(body, other.ids());
  if (leaked.length) {
    record(name, "SECURITY FAIL", `leaked ${other.label}'s ids: ${leaked.join(", ")}`);
    return;
  }
  if (!ownCheck) { record(name, "PASS", "isolated (no own-data assertion for this endpoint)"); return; }
  const ownVisible = containsAny(body, viewer.ids()).length > 0;
  record(name, "PASS", ownVisible ? "isolated; own data visible" : "isolated; own data NOT visible");
  if (!ownVisible) record(`${path}  (as ${viewer.label}) — own-visibility`, "WARN", "viewer could not see its own seeded rows");
}

(async () => {
  const c = await pool.connect();
  let A: Tenant | undefined, B: Tenant | undefined;
  try {
    // Preflight: server reachable?
    try {
      await fetch(`${BASE_URL}/api/health`).catch(() => fetch(`${BASE_URL}/`));
    } catch {
      console.error(`Cannot reach ${BASE_URL}. Start the dev server (with TENANT_RLS_ENABLED=true) first.`);
      process.exit(2);
    }

    console.log(`Seeding two throwaway tenants (${TAG} … ${rnd}) …`);
    await c.query("BEGIN");
    A = await seedTenant(c, "A");
    B = await seedTenant(c, "B");
    await c.query("COMMIT");
    console.log(`  A business=${A.businessId}  B business=${B.businessId}`);

    await login(A);
    await login(B);
    console.log("Logged in as both admins. Running matrix …\n");

    // 1) Authenticated list endpoints, both directions.
    for (const p of LIST_ENDPOINTS) {
      await testListEndpoint(p, A, B);
      await testListEndpoint(p, B, A);
    }

    // 2) Direct cross-tenant resource fetch: A asks for B's customer/job by id.
    for (const [path, otherId] of [
      [`/api/customers/${B.customerId}`, B.customerId],
      [`/api/jobs/${B.jobId}`, B.jobId],
    ] as const) {
      const { status, body } = await getAs(A, path);
      const name = `${path}  (A fetching B's resource)`;
      if (body.includes(otherId) && status < 400) record(name, "SECURITY FAIL", `returned B's row (HTTP ${status})`);
      else record(name, "PASS", `not returned (HTTP ${status})`);
    }

    // 3) Session-less customer portal: B's customer's jobs, unauthenticated.
    {
      const { status, body } = await getAs(null, `/api/customer/${B.customerId}/jobs`);
      const name = `/api/customer/:id/jobs  (unauth, B's customer)`;
      if (body.includes(B.jobId)) record(name, "SECURITY FAIL", `portal returned B's job with no auth (HTTP ${status})`);
      else record(name, "PASS", `no tenant data without a scoped session (HTTP ${status})`);
    }

    // ── Report ────────────────────────────────────────────────────────────────
    const pad = Math.max(...results.map((r) => r.name.length));
    console.log("RESULT MATRIX");
    console.log("─".repeat(pad + 22));
    for (const r of results) {
      const mark = r.verdict === "PASS" ? "✅" : r.verdict === "SECURITY FAIL" ? "❌" : r.verdict === "WARN" ? "⚠️ " : "··";
      console.log(`${mark} ${r.name.padEnd(pad)}  ${r.verdict.padEnd(14)} ${r.detail}`);
    }
    console.log("─".repeat(pad + 22));

    const fails = results.filter((r) => r.verdict === "SECURITY FAIL");
    const warns = results.filter((r) => r.verdict === "WARN");
    console.log(`\n${fails.length} security failure(s), ${warns.length} functional warning(s).`);
    if (fails.length === 0) {
      console.log("No cross-tenant leaks detected across the tested endpoints.");
    } else {
      console.log("CROSS-TENANT LEAK(S) DETECTED — do not onboard a second tenant until fixed.");
    }
    if (warns.some((w) => /own/.test(w.detail))) {
      console.log("Note: 'own data NOT visible' warnings usually mean that path fails closed under RLS");
      console.log("      (safe from leaks, but broken for real tenants — e.g. the customer portal).");
    }

    // ── DB-level RLS diagnostic ────────────────────────────────────────────────
    // Always run — it's the strongest positive proof that RLS enforces per-tenant
    // (GUC=A reveals exactly A's own rows, empty GUC reveals nothing), independent of
    // the HTTP path. If the HTTP matrix ever regresses, this tells you instantly
    // whether the fault is RLS policy vs session→GUC plumbing.
    {
      const TABLES = ["customers", "jobs", "leads", "employees"];
      const withGuc = await dbProbe(A.businessId, TABLES);
      const emptyGuc = await dbProbe("", TABLES);
      console.log("\nDB-LEVEL RLS PROBE (bypasses the server)");
      console.log(`  as app_tenant, GUC = A (${A.businessId}):`);
      console.log(`     ${JSON.stringify(withGuc)}`);
      console.log(`     ↑ expect each = 1 (A's own seeded row). If 1 → RLS is correct, so the`);
      console.log(`       HTTP "not visible" is a session.businessId→GUC plumbing bug in the app.`);
      console.log(`       If 0 → that table's RLS policy is too strict (would break real tenants).`);
      console.log(`  as app_tenant, GUC = "" (empty):`);
      console.log(`     ${JSON.stringify(emptyGuc)}   ← expect all 0 (fail-closed)`);
      // Sanity: confirm the seed actually stamped business_id = A (owner read).
      const owned = await pool.query(
        `SELECT business_id FROM customers WHERE id = $1`, [A.customerId],
      ).then((r) => r.rows[0]?.business_id).catch(() => "ERR");
      console.log(`  seed check (owner): customers.business_id for A's customer = ${owned}  (A = ${A.businessId})`);
    }

    process.exitCode = fails.length;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Test harness error:", (e as Error).message);
    process.exitCode = 2;
  } finally {
    // ── Teardown (best-effort, owner connection, FK-safe order) ───────────────
    if (!KEEP && (A || B)) {
      const bizIds = [A?.businessId, B?.businessId].filter(Boolean) as string[];
      for (const bid of bizIds) {
        for (const tbl of ["jobs", "leads", "customers", "employees", "business_settings", "businesses"]) {
          const col = tbl === "businesses" ? "id" : "business_id";
          await c.query(`DELETE FROM ${tbl} WHERE ${col} = $1`, [bid]).catch((err) =>
            console.error(`  teardown ${tbl} (${bid}) failed: ${err.message}`),
          );
        }
      }
      console.log("\nTore down the throwaway tenants.");
    } else if (KEEP) {
      console.log("\n--keep set: throwaway tenants left in place.");
    }
    c.release();
    await pool.end();
  }
})();
