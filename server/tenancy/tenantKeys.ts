/**
 * Inflow tenancy — RS256 key handling for Neon Authorize (Route A).
 *
 * Mints short-lived per-request JWTs whose `business_id` claim drives the RLS
 * policy, and exposes the public JWKS that Neon's proxy fetches to validate them.
 *
 * Key material:
 *   TENANT_JWT_PRIVATE_KEY_B64  base64-encoded PKCS#8 PEM private key (env, never committed)
 *   TENANT_JWT_KID              key id (jwk thumbprint), must match the JWKS `kid`
 *
 * NOTE: nothing here is wired into the request path yet. See INFLOW_RLS_RUNBOOK.md.
 */
import { importPKCS8, exportJWK, SignJWT, type CryptoKey } from "jose";

const KID = process.env.TENANT_JWT_KID;
const B64 = process.env.TENANT_JWT_PRIVATE_KEY_B64;

let cachedKey: Promise<CryptoKey> | null = null;
let cachedJwks: Promise<{ keys: unknown[] }> | null = null;

function privateKey(): Promise<CryptoKey> {
  if (!B64 || !KID) {
    throw new Error("TENANT_JWT_PRIVATE_KEY_B64 / TENANT_JWT_KID not set");
  }
  if (!cachedKey) {
    const pem = Buffer.from(B64, "base64").toString("utf8");
    cachedKey = importPKCS8(pem, "RS256", { extractable: true });
  }
  return cachedKey;
}

/** Short-lived JWT carrying the tenant claim. Audience `authenticated` matches Neon's role. */
export async function signTenantJwt(claims: { business_id: string; sub?: string }): Promise<string> {
  return new SignJWT({ business_id: claims.business_id })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setSubject(claims.sub ?? claims.business_id)
    .setIssuer("inflow")
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(await privateKey());
}

/** Public JWKS for the `/.well-known/jwks.json` endpoint Neon Authorize reads. */
export async function getJwks(): Promise<{ keys: unknown[] }> {
  if (!cachedJwks) {
    cachedJwks = (async () => {
      const jwk = await exportJWK(await privateKey());
      return { keys: [{ kty: jwk.kty, n: jwk.n, e: jwk.e, kid: KID, alg: "RS256", use: "sig" }] };
    })();
  }
  return cachedJwks;
}
