import pg from "pg";
import { neon, Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import { currentTenantDb } from "./tenancy/tenantStore";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

neonConfig.webSocketConstructor = ws;

// Phase 2 RLS flag. Off (default) = exact current behaviour: every query runs on the
// owner neon-http client (BYPASSRLS). On = tenant requests run via a pooled connection
// as the non-bypass `app_tenant` role with the tenant GUC set, so Postgres RLS enforces
// isolation. Flipping it off is an instant rollback (no redeploy).
const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";

// Small pg.Pool kept solely for connect-pg-simple (session store).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=')
    ? undefined
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Session pool error (non-fatal):', err.message);
});

// ── Owner client (neon-http, BYPASSRLS) ─────────────────────────────────────
// Stateless one-request-per-query HTTP. Used for login, crons, platform-admin, and
// ALL queries when RLS is disabled.
const ownerDb = drizzleHttp(neon(process.env.DATABASE_URL), { schema });

// ── Tenant pool (neon-serverless WebSocket) ─────────────────────────────────
// Only created when RLS is enabled. Hands out per-request connections that run as the
// non-bypass `app_tenant` role with the tenant GUC set, so RLS filters every query.
export const tenantPool = RLS_ENABLED
  ? new NeonPool({ connectionString: process.env.DATABASE_URL })
  : null;

export interface TenantConnection {
  tenantDb: ReturnType<typeof drizzleWs>;
  release: () => Promise<void>;
}

/**
 * Pin a pooled connection to a tenant for the duration of a request:
 * `SET ROLE app_tenant` + set the `app.current_business` GUC. The returned `release`
 * MUST be called when the request ends (resets the connection before returning it to
 * the pool, so no tenant context leaks to the next request).
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
  const tenantDb = drizzleWs(client, { schema });
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
