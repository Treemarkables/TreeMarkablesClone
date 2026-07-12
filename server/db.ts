import pg from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { currentTenantDb } from "./tenancy/tenantStore";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Phase 2 RLS flag. Off (default) = exact current behaviour: every query runs on the
// owner neon-http client (BYPASSRLS). On = tenant requests run via a pinned direct
// connection as the non-bypass `app_tenant` role with the tenant GUC set, so Postgres
// RLS enforces isolation. Flipping it off is an instant rollback (no redeploy).
const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";

const sslFor = (url: string) =>
  url.includes("sslmode=") ? undefined : { rejectUnauthorized: false };

// ── DIRECT (non-pooled) connection string for tenant RLS ────────────────────
// CRITICAL: DATABASE_URL is Neon's PgBouncer *pooler* endpoint (transaction pooling).
// Through a transaction pooler, session-level `SET ROLE` and `set_config(..., false)`
// do NOT stick to a backend across queries — under concurrency they cross-contaminate
// between requests (proven: ~all concurrent connections read back the wrong tenant GUC).
// RLS therefore MUST run on a DIRECT backend connection, where session state is isolated
// per physical connection. We derive it by stripping `-pooler` from the host, or use an
// explicit DIRECT_DATABASE_URL override (preferred in production).
const DIRECT_URL =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL.replace("-pooler.", ".");

// Small pg.Pool kept solely for connect-pg-simple (session store). connect-pg-simple
// only runs plain SELECT/UPSERT (no session-level SET), so the pooler endpoint is fine.
export const pool = new pg.Pool({
  // The session store loads + (re)saves a row on the pooler endpoint for EVERY
  // request — including static/asset fetches, which carry the session cookie. At
  // ~90ms/round trip to Sydney, max:3 became a hard throughput ceiling under any
  // concurrency (requests queued waiting for a free connection). The pooler is
  // PgBouncer, so a handful more client connections is cheap. Bump to relieve it.
  max: Number(process.env.SESSION_POOL_MAX) || 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
  ssl: sslFor(process.env.DATABASE_URL),
});

pool.on("error", (err) => {
  console.error("Session pool error (non-fatal):", err.message);
});

// ── Owner client (neon-http, BYPASSRLS) ─────────────────────────────────────
// Stateless one-request-per-query HTTP. Used for login, signup, crons, platform-admin,
// and ALL queries when RLS is disabled. The pooler endpoint is fine here (no SET state).
export const ownerDb = drizzleHttp(neon(process.env.DATABASE_URL), { schema });

// ── Tenant pool (node-postgres, DIRECT endpoint) ────────────────────────────
// Only created when RLS is enabled. Hands out per-request connections that run as the
// non-bypass `app_tenant` role with the tenant GUC set, so RLS filters every query.
// Uses the DIRECT endpoint so session-level SET ROLE / GUC are reliably isolated.
export const tenantPool = RLS_ENABLED
  ? new pg.Pool({
      connectionString: DIRECT_URL,
      max: Number(process.env.TENANT_POOL_MAX) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: sslFor(DIRECT_URL),
    })
  : null;

if (tenantPool) {
  tenantPool.on("error", (err) => {
    console.error("Tenant pool error (non-fatal):", err.message);
  });
}

export interface TenantConnection {
  tenantDb: ReturnType<typeof drizzlePg>;
  release: () => Promise<void>;
}

/**
 * Pin a pooled connection to a tenant for the duration of a request:
 * `SET ROLE app_tenant` + set the `app.current_business` GUC. The returned `release`
 * MUST be called when the request ends (resets the connection before returning it to
 * the pool, so no tenant context leaks to the next request).
 *
 * Pass an empty string for `businessId` to fail closed (RLS matches zero rows) instead
 * of leaking via the owner connection — used for authenticated-route requests that
 * arrive without a resolved tenant.
 */
/**
 * The tenant GUC value is a business UUID (or "" to fail closed). To collapse the
 * `SET ROLE` + `set_config` pair into a SINGLE round trip we must send them as one
 * multi-statement simple query — and pg's parameterized (extended) protocol allows
 * only ONE statement, so the value can't be a bound `$1`; it has to be inlined. We
 * therefore validate it against a strict UUID/empty charset first, so the inlined
 * literal can never carry a SQL injection. Anything unexpected collapses to "",
 * which fails closed (RLS matches zero rows) rather than leaking.
 */
