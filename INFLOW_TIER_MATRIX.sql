-- INFLOW — tier feature-matrix store (REVIEW ARTIFACT — run when going live).
-- One isolated, GLOBAL table (no businessId, no RLS) holding which capability keys
-- each subscription tier includes. Queried ONLY by the platform-operator tier-matrix
-- admin API, so a missing table never affects checkout. Reversible (drop table).
-- The matrix UI works read-only off code defaults before this runs; SAVING needs it.
BEGIN;

CREATE TABLE IF NOT EXISTS plan_features (
  plan_key text PRIMARY KEY,
  features jsonb NOT NULL DEFAULT '[]',
  updated_at timestamp DEFAULT now());

-- Per-tier usage caps (the capacity layer). value NULL = unlimited, 0 = none.
CREATE TABLE IF NOT EXISTS plan_limits (
  plan_key text NOT NULL,
  limit_key text NOT NULL,
  value integer,
  PRIMARY KEY (plan_key, limit_key));

-- Per-business monthly usage counters (SMS, AI) for the metered caps. Tenant-scoped.
CREATE TABLE IF NOT EXISTS usage_counters (
  business_id varchar NOT NULL,
  metric text NOT NULL,
  period text NOT NULL,                  -- 'YYYY-MM' (Pacific/Auckland)
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, metric, period));

-- Admin matrix routes run inside a tenant request → the pinned app_tenant role needs
-- DML grants. plan_features/plan_limits are GLOBAL config (no RLS); usage_counters is
-- per-business so it gets a tenant-isolation policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_features, plan_limits, usage_counters TO app_tenant;

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_counters
  USING (business_id = nullif(current_setting('app.current_business', true),''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true),''));

COMMIT;
