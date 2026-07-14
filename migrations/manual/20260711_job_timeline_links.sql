-- Public job photo timeline links — token-gated, read-only customer link to
-- a job's photo feed (CompanyCam-style). One link per job.
--
-- Run as ONE block on the Neon prod branch (SQL editor). Idempotent — the
-- same DDL also auto-applies at boot (server/index.ts), so running this
-- manually just applies it ahead of the first deploy restart.

CREATE TABLE IF NOT EXISTS job_timeline_links (
  business_id VARCHAR,
  job_id VARCHAR PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE job_timeline_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_timeline_links;
CREATE POLICY tenant_isolation ON job_timeline_links
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON job_timeline_links TO app_tenant;
  END IF;
END $$;
