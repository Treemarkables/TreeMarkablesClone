-- In-app bug / feedback reports: any signed-in member files text + voice note
-- (Whisper transcript) + photos + video from anywhere in the app; device and
-- page context is captured automatically. Tenant-scoped via RLS; the platform
-- operator reads cross-tenant through requirePlatformAdmin routes.
--
-- Mirrored by the boot migration "bug-reports" in server/schemaMigrations.ts
-- (idempotent, runs every deploy), so this file is documentation + a manual
-- fallback for the Neon SQL editor. Run as ONE block.

CREATE TABLE IF NOT EXISTS bug_reports (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_employee_id varchar NOT NULL,
  status text NOT NULL DEFAULT 'draft',      -- draft | open | in_progress | resolved | closed
  severity text NOT NULL DEFAULT 'minor',    -- blocker | major | minor | idea
  title text,
  description text NOT NULL DEFAULT '',
  transcript text,
  page_url text,
  user_agent text,
  platform text,                             -- web | ios | android
  screen_size text,
  app_build text,
  extra_context jsonb,
  operator_notes text,
  resolved_at timestamp,
  submitted_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON bug_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS bug_report_attachments (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id varchar NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  kind text NOT NULL,                        -- photo | video | audio
  url text NOT NULL,
  thumbnail_url text,
  mime_type text,
  size_bytes integer,
  original_name text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bug_report_attachments_report_idx ON bug_report_attachments (report_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bug_reports', 'bug_report_attachments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = t::regclass
    ) THEN
      EXECUTE format('CREATE POLICY tenant_isolation ON %I
                 USING (business_id = nullif(current_setting(''app.current_business'', true), ''''))
                 WITH CHECK (business_id = nullif(current_setting(''app.current_business'', true), ''''))', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant', t);
    END IF;
  END LOOP;
END $$;
