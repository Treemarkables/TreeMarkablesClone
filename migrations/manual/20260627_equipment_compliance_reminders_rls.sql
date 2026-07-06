-- Close the equipment_compliance_reminders tenant-isolation gap.
-- The table carries business_id but shipped without an RLS policy. Because the
-- Phase-2 FALLBACK grants give app_tenant a blanket GRANT ON ALL TABLES, that made
-- it cross-tenant readable/writable even with TENANT_RLS_ENABLED on. ENABLE (not
-- FORCE) RLS + the standard tenant_isolation policy fixes it; the cron writes on the
-- owner connection so its dedupe behaviour is unchanged.
--
-- Idempotent. Run on Dev then Prod (Neon SQL editor); also applied idempotently at
-- boot (server/index.ts), so a deploy is safe either way.

ALTER TABLE equipment_compliance_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON equipment_compliance_reminders;
CREATE POLICY tenant_isolation ON equipment_compliance_reminders
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_compliance_reminders TO app_tenant;
