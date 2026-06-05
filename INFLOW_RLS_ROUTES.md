# Inflow — RLS backstop: two routes, side by side

Decision artifact for the tenant-isolation backstop. Companion to `INFLOW_TENANCY_AUDIT.md`
(which holds the PoC evidence). Both routes share the **same non-negotiable first step** the PoC
forced into the open.

---

## Shared prerequisite (true for BOTH routes)

The PoC proved the app role `neondb_owner` has `rolbypassrls = true`, so **RLS is a silent no-op
today.** Both routes therefore start identically:

1. **Create a non-`BYPASSRLS` application role** and grant it least-privilege DML on all tenant
   tables. Route A calls it `authenticated` (Neon's convention); Route B calls it `app_tenant`.
2. **Enable + force RLS** on every tenant table and add the policy
   `USING (business_id = nullif(current_setting('app.current_business', true), ''))`.
   (`FORCE` so even a table-owner connection is subject to it — defence in depth.)
3. **App-level `businessId` filters** still get added during the retrofit. RLS is the backstop,
   not a substitute. (Both routes assume the `storage.ts` centralisation work happens regardless.)

The routes differ **only** in *how the per-request tenant context + non-bypass role reach the DB.*

---

## Route A — Neon Authorize (JWT), stays on `neon-http`

**How context reaches the DB:** every HTTP query carries a short-lived **JWT** as a Bearer token.
Neon's proxy validates it against a configured **JWKS URL**, runs the query as the `authenticated`
role, and exposes claims via `auth.user_id()` / `auth.session()`. We put `businessId` in a claim
and the RLS policy reads it.

### Code changes
```ts
// server/db.ts — add a per-request authed client (keep the existing `db` for system queries)
import { neon } from "@neondatabase/serverless";
export function dbForRequest(jwt: string) {
  const sql = neon(process.env.DATABASE_URL!, { authToken: async () => jwt });
  return drizzle(sql, { schema });
}
```
```ts
// server/middleware/tenant.ts — mint a short-lived JWT from the existing session
import { SignJWT } from "jose";
export async function tenantContext(req, res, next) {
  const { businessId, employeeId } = req.session;        // session-derived (plan: locked)
  req.tenantJwt = await new SignJWT({ business_id: businessId, sub: employeeId })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuedAt().setExpirationTime("2m")
    .sign(PRIVATE_KEY);
  req.db = dbForRequest(req.tenantJwt);                  // handlers use req.db, not the global db
  next();
}
```
RLS policy reads the claim instead of a GUC:
`USING (business_id = (auth.session() ->> 'business_id'))`.

### Infra / Neon console (the part only you can click)
1. Host a tiny **JWKS endpoint** (e.g. `GET /.well-known/jwks.json` on the existing server)
   exposing the RS256 public key. ~30 lines.
2. Neon Console → project → **Authorize** → add auth provider → paste the JWKS URL.
3. Enable the `pg_session_jwt` extension (Neon does this when you add the provider).

| | |
|---|---|
| **Driver** | unchanged (`neon-http`) — **keeps the connection-timeout reliability win** |
| **App code restructure** | low — handlers switch `db` → `req.db`; no transaction batching |
| **External infra** | JWKS endpoint + Neon console config (one-time) |
| **Reliability impact** | none (stateless HTTP preserved) |
| **Lock-in** | ties the backstop to a Neon-specific feature |
| **Maturity** | newer Neon feature; JWT plumbing is the novel part |

---

## Route B — custom `app_tenant` role, switch to `neon-serverless` Pool

**How context reaches the DB:** each request opens a pooled connection, runs
`BEGIN; SET LOCAL ROLE app_tenant; SET LOCAL app.current_business = $1; … ; COMMIT`. The
`SET LOCAL` values die with the transaction, so nothing leaks to the next request on that
connection. (This is the classic pattern the plan originally wanted — the PoC confirmed it isolates
correctly; it just needs the Pool driver because `neon-http` has no transactions.)

### Code changes
```ts
// server/db.ts — swap driver
import { Pool } from "@neondatabase/serverless";          // websocket pool
import { drizzle } from "drizzle-orm/neon-serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```
```ts
// per request: wrap in a tenant transaction
export function withTenant(businessId: string, fn) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_tenant`);
    await tx.execute(sql`select set_config('app.current_business', ${businessId}, true)`);
    return fn(tx);                                         // all handler queries use tx
  });
}
```
RLS policy stays GUC-based (the version already proven in the PoC):
`USING (business_id = nullif(current_setting('app.current_business', true), ''))`.

### Infra / Neon console
1. `CREATE ROLE app_tenant NOLOGIN; GRANT app_tenant TO neondb_owner;` + grant DML on tenant
   tables. (SQL only — **no console clicks, no JWKS, no external endpoint.**)

| | |
|---|---|
| **Driver** | **switched to `neon-serverless` Pool** — reintroduces the *"Connection terminated due to connection timeout"* class of issue the team deliberately left |
| **App code restructure** | **higher** — every request's queries must run inside one `withTenant` transaction (`tx`), not scattered `await db.…` calls. Touches the ~160 direct sites + `storage.ts` signatures |
| **External infra** | none |
| **Reliability impact** | real regression risk (persistent connections on Neon) |
| **Lock-in** | none (standard Postgres RLS) |
| **Maturity** | battle-tested pattern |

---

## Recommendation

**Route A (Neon Authorize).** Two reasons dominate:
1. **It preserves the reliability decision already baked into the app.** `neon-http` exists
   *because* persistent connections were causing timeouts. Route B knowingly reverses that across
   the whole live app, not just the SaaS path.
2. **Lower code-restructure risk.** Route A is "swap `db` for `req.db`." Route B forces every
   request's queries into a single shared transaction object — a much larger, error-prone change to
   a 30k-line `routes.ts`, and a half-migrated handler that mixes `db` and `tx` silently loses
   isolation.

The price of Route A is the JWT/JWKS plumbing + one-time Neon console setup — contained, and the
PoC already validated the underlying RLS behaviour it depends on.

**Pick Route B only if** you want zero external/console dependencies and are willing to (a) re-take
on Neon connection management and (b) fund the larger transaction-wrapping refactor.

---

## If Route A is chosen — remaining Phase 0 spike

1. I build: the JWKS endpoint (`/.well-known/jwks.json`), the RS256 keypair handling (private key
   in env, **not** committed), the `dbForRequest` client, and the `tenantContext` middleware.
2. You do: Neon Console → Authorize → add provider with the JWKS URL (I'll give exact steps + the
   URL once the endpoint is deployed to a reachable host).
3. Joint proof: one real table (`customers`) behind RLS, two test businesses, assert zero bleed —
   the same assertion the PoC made, now end-to-end through the JWT path.

Only after that proof passes does the big `businessId` migration (Phase 1) begin.
