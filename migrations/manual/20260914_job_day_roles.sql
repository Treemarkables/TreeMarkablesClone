-- Per-person, per-day crew role (Kaitiaki / Kaiwhangai / Kaitirotiro) for the job
-- card's role checklist sections.
--
-- Replaces job_staff_assignments.day_role as the READ source. That column stored a
-- per-person-per-day fact on a per-booking row, so it had to be fanned out across
-- every assignment row for the day and inherited onto newly created ones — and
-- anyone who was clocked in without an assignment row had nowhere to hold a role at
-- all, which is what blocked allocating roles from the job card.
--
-- day_role keeps being written for one release so existing readers don't break. It
-- is NOT dropped here; that's a follow-up once nothing reads it.
--
-- Mirrored by the boot migration "job-day-roles" in server/schemaMigrations.ts
-- (idempotent, runs every deploy), so this file is documentation + a manual
-- fallback for the Neon SQL editor. Run as ONE block.

CREATE TABLE IF NOT EXISTS job_day_roles (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL,
  nz_date text NOT NULL,
  role_key text NOT NULL,
  set_by_employee_id varchar,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- employee_id is already tenant-scoped, so this stays clear of the
  -- NULL-distinct trap a unique including the nullable business_id would hit.
  CONSTRAINT job_day_roles_employee_date_uniq UNIQUE (employee_id, nz_date)
);

CREATE INDEX IF NOT EXISTS job_day_roles_date_idx ON job_day_roles (nz_date);

-- Backfill from the legacy column. Safe to re-run. DISTINCT ON keeps the most
-- recently updated row when a person's assignments disagree for the same NZ day.
INSERT INTO job_day_roles (business_id, employee_id, nz_date, role_key)
  SELECT DISTINCT ON (employee_id, nz_date) business_id, employee_id, nz_date, day_role
    FROM (
      SELECT business_id,
             employee_id,
             to_char((start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland')::date, 'YYYY-MM-DD') AS nz_date,
             day_role,
             updated_at
        FROM job_staff_assignments
       WHERE day_role IN ('A', 'B', 'C')
    ) src
   ORDER BY employee_id, nz_date, updated_at DESC
  ON CONFLICT ON CONSTRAINT job_day_roles_employee_date_uniq DO NOTHING;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE job_day_roles ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polname = 'tenant_isolation' AND polrelid = 'job_day_roles'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY tenant_isolation ON job_day_roles
               USING (business_id = nullif(current_setting(''app.current_business'', true), ''''))
               WITH CHECK (business_id = nullif(current_setting(''app.current_business'', true), ''''))';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON job_day_roles TO app_tenant';
  END IF;
END $$;
