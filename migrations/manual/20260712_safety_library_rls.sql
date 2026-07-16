-- Safety library customization: tenants can now create their own rows in the
-- four seeded safety libraries (SWMS templates, toolbox talk topics, pre-start
-- checklist templates, competency types), so each table needs a SPLIT RLS
-- policy instead of the standard tenant_isolation one:
--   * tenant_read  — everyone sees the built-in seeds (is_built_in = true)
--                    plus their own custom rows. A plain tenant_isolation
--                    policy hides the seeds from every tenant.
--   * tenant_write — insert/update/delete touch only your own rows; built-ins
--                    are immutable through the tenant role.
-- These tables also carried the legacy Treemarkables business_id column
-- DEFAULT (NOT NULL on two of them), which mis-stamps every seed row and every
-- context-less insert as TM — same class as the multer/ALS bug — so the
-- default and NOT NULL are dropped and the seed rows un-stamped to global.
-- Mirrored by the boot DDL in server/index.ts (idempotent, runs every deploy),
-- so this file is documentation + a manual fallback for the Neon SQL editor.
-- Run as ONE block.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['swms_templates','toolbox_talk_topics','prestart_checklist_templates','competency_types'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS business_id VARCHAR', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id DROP DEFAULT', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id DROP NOT NULL', t);
    EXECUTE format('UPDATE %I SET business_id = NULL WHERE is_built_in = true AND business_id IS NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_read ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_write ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_read ON %I FOR SELECT USING (is_built_in = true OR business_id = nullif(current_setting(''app.current_business'', true), ''''))', t);
    EXECUTE format(
      'CREATE POLICY tenant_write ON %I USING (business_id = nullif(current_setting(''app.current_business'', true), '''')) WITH CHECK (business_id = nullif(current_setting(''app.current_business'', true), ''''))', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant', t);
    END IF;
  END LOOP;
END $$;
