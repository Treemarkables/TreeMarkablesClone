# Inflow — Phase 2 (RLS fallback) PRODUCTION runbook

Rolls out the `app_tenant` + GUC RLS isolation to production. Three steps; each is reversible and
the first two are no-ops until the flag is flipped.

- **Project:** `rapid-wildflower-05348699` → branch **production** (`treemarkables-prod`)
- **SQL:** `INFLOW_PHASE2_FALLBACK_rls.sql` (dev-validated on real tables)

---

## Step 1 — apply the RLS SQL to prod  ⟵ DO THIS FIRST (safe, no-op)

Creates the `app_tenant` role + GUC `tenant_isolation` policies on all 127 tables. **No behavioural
change:** the deployed app connects as `neondb_owner` (BYPASSRLS), so the policies don't bite until
the code is deployed AND `TENANT_RLS_ENABLED=true`.

1. *(Optional but cheap)* Neon → Branches → New branch from `production` → `pre-rls-backup`,
   Auto-delete **Never**.
2. Copy the SQL to your clipboard (terminal):
   ```bash
   cat "/Users/jullianhalley/code/TreeMarkablesClone/.claude/worktrees/priceless-chaum-964bb6/INFLOW_PHASE2_FALLBACK_rls.sql" | pbcopy
   ```
3. Neon Console → project `rapid-wildflower-05348699` → branch **production** → **SQL Editor**.
4. Paste + **Run** (one `BEGIN…COMMIT`; all-or-nothing).
5. Validate (paste + Run):
   ```sql
   select rolname, rolbypassrls from pg_roles where rolname='app_tenant';          -- 1 row, bypassrls=false
   select count(*)::int from pg_tables where schemaname='public' and rowsecurity;   -- 127
   select count(*)::int from pg_policies where policyname='tenant_isolation';        -- 127
   select count(distinct tablename)::int from pg_policies
     where policyname='tenant_isolation' and schemaname='public';                    -- 127
   ```
   Expect `app_tenant` (bypassrls=false), 127, 127, 127.
6. Confirm the live app still behaves normally (it's still on owner → unaffected). Create a test job.

**Rollback:** the commented block at the bottom of the SQL (drops policies + role).

---

## Step 2 — deploy the code (flag OFF)  ⟵ I prep this (branch rebase + PR)

The branch (`inflow-multitenancy`) is behind `main`; it needs a rebase/merge before it can ship.
Once merged to `main` and pushed, DO auto-deploys. **`TENANT_RLS_ENABLED` is unset → flag off → the
new code runs exactly like today** (owner client, no pool created). This deploy is behaviourally inert
on its own — it just ships the capability.

Prereqs before merging: `TENANT_RLS_ENABLED` must NOT be set in prod yet (so the deploy stays inert).

---

## Step 3 — flip the flag  ⟵ the moment RLS goes live

1. DO dashboard → app env vars → add `TENANT_RLS_ENABLED=true` → redeploy/restart.
2. Tenant requests now run via the `app_tenant` pooled connection; RLS enforces.
3. Smoke-test: log in as Treemarkables → you should see **all** your data (you're the only tenant, so
   RLS lets everything through). Create a job + photo (exercises the WITH CHECK on insert).
4. **Watch the WebSocket pool** for ~an hour (DO logs / Neon Monitoring) — this is the one step that
   reintroduces persistent connections (what neon-http avoided). Look for connection errors/timeouts.
5. **Instant rollback:** unset `TENANT_RLS_ENABLED` (or set `=false`) → redeploy → back to owner client,
   no pool. No DB change needed.

---

## Order rationale
SQL (Step 1) and deploy (Step 2) are both inert on their own — only Step 3 activates anything. So
Steps 1–2 can land any time, in any order, with zero risk; Step 3 is the single deliberate switch,
and it's instantly reversible.
