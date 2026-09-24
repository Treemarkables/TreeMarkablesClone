-- One person can hold more than one checklist role (Kaitiaki / Kaiwhangai /
-- Kaitirotiro) on the same NZ day.
--
-- job_day_roles_employee_date_uniq allowed a single row per person per day, so
-- assigning a second role replaced the first. This drops that constraint and
-- adds unique (employee_id, nz_date, role_key). No rows are deleted. Every
-- existing one-role row still satisfies the new unique.
--
-- job_role_completions is widened the same way so a job-close snapshot can
-- freeze each role they held. A historical one-role snapshot stays one row.
--
-- Mirrored by the boot migration "job-day-roles-multi-per-person" in
-- server/schemaMigrations.ts. This file is the manual fallback. Run as ONE block
-- after 20260914_job_day_roles.sql.

ALTER TABLE job_day_roles DROP CONSTRAINT IF EXISTS job_day_roles_employee_date_uniq;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_day_roles_employee_date_role_uniq'
  ) THEN
    ALTER TABLE job_day_roles
      ADD CONSTRAINT job_day_roles_employee_date_role_uniq
      UNIQUE (employee_id, nz_date, role_key);
  END IF;
END $$;

ALTER TABLE job_role_completions DROP CONSTRAINT IF EXISTS job_role_completions_job_employee_uniq;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_role_completions_job_employee_role_uniq'
  ) THEN
    ALTER TABLE job_role_completions
      ADD CONSTRAINT job_role_completions_job_employee_role_uniq
      UNIQUE (job_id, employee_id, role_key);
  END IF;
END $$;
