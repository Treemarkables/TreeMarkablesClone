-- Frozen snapshot of each person's role-checklist completion on a job, written
-- once when the job closes.
--
-- Why a snapshot instead of recomputing on read: role_checklist_tasks is editable
-- from Settings, so the denominator moves. A task added next month would
-- retroactively drop every historical job below 100%, and disabling one would make
-- them all jump. Freezing items_expected (and the ids behind it) at close is what
-- keeps a completion-rate trend honest.
--
-- One row per (job_id, employee_id): checklist completions are per job, not per
-- day, so a multi-day job snapshots once. role_key is the role that person held on
-- the job's completion date.
--
-- Mirrored by the boot migration "job-role-completions" in server/schemaMigrations.ts
-- (idempotent, runs every deploy), so this file is documentation + a manual
-- fallback for the Neon SQL editor. Run as ONE block.

CREATE TABLE IF NOT EXISTS job_role_completions (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id varchar NOT NULL,
  nz_date text NOT NULL,
  role_key text NOT NULL,
  items_done integer NOT NULL,
  items_expected integer NOT NULL,
  expected_item_ids jsonb,
  done_item_ids jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT job_role_completions_job_employee_uniq UNIQUE (job_id, employee_id)
);

CREATE INDEX IF NOT EXISTS job_role_completions_employee_idx ON job_role_completions (employee_id);
CREATE INDEX IF NOT EXISTS job_role_completions_date_idx ON job_role_completions (nz_date);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE job_role_completions ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polname = 'tenant_isolation' AND polrelid = 'job_role_completions'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY tenant_isolation ON job_role_completions
               USING (business_id = nullif(current_setting(''app.current_business'', true), ''''))
               WITH CHECK (business_id = nullif(current_setting(''app.current_business'', true), ''''))';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON job_role_completions TO app_tenant';
  END IF;
END $$;
