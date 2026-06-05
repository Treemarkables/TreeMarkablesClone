/**
 * Inflow tenancy — public JWKS endpoint for Neon Authorize.
 *
 * Neon's proxy fetches this URL to get the public key that validates the per-request
 * tenant JWTs. Wire it up (after deploying to a publicly reachable host) with ONE line
 * in the route setup, e.g. in server/routes.ts:
 *
 *     app.get("/.well-known/jwks.json", jwksHandler);
 *
 * It serves only the public key — safe to expose. Until the line above is added it is
 * dormant. See INFLOW_RLS_RUNBOOK.md.
 */
import type { Request, Response } from "express";
import { getJwks } from "./tenantKeys";

export async function jwksHandler(_req: Request, res: Response) {
  const jwks = await getJwks();
  res.set("Cache-Control", "public, max-age=300");
  res.json(jwks);
}
