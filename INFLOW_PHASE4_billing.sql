-- INFLOW PHASE 4 — subscription billing tables (REVIEW ARTIFACT — DO NOT AUTO-RUN)
-- 4 tables: subscription_plans + add_ons (global catalog, no RLS); subscriptions +
-- business_add_ons (tenant-scoped → RLS + app_tenant grants). Seeds the 3 plans.
-- Dev-validated; run on prod via Neon SQL Editor when going live. Reversible (drop tables).
BEGIN;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, name text NOT NULL,
  stripe_price_id text, price_nzd numeric(10,2) NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'month', active_job_cap integer,
  is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, name text NOT NULL, stripe_price_id text,
  price_nzd numeric(10,2), billing_type text NOT NULL DEFAULT 'flat',
  is_active boolean NOT NULL DEFAULT true);

CREATE TABLE IF NOT EXISTS subscriptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  plan_id varchar REFERENCES subscription_plans(id),
  stripe_customer_id text, stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active', current_period_end timestamp,
  cancel_at_period_end boolean NOT NULL DEFAULT false, trial_end timestamp,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

CREATE TABLE IF NOT EXISTS business_add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  add_on_id varchar REFERENCES add_ons(id),
  status text NOT NULL DEFAULT 'active', stripe_subscription_item_id text,
  activated_at timestamp DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_plans, add_ons, subscriptions, business_add_ons TO app_tenant;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (business_id = nullif(current_setting('app.current_business', true),''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true),''));
ALTER TABLE business_add_ons ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_add_ons
  USING (business_id = nullif(current_setting('app.current_business', true),''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true),''));

INSERT INTO subscription_plans (key, name, stripe_price_id, price_nzd, active_job_cap, sort_order) VALUES
  ('freemium','Freemium', NULL, 0, 15, 0),
  ('crew','Crew', 'price_1Tf0Z6LboGXT31TYwrPjNonb', 89, 75, 1),
  ('business','Business', 'price_1Tf0Z7LboGXT31TYR2GirPLw', 189, NULL, 2)
ON CONFLICT (key) DO NOTHING;

-- Add-on catalog (the "extras"). Keys MUST match the capability `requires` keys in
-- server/tenancy/capabilities.ts. price_nzd is ex-GST: for `flat` add-ons it's the
-- monthly price; for `metered` (SMS) it's the per-message rate (0.15 = 15c, ~36%
-- margin on the 11c/msg SMS Everyone cost). stripe_price_id is NULL until the
-- recurring prices are created in the Stripe dashboard — until then activating an
-- add-on unlocks the entitlement with no charge. DO UPDATE keeps name/price/type in
-- sync on re-run but never touches stripe_price_id, so dashboard wiring survives.
-- (server/billing.ts seedAddOnCatalog() also seeds these idempotently at boot.)
INSERT INTO add_ons (key, name, price_nzd, billing_type) VALUES
  ('sms','SMS & booking reminders', 0.15, 'metered'),
  ('call_recording','Call recording & in-app calling', 55, 'flat'),
  ('ai','AI assist bundle', 15, 'flat')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, price_nzd = EXCLUDED.price_nzd, billing_type = EXCLUDED.billing_type;

COMMIT;
