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
  connectionString: process.env.DATABASE_URL,
  max: 3,
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
const ownerDb = drizzleHttp(neon(process.env.DATABASE_URL), { schema });

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
export async function acquireTenantDb(businessId: string): Promise<TenantConnection> {
  if (!tenantPool) throw new Error("TENANT_RLS_ENABLED is off — tenant pool unavailable");
  const client = await tenantPool.connect();
  try {
    await client.query("SET ROLE app_tenant");
    await client.query("SELECT set_config('app.current_business', $1, false)", [businessId]);
  } catch (e) {
    client.release();
    throw e;
  }
  const tenantDb = drizzlePg(client, { schema });
  const release = async () => {
    try {
      await client.query("RESET ROLE");
      await client.query("SELECT set_config('app.current_business', '', false)");
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
