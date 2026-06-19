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
  const setCookie = (res.headers as any).getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
  const sid = (setCookie as string[]).map((s) => s.split(";")[0]).find((s) => s.startsWith("treemarkables.sid="));
  if (!sid) throw new Error(`login ${t.label}: no session cookie returned`);
  t.cookie = sid;
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

type Row = { name: string; verdict: "PASS" | "SECURITY FAIL" | "WARN" | "N/A"; detail: string };
const results: Row[] = [];
function record(name: string, verdict: Row["verdict"], detail = "") {
  results.push({ name, verdict, detail });
}

// Authenticated list endpoints: viewer must see OWN ids, never the OTHER tenant's ids.
const LIST_ENDPOINTS = [
  "/api/customers",
  "/api/jobs",
  "/api/leads",
  "/api/invoices",
  "/api/equipment",
  "/api/calls",
  "/api/today-overview",
];

async function testListEndpoint(path: string, viewer: Tenant, other: Tenant) {
  const { status, body } = await getAs(viewer, path);
  const name = `${path}  (as ${viewer.label})`;
  if (status >= 500) { record(name, "WARN", `HTTP ${status} (endpoint error)`); return; }
  if (status === 404) { record(name, "N/A", `HTTP 404 (route absent)`); return; }
  const leaked = containsAny(body, other.ids());
  if (leaked.length) {
    record(name, "SECURITY FAIL", `leaked ${other.label}'s ids: ${leaked.join(", ")}`);
    return;
  }
  const ownVisible = containsAny(body, viewer.ids()).length > 0;
  record(name, "PASS", ownVisible ? "isolated; own data visible" : "isolated; but own data NOT visible (fail-closed?)");
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
