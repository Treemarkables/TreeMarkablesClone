-- Close the tree_markers tenant-isolation + schema-drift gap.
-- shared/schema.ts declares business_id on tree_markers, but the bootstrap DDL
-- (migrations/0000) created the table WITHOUT it and no manual migration ever
-- added it — the table was only reachable from the orphaned JobSiteMap component,
-- so the drift sat dormant. Now that the job-site-map feature ships, any Drizzle
-- select would 500 without the column. It also has no RLS policy, so under the
-- blanket app_tenant GRANT it was cross-tenant readable/writable even with
-- TENANT_RLS_ENABLED on. ENABLE (not FORCE) RLS + the standard tenant_isolation
-- policy fixes it.
--
-- Idempotent. Run on Dev then Prod (Neon SQL editor); also applied idempotently at
-- boot (server/index.ts), so a deploy is safe either way.

ALTER TABLE tree_markers ADD COLUMN IF NOT EXISTS business_id VARCHAR;
UPDATE tree_markers tm SET business_id = j.business_id
  FROM jobs j WHERE tm.job_id = j.id AND tm.business_id IS NULL;
ALTER TABLE tree_markers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tree_markers;
CREATE POLICY tenant_isolation ON tree_markers
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON tree_markers TO app_tenant;
