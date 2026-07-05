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

-- Prices revised 2026-06-22 (user): Crew $89→$85, Business $189→$130.
-- New LIVE Stripe Price objects created + swapped into prod 2026-06-22 (NZD, monthly,
-- tax_behavior=exclusive — i.e. ex-GST, 15% GST added at checkout). The old $89/$189
-- prices are superseded (archive them in Stripe). IDs below are the live ones now in prod.
-- NOTE: SMS/AI bundled allowances (200/600 SMS, 75/250 AI actions per INFLOW_SAAS_PLAN.md)
-- are NOT represented in this schema — there are no sms_cap / ai_action_cap columns and
-- no metering yet. Enforcing the caps is unbuilt work, not just a seed value.
INSERT INTO subscription_plans (key, name, stripe_price_id, price_nzd, active_job_cap, sort_order) VALUES
  ('freemium','Freemium', NULL, 0, 15, 0),
  ('crew','Crew', 'price_1Tkxy2LboGXT31TYbUJj9KVR', 85, 75, 1),
  ('business','Business', 'price_1TkxzQLboGXT31TY2YMxr4tA', 130, NULL, 2)
ON CONFLICT (key) DO NOTHING;

COMMIT;
