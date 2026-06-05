-- INFLOW PHASE 2 FALLBACK — grant patch (REVIEW ARTIFACT — DO NOT AUTO-RUN)
-- Run on prod AFTER INFLOW_PHASE2_FALLBACK_rls.sql and BEFORE setting TENANT_RLS_ENABLED=true.
--
-- Why: when RLS is on, every query in a tenant request runs as `app_tenant`. The main fallback
-- SQL only granted app_tenant the 127 tenant tables, but the app also reads non-tenant tables
-- (businesses, users, help_articles, etc.). Without these grants, those requests fail
-- "permission denied". Plus the `businesses` table itself needs RLS so a tenant sees only its own
-- company row. Isolation stays enforced by RLS (127 tenant tables + businesses); the broad grant
-- just lets the app reach what it needs — the standard "broad grant + RLS isolates" model.
--
-- Validated on Dev: app_tenant reads users/businesses; businesses shows only the tenant's own row
-- (own=1, other=0); the 127 tenant tables still isolate. SAFE: a no-op while the app is on the
-- owner connection (flag off). Reversible (bottom).

BEGIN;

-- 1) Isolate the tenant-root `businesses` table (a tenant sees only its own row).
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON businesses;
CREATE POLICY tenant_isolation ON businesses
  USING (id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (id = nullif(current_setting('app.current_business', true), ''));

-- 2) Let app_tenant reach every table the app touches (RLS still isolates the tenant tables +
--    businesses). Covers current and future tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;

COMMIT;

-- ROLLBACK:
-- BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON businesses;
--   ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_tenant;
--   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_tenant;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_tenant;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM app_tenant;
-- COMMIT;
