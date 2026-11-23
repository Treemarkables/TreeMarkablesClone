-- Completed jobs that still need an invoice or a customer send. Applied on
-- boot by server/schemaMigrations.ts ("completed-jobs-not-billed"). This file
-- is the same change for a manual run. Idempotent. Does not drop or retype
-- anything.
--
-- Nothing in this migration creates or sends an invoice. Detection starts on
-- the next hourly jobsNotBilledDetection run once the app is deployed.

CREATE TABLE IF NOT EXISTS job_billing_follow_ups (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar NOT NULL,
  customer_id varchar,
  invoice_id varchar,
  step text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  status text NOT NULL DEFAULT 'draft',
  subject text,
  message text NOT NULL DEFAULT '',
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  snooze_until timestamp,
  last_error text,
  completed_at timestamp,
  diary_entry_id varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_billing_follow_ups_job_uniq
  ON job_billing_follow_ups (business_id, job_id);
CREATE INDEX IF NOT EXISTS job_billing_follow_ups_business_status_idx
  ON job_billing_follow_ups (business_id, status);

ALTER TABLE job_billing_follow_ups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'tenant_isolation' AND polrelid = 'job_billing_follow_ups'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON job_billing_follow_ups
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
END $$;
