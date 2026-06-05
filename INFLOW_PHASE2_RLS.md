# Inflow — Phase 2: Row-Level Security (the read-isolation backstop)

Makes tenant isolation **enforced by the database**, so a forgotten `WHERE business_id=` is a
non-event, not a cross-tenant leak. This is the gate before a second real tenant touches the system.

Artifacts: this plan + `INFLOW_PHASE2_rls.sql` (the policies, reviewable, not yet run).

---

## The two halves

RLS has a **database half** (easy, safe) and an **app half** (the real work):

1. **DB half — policies.** Enable RLS + a `tenant_isolation` policy + grants on all 127 tenant tables.
   Policy reads the tenant from the per-request JWT: `business_id = (auth.session() ->> 'business_id')`.
2. **App half — route tenant queries through the `authenticated` role.** RLS is a **no-op under
   `neondb_owner`** (it has `BYPASSRLS` — proven in Phase 0). It only enforces when queries run as a
   non-bypass role. Neon Authorize provides `authenticated` and routes per-request JWTs to it.

**Why the DB half is safe to land first:** while the app still connects as `neondb_owner`, the
policies do nothing (owner bypasses RLS). So `INFLOW_PHASE2_rls.sql` can go to prod with **zero
behavioural change**, ahead of the app-side routing — same dev-first → prod pattern as Phase 1.

---

## The key decision: how do tenant queries run as `authenticated`?

The whole codebase uses one global `db` (the `neondb_owner` neon-http client). To enforce RLS, tenant
requests must use an **authed** client carrying their JWT. Two ways:

### Option A — context-aware `db` (RECOMMENDED, ~zero call-site changes)
Make `db` a thin proxy over AsyncLocalStorage (which we already populate per request). Inside a
logged-in request it transparently uses an authed client (JWT minted from `currentBusinessId()`);
outside a request — login, crons, platform-admin — it falls back to the `neondb_owner` client.
**No handler or storage method changes.** Sketch:

```ts
// server/db.ts
const ownerDb = drizzle(neon(URL), { schema });                 // current behaviour (bypass)
function contextDb() {
  const bid = currentBusinessId();
  if (!bid) return ownerDb;                                     // pre-auth / cron / platform → owner
  const sql = neon(URL, { authToken: () => signTenantJwt({ business_id: bid }) });
  return drizzle(sql, { schema });                              // runs as `authenticated`, RLS applies
}
export const db = new Proxy({} as typeof ownerDb, {
  get(_t, p) { const v = (contextDb() as any)[p]; return typeof v === "function" ? v.bind(contextDb()) : v; }
});
```
*Implementation note:* bind `this` to the underlying drizzle instance (above), and consider caching
the authed client per-businessId per-request. Needs testing, but it's the smallest, safest change.

### Option B — per-handler `req.db`
Each handler explicitly uses `req.db` (the authed client from `tenantContext.ts`). Explicit and
greppable, but touches hundreds of call sites and a half-migrated handler silently loses isolation.
Not recommended given Option A exists.

**Login & background safety (both options):** pre-login there is no `businessId` in the session, so
queries run as owner — login (employee-by-email lookup) works. Crons / platform-admin run outside any
request context → owner → full cross-tenant access, as intended. RLS only constrains authenticated
*tenant* requests.

---

## Staged plan (dev-first, each stage reversible)

**Stage 0 — Neon Authorize (console, one-time, needs you).**
Neon Console → Project → Settings → **RLS** → add a custom JWKS provider pointing at our public JWKS
(the gist for dev, or `app.treemarkables.co.nz/.well-known/jwks.json` for prod). This creates the
`authenticated` role and enables `pg_session_jwt`. *(This is the step deferred from Phase 0.)*

**Stage 1 — policies (DB half).** Run `INFLOW_PHASE2_rls.sql` on the **dev branch**, then prod.
No-op while the app uses owner. Reversible (rollback block in the SQL).

**Stage 2 — wire the JWKS endpoint.** Mount `app.get("/.well-known/jwks.json", jwksHandler)` (one
line) + set `TENANT_JWT_PRIVATE_KEY_B64` / `TENANT_JWT_KID` env vars (dev `.env` already has them;
prod gets its own keypair as DO env vars).

**Stage 3 — context-aware `db` (app half, Option A).** Implement the proxy in `server/db.ts`. On dev,
verify the app behaves identically (single-tenant → every query resolves to Treemarkables).

**Stage 4 — cross-tenant leakage tests (the gate).** Create two test businesses + two employees on
the dev branch. For every major endpoint, assert business A's session can NEVER see B's rows (and
vice-versa), and that writes can't cross tenants (the `WITH CHECK`). Automated, must be 100% green
before a second real tenant is allowed in.

