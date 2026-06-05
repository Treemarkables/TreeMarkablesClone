# Inflow — Route A (Neon Authorize) runbook

Chosen 2026-06-03. Gets the JWT-driven RLS backstop standing end-to-end. Evidence that the
underlying RLS behaviour works is in `INFLOW_TENANCY_AUDIT.md` (PoC); this is the productionised
JWT path.

## Status (2026-06-03): live JWT proof DEFERRED

The core isolation behaviour is already proven (PoC #2 in `INFLOW_TENANCY_AUDIT.md`: RLS isolates
correctly under a non-bypass role, fails closed without context). The **live Neon-Authorize JWT
confirmation is deferred** — it's a low-risk "does the vendor feature behave as documented" check
that will be exercised in-context when the Phase 1 middleware is wired. Resume here when building
that middleware.

Reference left ready for resume: dev keypair in `.env`, public JWKS published at the gist
`https://gist.githubusercontent.com/Treemarkables/6abd268ceafa6b9ebbcca112b92c2933/raw/c7614e88b64fd487ca00f631776a6c9b82c54098/tenant-jwks.json`
(public key only — safe; delete the gist + the `tenant-jwks.json` artifact anytime). The console
step lives at **Project → Settings → RLS** (custom JWKS provider) — *not* the "Neon Auth" /
"Enable Neon Auth" screen, which is the unrelated managed-auth product.

## What's already built (this branch)

- **Dev keypair** generated → `TENANT_JWT_PRIVATE_KEY_B64` + `TENANT_JWT_KID` in the local
  (gitignored) `.env`. `kid = W6bPywQSnoG_liWNmcSVdrC0EMLmq4pWZ5tn4u9rY50`. **Dev branch only** —
  production gets its own keypair set as DO env vars (never commit a private key).
- **`server/tenancy/`** module (dormant — imported nowhere yet):
  - `tenantKeys.ts` — `signTenantJwt({business_id})` + `getJwks()`
  - `dbForRequest.ts` — `dbForRequest(jwt)` (neon-http client carrying the Bearer token)
  - `tenantContext.ts` — Express middleware (mounts later, after Phase 1 adds `session.businessId`)
  - `jwksHandler.ts` — the `/.well-known/jwks.json` handler

## Steps to the end-to-end proof

### 1. Make the JWKS reachable by Neon's proxy (public URL)
Neon validates tokens by fetching the JWKS over the internet, so `localhost` won't do. Two ways:

- **Wire the endpoint + tunnel** — add one line where routes are registered (e.g. `server/routes.ts`):
  ```ts
  import { jwksHandler } from "./tenancy/jwksHandler";
  app.get("/.well-known/jwks.json", jwksHandler);
  ```
  restart dev, then `cloudflared tunnel --url http://localhost:5001` (or `ngrok http 5001`).
  JWKS URL = `https://<tunnel-host>/.well-known/jwks.json`.
- **Static-file shortcut (no app edit / no restart)** — write the public JWKS to a file and serve
  it: `npx http-server . -p 8787` then tunnel `:8787`. (Ask me and I'll drop the JWKS file in.)

### 2. Configure Neon Authorize (the part only you can click)
Neon Console → your project → **Authorize** (or Settings → RLS/Authorize):
1. **Add authentication provider** → choose **Custom / JWKS**.
2. **JWKS URL** = the public URL from step 1.
3. Save. Neon enables `pg_session_jwt` and provisions the `authenticated` + `anonymous` roles.

### 3. Grant the `authenticated` role least-privilege access
Neon Authorize runs tenant queries as `authenticated` (no `BYPASSRLS` — exactly what the PoC showed
we need). It needs table privileges. For the proof, just the test table; for Phase 1, all tenant tables:
```sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on <table> to authenticated;
```

### 4. RLS policy reads the JWT claim
With Neon Authorize the claim is exposed via `auth.session()`:
```sql
alter table <table> enable row level security;
create policy tenant_isolation on <table>
  using (business_id = (auth.session() ->> 'business_id'));
```

### 5. Run the proof (after steps 1–2 done)
Drop this into the main checkout (where `.env` + `node_modules` live), `npx tsx tenancy_proof.mts`,
then delete it. It asserts zero cross-tenant bleed through the **real JWT → proxy → RLS** path:

```ts
import { neon } from "@neondatabase/serverless";
import { SignJWT, importPKCS8 } from "jose";
const url = process.env.DATABASE_URL!;
const KID = process.env.TENANT_JWT_KID!;
const key = await importPKCS8(Buffer.from(process.env.TENANT_JWT_PRIVATE_KEY_B64!, "base64").toString("utf8"), "RS256");
const jwt = (biz: string) => new SignJWT({ business_id: biz })
  .setProtectedHeader({ alg: "RS256", kid: KID })
  .setSubject(biz).setIssuer("inflow").setAudience("authenticated")
  .setIssuedAt().setExpirationTime("2m").sign(key);

const admin = neon(url); // neondb_owner — setup only
await admin`drop table if exists poc_authz`;
await admin`create table poc_authz (id serial primary key, business_id text not null, label text not null)`;
await admin`insert into poc_authz (business_id,label) values ('biz-A','A1'),('biz-A','A2'),('biz-B','B1')`;
await admin`alter table poc_authz enable row level security`;
await admin`create policy iso on poc_authz using (business_id = (auth.session() ->> 'business_id'))`;
await admin`grant select on poc_authz to authenticated`;

const asA = neon(url, { authToken: () => jwt("biz-A") });
const asB = neon(url, { authToken: () => jwt("biz-B") });
console.log("A sees:", (await asA`select label from poc_authz`).map((r:any)=>r.label), "(expect A1,A2)");
console.log("B sees:", (await asB`select label from poc_authz`).map((r:any)=>r.label), "(expect B1)");

await admin`drop table poc_authz`;
```
**Pass = A sees only A1,A2 and B sees only B1.** That closes Phase 0: the JWT path enforces
isolation, and Phase 1 (the `businessId` migration + `storage.ts` retrofit) can begin on solid ground.

## After the proof passes — wiring into the app (later, gated on Phase 1)
1. Phase 1 puts `businessId` on the session at login.
2. Mount `tenantContext` middleware after the session middleware.
3. Tenant-scoped handlers switch `db` → `req.db`.
4. Roll out RLS + `grant ... to authenticated` across all ~116 tenant tables.
5. Production: generate a separate keypair, set `TENANT_JWT_PRIVATE_KEY_B64` / `TENANT_JWT_KID`
   as DO env vars, and point the Neon provider at `https://app.treemarkables.co.nz/.well-known/jwks.json`.
