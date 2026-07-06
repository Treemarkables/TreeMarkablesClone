-- Inflow usage caps (SMS + AI) — Phase A schema.
-- Run on DEV first, validate, then PROD via Neon SQL editor. Additive + reversible.
-- See INFLOW_USAGE_CAPS_PLAN.md. Idempotent (IF NOT EXISTS / guarded UPDATEs).
BEGIN;

-- 1. Caps on the plan (NULL = unlimited)
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sms_cap integer;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS ai_action_cap integer;
UPDATE subscription_plans SET sms_cap = 0,   ai_action_cap = 0   WHERE key = 'freemium';
UPDATE subscription_plans SET sms_cap = 200, ai_action_cap = 75  WHERE key = 'crew';
UPDATE subscription_plans SET sms_cap = 600, ai_action_cap = 250 WHERE key = 'business';

-- 2. Per-business overage policy (default soft-stop; 'metered' is Phase E)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_policy text NOT NULL DEFAULT 'soft_stop';

-- 3. Append-only usage log (tenant-scoped → RLS + app_tenant grant, like subscriptions)
CREATE TABLE IF NOT EXISTS usage_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  metric text NOT NULL,                 -- 'sms' | 'ai'
  quantity integer NOT NULL DEFAULT 1,
  feature text,                         -- 'booking_reminder' | 'speech_to_quote' | ...
  ref text,                             -- optional: jobId / quoteId / messageId
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_lookup ON usage_events (business_id, metric, created_at);

GRANT SELECT, INSERT ON usage_events TO app_tenant;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON usage_events;
CREATE POLICY tenant_isolation ON usage_events
  USING (business_id = nullif(current_setting('app.current_business', true),''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true),''));

COMMIT;
