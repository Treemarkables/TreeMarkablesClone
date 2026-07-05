-- Lanes: per-business buckets a job can OPTIONALLY sit in (orthogonal to jobs.status),
-- each carrying automations. See the Lanes claim in WORK_REGISTRY.md.
-- Apply via DO App Platform Console against the prod Neon DB.
-- Do NOT run drizzle-kit push from local — local DATABASE_URL is the dev branch.
-- Idempotent: safe to re-run (IF NOT EXISTS guards + guarded RLS block).

-- 1. lanes
CREATE TABLE IF NOT EXISTS lanes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lanes_business_idx ON lanes (business_id);
CREATE INDEX IF NOT EXISTS lanes_sort_idx ON lanes (business_id, sort_order);

-- 2. lane_automations
CREATE TABLE IF NOT EXISTS lane_automations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar,
  lane_id varchar NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  type text NOT NULL,                        -- customer_nudge | staff_reminder | auto_move | create_task
  trigger text NOT NULL DEFAULT 'days_in_lane', -- days_in_lane | on_enter | status_changed
  trigger_days integer,                      -- required when trigger = 'days_in_lane'
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lane_automations_lane_idx ON lane_automations (lane_id);
CREATE INDEX IF NOT EXISTS lane_automations_due_idx ON lane_automations (type, trigger, enabled);

-- 3. lane_automation_runs (de-dup ledger: "fire once per lane stay")
CREATE TABLE IF NOT EXISTS lane_automation_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar,
  job_id varchar NOT NULL,
  lane_id varchar NOT NULL,
  automation_id varchar NOT NULL,
  fired_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lane_runs_job_auto_idx ON lane_automation_runs (job_id, automation_id);

-- 4. jobs: orthogonal lane pointer + entry clock
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lane_id varchar REFERENCES lanes(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lane_entered_at timestamp;

-- 5. RLS — only on RLS-enabled deployments where the app_tenant role exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON lanes, lane_automations, lane_automation_runs TO app_tenant;

    ALTER TABLE lanes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE lane_automations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE lane_automation_runs ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'lanes'::regclass) THEN
      CREATE POLICY tenant_isolation ON lanes
        USING (business_id = nullif(current_setting('app.current_business', true), ''))
        WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'lane_automations'::regclass) THEN
      CREATE POLICY tenant_isolation ON lane_automations
        USING (business_id = nullif(current_setting('app.current_business', true), ''))
        WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'lane_automation_runs'::regclass) THEN
      CREATE POLICY tenant_isolation ON lane_automation_runs
        USING (business_id = nullif(current_setting('app.current_business', true), ''))
        WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
    END IF;
  END IF;
END $$;
