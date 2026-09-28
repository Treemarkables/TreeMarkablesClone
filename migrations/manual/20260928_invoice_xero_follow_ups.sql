-- Invoices sent to the customer but not in Xero. Applied automatically on boot
-- by server/schemaMigrations.ts ("invoices-not-in-xero"). This file is the
-- same change for a manual run. Idempotent. Does not drop or retype anything.
--
-- Nothing in this migration syncs to Xero. Detection starts on the next hourly
-- invoiceXeroDetection run once the app is deployed.

CREATE TABLE IF NOT EXISTS invoice_xero_follow_ups (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id varchar NOT NULL,
  job_id varchar,
  customer_id varchar,
  status text NOT NULL DEFAULT 'draft',
  snooze_until timestamp,
  last_error text,
  synced_at timestamp,
  diary_entry_id varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_xero_follow_ups_invoice_uniq
  ON invoice_xero_follow_ups (business_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_xero_follow_ups_business_status_idx
  ON invoice_xero_follow_ups (business_id, status);

ALTER TABLE invoice_xero_follow_ups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'tenant_isolation' AND polrelid = 'invoice_xero_follow_ups'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON invoice_xero_follow_ups
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
END $$;
