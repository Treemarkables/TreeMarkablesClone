-- Live job timers (clock in / clock out from the job card).
-- Stopping a timer converts the elapsed time into a jobs.staff_time_entries
-- entry, so labour cost / back-costing / gross margin reuse the existing
-- recompute paths. UNIQUE(employee_id) = one running timer per person.
--
-- Run as ONE block on the Neon prod branch (SQL editor). Idempotent — the
-- same DDL also auto-applies at boot (server/index.ts), so running this
-- manually just applies it ahead of the first deploy restart.

CREATE TABLE IF NOT EXISTS active_timers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id VARCHAR,
  job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id VARCHAR NOT NULL UNIQUE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON active_timers;
CREATE POLICY tenant_isolation ON active_timers
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON active_timers TO app_tenant;
  END IF;
END $$;
