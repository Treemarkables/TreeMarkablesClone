-- Stripe payouts and the balance-transaction lines inside each payout.
-- Applied on boot by server/schemaMigrations.ts ("stripe-payouts").
-- Idempotent. Does not drop or retype anything.
-- Do not run drizzle-kit push / npm run db:push for this change.
--
-- Account codes on xero_settings are the clearing account (default 640) and
-- the optional Stripe fees expense account used when an admin posts a payout.

ALTER TABLE xero_settings ADD COLUMN IF NOT EXISTS stripe_clearing_account_code text DEFAULT '640';
ALTER TABLE xero_settings ADD COLUMN IF NOT EXISTS stripe_fees_account_code text;

UPDATE xero_settings
   SET stripe_clearing_account_code = '640'
 WHERE stripe_clearing_account_code IS NULL;

CREATE TABLE IF NOT EXISTS stripe_payouts (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payout_id text NOT NULL,
  stripe_account_id text,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'NZD',
  status text NOT NULL,
  arrival_date timestamp,
  created_stripe timestamp,
  description text,
  fee_total numeric(12, 2) NOT NULL DEFAULT 0,
  charge_total numeric(12, 2) NOT NULL DEFAULT 0,
  refund_total numeric(12, 2) NOT NULL DEFAULT 0,
  xero_fee_id text,
  xero_fee_kind text,
  xero_fee_message text,
  xero_posted_at timestamp,
  xero_posting_at timestamp,
  xero_summary jsonb,
  fetched_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_payouts_business_payout_uniq
  ON stripe_payouts (business_id, stripe_payout_id);
CREATE INDEX IF NOT EXISTS stripe_payouts_business_arrival_idx
  ON stripe_payouts (business_id, arrival_date);

CREATE TABLE IF NOT EXISTS stripe_payout_lines (
  business_id varchar,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id varchar NOT NULL REFERENCES stripe_payouts(id) ON DELETE CASCADE,
  balance_transaction_id text NOT NULL,
  stripe_type text,
  kind text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  fee numeric(12, 2) NOT NULL DEFAULT 0,
  net numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NZD',
  description text,
  stripe_source_id text,
  stripe_charge_id text,
  stripe_payment_id text,
  match_status text NOT NULL DEFAULT 'unmatched',
  payment_id varchar,
  job_id varchar,
  invoice_id varchar,
  customer_id varchar,
  xero_payment_id text,
  xero_credit_note_id text,
  xero_refund_payment_id text,
  xero_status text,
  xero_message text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_payout_lines_payout_bt_uniq
  ON stripe_payout_lines (payout_id, balance_transaction_id);
CREATE INDEX IF NOT EXISTS stripe_payout_lines_payout_idx
  ON stripe_payout_lines (payout_id);

ALTER TABLE stripe_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payout_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'tenant_isolation' AND polrelid = 'stripe_payouts'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_payouts
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'tenant_isolation' AND polrelid = 'stripe_payout_lines'::regclass
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_payout_lines
      USING (business_id = nullif(current_setting('app.current_business', true), ''))
      WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
  END IF;
END $$;
