import pg from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import { currentBusinessId } from "./tenancy/tenantStore";
import { signTenantJwt } from "./tenancy/tenantKeys";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Small pg.Pool kept solely for connect-pg-simple (session store).
// All Drizzle ORM queries use the Neon HTTP driver below, which makes
// stateless per-query HTTP requests — no persistent connections, no
// "Connection terminated due to connection timeout" errors on Neon.
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

// ── Tenancy-aware Drizzle client (Phase 2 RLS) ──────────────────────────────
// Default: the neondb_owner HTTP client (BYPASSRLS) — exact current behaviour.
// When TENANT_RLS_ENABLED=true, queries made *inside a logged-in request* run via an
// `authenticated` client carrying the tenant's JWT, so Postgres RLS enforces isolation.
// Login, crons and platform-admin run OUTSIDE a request context → owner → cross-tenant
// access (intended). Flag off = current behaviour; flipping it off is an instant rollback.
const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";
if (RLS_ENABLED && !process.env.TENANT_JWT_PRIVATE_KEY_B64) {
  throw new Error(
    "TENANT_RLS_ENABLED=true requires TENANT_JWT_PRIVATE_KEY_B64 / TENANT_JWT_KID to be set",
  );
}

// Neon HTTP driver — one HTTP request per query, zero persistent connections.
const ownerDb = drizzle(neon(process.env.DATABASE_URL), { schema });

// One authed client per tenant, reused across requests (neon-http is stateless; the
// authToken callback re-mints a fresh short-lived JWT per query).
const authedDbByBusiness = new Map<string, typeof ownerDb>();
function authedDbFor(businessId: string): typeof ownerDb {
  let d = authedDbByBusiness.get(businessId);
  if (!d) {
    const authedSql = neon(process.env.DATABASE_URL!, {
      authToken: () => signTenantJwt({ business_id: businessId }),
    });
    d = drizzle(authedSql, { schema });
    authedDbByBusiness.set(businessId, d);
  }
  return d;
}

function contextDb(): typeof ownerDb {
  if (!RLS_ENABLED) return ownerDb;
  const businessId = currentBusinessId();
  return businessId ? authedDbFor(businessId) : ownerDb;
}

// Transparent proxy: every `db.*` access resolves to the right client for the current
// async context — no call-site changes across storage.ts / routes.ts.
export const db: typeof ownerDb = new Proxy(ownerDb, {
  get(_target, prop) {
    const active = contextDb() as Record<string | symbol, unknown>;
    const value = active[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});
