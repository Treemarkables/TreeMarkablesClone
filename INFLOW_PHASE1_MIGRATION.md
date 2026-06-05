# Inflow — Phase 1 migration plan

## STATUS (2026-06-03)

- ✅ **Applied + validated on the DEV branch.** `businesses`=1 (Treemarkables), 127 tables got
  `business_id` (119 NOT NULL + 8 nullable seed), 127 FK constraints, all rows backfilled (0 nulls).
- 🛠️ **Design fix caught by dev testing → SQL is now v2.** Original v1 set `NOT NULL` with no
  default, which would have **broken every INSERT on prod** (the app doesn't supply `business_id`
  yet). v2 gives every `business_id` column a **`DEFAULT` = the Treemarkables id** for the
  single-tenant period, so inserts that omit it auto-stamp TM. Verified: 127/127 columns default to
  the TM id. Genuinely non-breaking. Drop the default in a follow-up once all writes pass it.
- ✅ **APPLIED TO PRODUCTION 2026-06-05** (Neon `production` branch, via SQL Editor, after a `pre-tenancy-backup` branch was taken). Validated: `businesses`=1 (Treemarkables), `business_id` on 127 tables, `customers` nulls=0. One-transaction run, "131 queries, executed successfully." Backup branch `pre-tenancy-backup` retained as rollback.
- ⏭️ **Next: the paired code work** (`schema.ts`/`timeTracking.ts` + `storage.ts` retrofit) — now safe to deploy since the prod columns exist.

## 🚨 Critical sequencing rule (do not deploy code ahead of the prod DB)

The PROD database migration **must run BEFORE** any `schema.ts` / `storage.ts` change that references
`business_id` is deployed. A push to `main` auto-deploys to DO; if the app ships referencing
`business_id` columns that don't yet exist on the prod DB, **prod breaks**. Order: (1) prod DB
migration via DO Console → (2) then merge + deploy the code changes.

---

## (original plan below — approach unchanged, SQL is now v2)


Adds the `businessId` tenancy column across the data layer and backfills Treemarkables as tenant #1.
Companion SQL: **`INFLOW_PHASE1_tenancy.sql`** (generated 2026-06-03, reviewable, **not** in the
drizzle `migrations/` dir so it can't auto-apply).

> **Nothing here has run.** Per CLAUDE.md: no `db:push` / `drizzle-kit push` / migration without
> explicit approval; never change PK column types. This document is for sign-off.

---

## The big simplifier: the app is single-tenant *today*

Every existing row in all 129 domain tables belongs to Treemarkables. So the initial backfill is a
**blanket stamp** — `SET business_id = <treemarkables-id>` everywhere — not a web of FK joins. The
parent-FK and soft-link mappings in `INFLOW_TENANCY_AUDIT.md` only become load-bearing when a
*second* tenant's data is imported (Phase 5 platform-migration). For stamping today's data, one
value covers all of it. This collapses the scariest part of the migration into a trivial UPDATE.

(That also means the two soft-link tables — `photoAnnotations`, `emailEvents` — need no special
join now; they get the same blanket stamp. Their soft-link backfill logic matters only at
second-tenant import time, and is documented for then.)

## Scope (verified counts)

| | Count |
|---|---|
| Domain tables (schema.ts + timeTracking.ts) | 129 |
| Get `business_id` | **127** |
| → become `NOT NULL` + FK + index | 119 |
| → stay nullable (8 seed tables, NULL = Inflow global seed) | 8 |
| Excluded (`users` legacy, `help_articles` global-v1) | 2 |

---

## Migration steps (all in `INFLOW_PHASE1_tenancy.sql`, one transaction)

1. **`businesses` tenant-root table** created.
2. **Add nullable `business_id`** to all 127 tables. *Additive and non-breaking* — the running app
   ignores the new columns; nothing depends on them yet.
3. **Create Treemarkables business row + blanket backfill** (atomic `DO` block).
4. **Validate** — assert `0` NULL `business_id` across every non-seed table.
5. **Enforce** — `SET NOT NULL` + FK + `business_id` index on the 119 non-seed tables; FK + index
   only on the 8 seed tables (kept nullable).

### Why this is safe to run while production keeps serving
- Steps 1–3 are additive; existing queries are untouched.
- The app connects as `neondb_owner` (which bypasses RLS — proven in Phase 0), so even after Step 5
  there is **no behavioural change**: no RLS is enabled in Phase 1, and no role switch happens here.
- Phase 1 lands the *data layer only*. Turning RLS on + moving tenant queries to the `authenticated`
  role is **Phase 2** — deliberately separate, after the code retrofit below is complete and tested.

---

## Paired code work (same change-set as the SQL, to keep Drizzle in sync)

1. **`shared/schema.ts` + `shared/timeTracking.ts`** — add `businessId: varchar("business_id")` to
   every targeted table (nullable in the type for now). The DB columns and the ORM schema must move
   together or queries can't reference the column. Mechanical, ~127 edits; I'll do it as one pass.
2. **`storage.ts` tenant-scoping retrofit** — thread `businessId` into reads/writes. Done
   **incrementally, module by module** (jobs → customers → quotes → …). Until RLS is on, these
   explicit filters are the *actual* isolation mechanism, so they matter. ~88% of access already
   funnels here (measured in Phase 0), plus the ~160 direct `db.*` sites in `routes.ts`.
3. **Session carries `businessId`** at login (always the Treemarkables id while single-tenant) — sets
   up the tenant-context middleware (`server/tenancy/tenantContext.ts`, already scaffolded) for
   Phase 2.

---

## Testing protocol (dev first, always)

1. Run `INFLOW_PHASE1_tenancy.sql` against the **Neon dev branch** (local `.env`) inside a
   transaction. Run the Step-4 validation queries → expect all zeros.
2. Smoke-test the app against the dev branch: login, create a job, attach a photo, invoice, mark
   complete. Confirm identical behaviour (columns present, app indifferent).
3. Only then apply to **prod via the DO Console** (per the prod-migration norm), in a transaction,
   during a quiet window. Re-run validation queries on prod.
4. Keep the rollback block (bottom of the SQL) ready — it drops every `business_id` column + the
   `businesses` table, fully reversing the change.

---

## What needs YOUR explicit approval (the gate)

- [ ] **Approve the migration approach** in this doc + the generated SQL.
- [ ] **Approve running it on the dev branch** (I can run that — it's the local `.env` dev branch).
- [ ] **Approve the prod run** — you (or I, with your say-so) apply via DO Console after dev passes.

## What I'll do once approved

1. Run + validate the SQL on the **dev branch**, report results.
2. Edit `shared/schema.ts` / `shared/timeTracking.ts` to add the columns (kept in sync with the DB).
3. Begin the `storage.ts` retrofit, module by module, with cross-tenant smoke checks.
4. Hand you the validated SQL + exact steps for the **prod** run via DO Console.

## Explicitly NOT in Phase 1
- Enabling RLS / switching to the `authenticated` role (Phase 2).
- Stripe billing, RBAC enforcement, self-serve signup (Phases 3–4).
- Second-tenant data import / the FK + soft-link backfill joins (Phase 5 platform migration).
