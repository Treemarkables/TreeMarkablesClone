/**
 * Inflow tenancy — per-request Drizzle client that carries a tenant JWT.
 *
 * Same neon-http driver as server/db.ts (so the reliability characteristics are
 * unchanged), but every query is sent with an Authorization: Bearer <jwt>. Neon's
 * proxy validates the token against the JWKS, runs the query as the `authenticated`
 * role (which does NOT have BYPASSRLS — the whole point), and exposes the claims so
 * the RLS policy can read `business_id`.
 *
 * NOTE: not wired into the request path yet. See INFLOW_RLS_RUNBOOK.md.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

export function dbForRequest(jwt: string) {
  const sql = neon(process.env.DATABASE_URL!, { authToken: () => jwt });
  return drizzle(sql, { schema });
}
