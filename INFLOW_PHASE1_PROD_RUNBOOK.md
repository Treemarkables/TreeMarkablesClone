# Inflow — Phase 1 PRODUCTION migration runbook

Runs the **dev-validated** `INFLOW_PHASE1_tenancy.sql` (v2) against the **production** Neon branch.
You execute this — I can't reach the prod DB from the local `.env`.

- **Project:** `rapid-wildflower-05348699` (Treemarkables LTD) → branch **production** (`treemarkables-prod`)
- **What it does:** adds `business_id` to 127 tables, backfills every row to Treemarkables (tenant #1),
  defaults each column to the TM id so the running app keeps inserting with no code change.
- **Behavioural change to the app:** none. It connects as `neondb_owner` (bypasses RLS), ignores the
  new columns, and inserts get the TM default. RLS / role-switch is Phase 2, not here.
- ⏱️ Pick a **low-traffic window** — it runs as one transaction and briefly locks each table while it
  backfills + adds constraints (fast on this data size, but don't run mid-busy-day).

---

## Step 0 — safety net (30 seconds, strongly recommended)

In the Neon Console, create an instant **branch from `production`** (e.g. `pre-tenancy-backup`) right
before running. If anything goes wrong you can restore production from it in one click — a cleaner
rollback than re-running SQL. Neon → Branches → New branch → parent = production.

## Step 1 — pre-flight (read-only, paste into Neon SQL Editor on the `production` branch)

Confirms prod matches the assumptions the dev run validated. **All three must pass before Step 2.**

```sql
-- (a) businesses table should NOT exist yet  -> expect 0
select count(*)::int as businesses_table_exists
from information_schema.tables where table_schema='public' and table_name='businesses';

-- (b) no table should already have business_id -> expect 0
select count(*)::int as cols_with_business_id
from information_schema.columns where table_schema='public' and column_name='business_id';

-- (c) sanity: how many public tables (dev had 130)  -> expect ~130
select count(*)::int as public_tables
from information_schema.tables where table_schema='public';
```
If (a) or (b) is non-zero, **stop** and send me the result — prod has drifted from dev.

## Step 2 — run the migration

1. Open `INFLOW_PHASE1_tenancy.sql` (repo root) and copy its **entire** contents.
2. Neon Console → project `rapid-wildflower-05348699` → branch **production** → **SQL Editor**.
3. Paste and **Run**. The file is wrapped in a single `BEGIN … COMMIT`, so it's all-or-nothing —
   any error rolls the whole thing back automatically.

## Step 3 — validate (paste into the SQL Editor; compare to the dev results)

```sql
select count(*)::int as businesses_rows, max(name) as name from businesses;                       -- expect 1, Treemarkables
select count(*)::int as business_id_cols from information_schema.columns
  where table_schema='public' and column_name='business_id';                                       -- expect 127
select count(*)::int as not_null_cols from information_schema.columns
  where table_schema='public' and column_name='business_id' and is_nullable='NO';                  -- expect 119
select count(*)::int as cols_with_default from information_schema.columns
  where table_schema='public' and column_name='business_id' and column_default is not null;        -- expect 127
select count(*)::int as fk_constraints from information_schema.table_constraints
  where constraint_schema='public' and constraint_type='FOREIGN KEY'
  and constraint_name like '%\_business\_fk';                                                       -- expect 127
select count(*)::int as jobs_nulls from jobs where business_id is null;                             -- expect 0
select count(*)::int as customers_nulls from customers where business_id is null;                   -- expect 0
```
**All seven must match** (1 / 127 / 119 / 127 / 127 / 0 / 0). If so, prod is migrated. ✅

## Step 4 — confirm the app still works

Open `https://app.treemarkables.co.nz`, log in, create a quick test job + attach a photo + mark it
done. It should behave identically (the TM default fills `business_id` on every insert). Spot-check:
```sql
select business_id, count(*) from jobs group by business_id;   -- all rows under the one TM id
```

## Rollback (only if something looks wrong)

- **Preferred:** restore production from the `pre-tenancy-backup` branch (Step 0) in the Neon console.
- **Or:** run the commented `ROLLBACK` block at the bottom of `INFLOW_PHASE1_tenancy.sql` (drops every
  `business_id` column + the `businesses` table). Reverses the migration completely.

---

## After prod is migrated — tell me, and I proceed to the code

Only **after** Step 3 passes on prod do the code changes become safe to deploy (the sequencing rule):
1. I add `business_id` to `shared/schema.ts` + `shared/timeTracking.ts` (nullable in TS; DB enforces it).
2. I start the `storage.ts` tenant-scoping retrofit, module by module.
3. We ship those via PR → merge → DO deploy, now that the prod columns exist.

Send me the Step-3 results (or just "prod done") and I'll pick up the code work.
