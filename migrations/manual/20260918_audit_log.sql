-- Wave 3: wire auth events to audit_log.
-- CREATE TABLE IF NOT EXISTS so a table already present in Neon is left in
-- place (no primary-key rewrite). ADD COLUMN IF NOT EXISTS backfills any
-- columns this writer needs. Mirrored by the boot migration "audit-log-table"
-- in server/schemaMigrations.ts. Run as ONE block.

CREATE TABLE IF NOT EXISTS audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar,
  actor_employee_id varchar,
  target_employee_id varchar,
  action text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_employee_id varchar;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_employee_id varchar;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS success boolean DEFAULT true;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS audit_log_business_created_idx ON audit_log (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON audit_log (actor_employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_created_idx ON audit_log (action, created_at DESC);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'audit_log'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON audit_log
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT SELECT, INSERT ON audit_log TO app_tenant;
  END IF;
END $$;