function tenantGucLiteral(businessId: string): string {
  return /^[0-9a-fA-F-]{0,64}$/.test(businessId) ? businessId : "";
}

export async function acquireTenantDb(businessId: string): Promise<TenantConnection> {
  if (!tenantPool) throw new Error("TENANT_RLS_ENABLED is off — tenant pool unavailable");
  const client = await tenantPool.connect();
  try {
    // One round trip instead of two. `SET ROLE` and `set_config(..., is_local=false)`
    // are both session-scoped and persist on this pinned connection after the
    // implicit transaction of the simple query commits — same end state as issuing
    // them separately, but without the extra ~90ms Sydney round trip on every
    // authenticated request. Value is charset-validated (see tenantGucLiteral).
    const guc = tenantGucLiteral(businessId);
    await client.query(
      `SET ROLE app_tenant; SELECT set_config('app.current_business', '${guc}', false)`,
    );
  } catch (e) {
    client.release();
    throw e;
  }
  const tenantDb = drizzlePg(client, { schema });
  const release = async () => {
    try {
      // Reset both in one round trip before returning the connection to the pool.
      await client.query(
        `RESET ROLE; SELECT set_config('app.current_business', '', false)`,
      );
    } catch {
      /* dead/errored connection — the pool discards it on release, so no leak */
    }
    client.release();
  };
  return { tenantDb, release };
}

// ── Context-aware client ────────────────────────────────────────────────────
// Inside a logged-in request (RLS on), resolves to the pinned tenant client; otherwise
// the owner client. No call-site changes across storage.ts / routes.ts.
function contextDb(): typeof ownerDb {
  if (!RLS_ENABLED) return ownerDb;
  const tdb = currentTenantDb() as typeof ownerDb | undefined;
  return tdb ?? ownerDb;
}

