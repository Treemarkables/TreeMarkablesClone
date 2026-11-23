-- Quote follow-up queue. Applied automatically on boot by
-- server/schemaMigrations.ts ("quote-follow-up-workflow"). This file is the
-- same change for a manual run. Idempotent. Does not drop or retype anything.
--
-- Nothing in this migration sends a message. Detection starts on the next
-- hourly quoteFollowUpDetection run once the app is deployed.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revised_from_quote_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quote_followup_workflow_enabled boolean DEFAULT true;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quote_followup_nudge_days jsonb DEFAULT '[3, 7, 14]'::jsonb;

CREATE TABLE IF NOT EXISTS quote_follow_ups (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL,
  job_id varchar,
  customer_id varchar,
  kind text NOT NULL,
  nudge_step integer NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  status text NOT NULL DEFAULT 'draft',
  subject text,
  message text NOT NULL DEFAULT '',
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  source_type text NOT NULL DEFAULT 'quote',
  requote_id varchar,
  snooze_until timestamp,
  sent_at timestamp,
  diary_entry_id varchar,
  cancel_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS quote_follow_ups_quote_step_uniq
  ON quote_follow_ups (business_id, quote_id, nudge_step);
CREATE INDEX IF NOT EXISTS quote_follow_ups_business_status_idx
  ON quote_follow_ups (business_id, status);
ALTER TABLE quote_follow_ups ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'quote';

ALTER TABLE quote_follow_ups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'tenant_isolation' AND polrelid = 'quote_follow_ups'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON quote_follow_ups
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
END $$;