**Stage 5 — prod rollout.** Apply Stage 1 SQL to prod, deploy Stages 2–3, re-run a prod smoke test
(Treemarkables sees exactly its own data — i.e., everything, since it's the only tenant).

---

## The policy (per table, in `INFLOW_PHASE2_rls.sql`)

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;     -- not FORCED: owner keeps full access
CREATE POLICY tenant_isolation ON <t>
  USING (business_id = (auth.session() ->> 'business_id'))        -- reads/updates/deletes
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));  -- inserts can't cross tenants
GRANT SELECT, INSERT, UPDATE, DELETE ON <t> TO authenticated;
```
Seed tables (8) use `business_id IS NULL OR business_id = (auth.session() ->> 'business_id')` so the
Inflow-provided global library rows are visible to every tenant.

**Why the write-path retrofit was a prerequisite:** under `authenticated`, the `WITH CHECK` rejects
any insert whose `business_id` ≠ the JWT tenant. The DB default (Treemarkables) would fail that check
for any *other* tenant — so inserts must set `business_id` explicitly, which `withTenant()` now does
at all 101 sites. (Single-tenant today: default = TM = claim, so it passes regardless.)

---

## Gotchas
- **`auth.session()` requires `pg_session_jwt`**, enabled by Stage 0. The policies reference it, so
  Stage 1 must run *after* Stage 0 (the role + extension must exist, or the GRANTs/policy fail).
- **Don't FORCE RLS** — owner must keep cross-tenant access for login/cron/platform.
- **Sequence grants** — included for any serial-backed tables.
- **Per-request JWT cost** — minting a JWT per query is cheap (RS256 sign), but cache the authed
  client per request if it shows up in latency.
- **Test with a non-owner connection** — the leakage tests must run *as authenticated*, not owner, or
  they'll falsely pass (owner bypasses everything — exactly the Phase 0 trap).

---

## ⏸️ PAUSED 2026-06-05 — blocked on Neon Authorize JWKS validation

**Decision:** paused (not abandoned). RLS isn't urgent while single-tenant; the data-layer + write-path
(done + safe) are what mattered. Resume as a focused effort before onboarding tenant #2.

**What got built/verified (all correct):**
- App-half: `db.ts` context-aware proxy (flag-gated), JWKS endpoint, JWT signing — built + unit-verified.
- Dev branch: `authenticated`/`authenticator`/`anonymous` roles created (non-bypass), `pg_session_jwt`
  installed, `auth.session()`/`auth.user_id()` present, all 127 RLS policies + grants applied.
- Our JWTs proven valid: `kid` matches the JWKS, `aud=authenticated`, `business_id` claim present.

**The blocker — Neon's proxy returns `jwk not found`** for every authed query, despite all of the above.
Tried and ruled out: branch-scoped JWKS → project-wide (no change); gist `text/plain`+`nosniff` →
`gistcdn.githack.com` `application/json` (no change). The proxy receives the token but can't match the
JWK — most likely the running Dev compute cached an empty JWKS state from before the provider existed
and won't refetch. **Untried (the likely fix): a Dev compute restart** to force a fresh JWKS fetch
(blocked by the safety classifier mid-session; needs explicit authorization to retry).

**Hard lesson for resume — production JWKS hosting:** GitHub gist/raw URLs are unusable as JWKS hosts
(`text/plain`+`nosniff`). For prod the JWKS **must** come from our own controlled endpoint —
`https://app.treemarkables.co.nz/.well-known/jwks.json` (the `jwksHandler` is built; it serves
`application/json`). That requires deploying the Phase 2 code (flag off) first.

**Resume options:**
1. **Finish Neon Authorize:** authorize a Dev compute restart; if it validates, deploy the JWKS
   endpoint to prod (flag off), point Neon at it, re-run the leakage test, then flip the flag.
2. **Pivot to the fallback:** dedicated non-bypass `app_tenant` role + `neon-serverless` pooler driver
   + per-request `SET LOCAL` — no Neon proxy/JWKS dependency. Bigger code change; reworks `db.ts`.

**Cleanup done:** Neon JWKS provider deleted (project back to clean). Dev-branch RLS policies + the
`authenticated` role LEFT in place (inert under the owner connection). `gistcdn.githack.com` was a
throwaway test host — never for production.

## Status (2026-06-05)
- ✅ `INFLOW_PHASE2_rls.sql` generated (127 tables, 8 seed-aware).
- ✅ **Option A chosen + app-half BUILT** (branch, undeployed, flag-gated):
  - `server/db.ts` — context-aware proxy; `TENANT_RLS_ENABLED` off ⇒ exact current behaviour. Verified.
  - `server/routes.ts` — `GET /.well-known/jwks.json` mounted (`jwksHandler`).
  - ALS `tenantStoreMiddleware` (already mounted) supplies `currentBusinessId()`; `signTenantJwt` mints per-query.
  - Startup assertion: `TENANT_RLS_ENABLED=true` requires the JWT key env vars.
  - *(Option-B leftovers `tenantContext.ts` / `dbForRequest.ts` now unused — leave dormant or delete later.)*
- ⏭️ **Stage 0 (Neon console — needs you):** add the custom JWKS provider → creates `authenticated` + enables `pg_session_jwt`.
- ⏭️ Then Stage 1 (RLS SQL on dev), Stage 4 (leakage tests on dev), Stage 5 (prod + flip flag).