export const db: typeof ownerDb = new Proxy(ownerDb, {
  get(_target, prop) {
    const active = contextDb() as Record<string | symbol, unknown>;
    const value = active[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});

/**
 * Boot-time safety check. When RLS is enabled the tenant pool (DIRECT_DATABASE_URL)
 * MUST point at the SAME database as the owner connection (DATABASE_URL). If a
 * misconfigured DIRECT_DATABASE_URL points at a different Neon branch, owner-path
 * operations (login, signup) keep working while tenant-scoped reads silently return a
 * DIFFERENT database's rows — which once presented as "all my data vanished" in prod.
 * We compare a cheap signature (businesses + jobs counts, read as owner on both pools)
 * and refuse to boot on mismatch, so a wrong env var fails loudly at deploy time.
 */
export async function assertTenantDbMatchesOwner(): Promise<void> {
  if (!RLS_ENABLED || !tenantPool) return;

  // The tenant pool MUST use a DIRECT (non-pooler) endpoint. Through Neon's
  // transaction pooler, session-level SET ROLE / set_config GUCs do not stick to a
  // backend across queries and cross-contaminate between concurrent requests — i.e.
  // requests read back the WRONG tenant's GUC under load (cross-tenant reads). The
  // counts check below passes for a same-database pooler URL, so it can't catch this;
  // guard the endpoint shape explicitly. Only a misconfigured DIRECT_DATABASE_URL can
  // trip this (the auto-derivation strips '-pooler.'), so fail loudly at deploy time.
  if (/-pooler\./.test(DIRECT_URL) || /pgbouncer=true/i.test(DIRECT_URL)) {
    const safe = DIRECT_URL.replace(/:[^:@/]*@/, ":***@");
    throw new Error(
      `FATAL: tenant RLS pool is using a POOLER endpoint (${safe}). Session GUCs leak ` +
        `across tenants through the pooler under load. Set DIRECT_DATABASE_URL to the direct ` +
        `(non-pooler) endpoint, or unset it to auto-derive by stripping '-pooler.' from DATABASE_URL.`,
    );
  }

  const sigOf = async (p: pg.Pool): Promise<string> => {
    const c = await p.connect();
    try {
      const b = (await c.query("SELECT count(*)::int AS n FROM businesses")).rows[0].n;
      const j = (await c.query("SELECT count(*)::int AS n FROM jobs")).rows[0].n;
      return `${b}:${j}`;
    } finally {
      c.release();
    }
  };
  const ownerSig = await sigOf(pool); // DATABASE_URL
  const tenantSig = await sigOf(tenantPool); // DIRECT_DATABASE_URL
  if (ownerSig !== tenantSig) {
    throw new Error(
      `FATAL: DIRECT_DATABASE_URL points at a different database than DATABASE_URL ` +
        `(owner businesses:jobs=${ownerSig}, tenant=${tenantSig}). ` +
        `Delete DIRECT_DATABASE_URL to auto-derive from DATABASE_URL, or set it to the correct direct endpoint.`,
    );
  }
  console.log(`[tenant-db] ✅ tenant pool matches owner DB (businesses:jobs=${ownerSig})`);
}

// ── Tenant-isolation policy backstop ────────────────────────────────────────
// Every table carrying a `business_id` column is tenant data. Because the Phase-2
// FALLBACK grants give app_tenant a blanket GRANT ON ALL TABLES, such a table is
// cross-tenant readable/writable UNLESS it has RLS enabled AND a policy. A table
// can ship without one (equipment_compliance_reminders did) and nothing else
// catches it. These find the gap. Genuinely-global tables that happen to carry a
// business_id column can be exempted via TENANT_RLS_POLICY_EXEMPT (comma-separated).

export interface RlsGap { table: string; rlsOn: boolean; hasPolicy: boolean }

export async function findTenantTablesMissingRlsPolicy(): Promise<RlsGap[]> {
  const exempt = new Set(
    (process.env.TENANT_RLS_POLICY_EXEMPT || "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const res = await pool.query(`
    SELECT c.relname AS tbl,
           c.relrowsecurity AS rls_on,
           EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind = 'r'
       AND EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public' AND col.table_name = c.relname
                      AND col.column_name = 'business_id')
     ORDER BY 1`);
  const rows = res.rows as Array<{ tbl: string; rls_on: boolean; has_policy: boolean }>;
  return rows
    .filter((r) => !exempt.has(r.tbl))
    .filter((r) => !r.rls_on || !r.has_policy)
    .map((r) => ({ table: r.tbl, rlsOn: r.rls_on, hasPolicy: r.has_policy }));
}

/**
 * Boot guard. No-op unless RLS is on (the gap only bites under RLS). Logs any gap
 * loudly; throws (fail-closed) ONLY when TENANT_RLS_STRICT=true, so an autodeploy
 * from main can't be taken down by a single forgotten policy unless you opt in.
 * Use the CLI (scripts/checkTenantRlsPolicies.ts) as a hard pre-deploy/CI gate.
 */
export async function assertTenantTablesHaveRlsPolicies(): Promise<void> {
  if (!RLS_ENABLED) return;
  let gaps: RlsGap[];
  try {
    gaps = await findTenantTablesMissingRlsPolicy();
  } catch (e) {
    console.error("[tenant-rls] policy backstop check could not run:", (e as Error).message);
    return;
  }
  if (gaps.length === 0) {
    console.log("[tenant-rls] ✅ every business_id table has RLS + a policy");
    return;
  }
  const list = gaps.map((g) => `${g.table} (rls_on=${g.rlsOn}, has_policy=${g.hasPolicy})`).join(", ");
  const msg =
    `${gaps.length} business_id table(s) are missing RLS isolation and are cross-tenant ` +
    `readable/writable under the app_tenant grant: ${list}. Add ENABLE ROW LEVEL SECURITY ` +
    `+ a tenant_isolation policy, or exempt a genuinely-global table via TENANT_RLS_POLICY_EXEMPT.`;
  console.error(`\n🔴 [tenant-rls] CRITICAL: ${msg}\n`);
  if (process.env.TENANT_RLS_STRICT === "true") {
    throw new Error(`FATAL (TENANT_RLS_STRICT): ${msg}`);
  }
}
