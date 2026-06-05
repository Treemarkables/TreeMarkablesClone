-- ============================================================================
-- INFLOW Phase 4 — Subscriptions & billing schema
-- ============================================================================
-- Creates the four billing tables + seeds the plan/add-on catalog and the
-- comped Treemarkables (tenant #1) subscription. Additive only — no existing
-- table or column is touched, no PK types change.
--
-- DO NOT RUN without explicit approval (CLAUDE.md). Apply on the Neon DEV branch
-- first, validate, then on prod via the DO console. Mirrors the Drizzle defs in
-- shared/schema.ts (businesses already exists from INFLOW_PHASE1_tenancy.sql).
--
-- Draft prices are NZD ex-GST placeholders from INFLOW_SAAS_PLAN.md. Stripe
-- price IDs are intentionally NULL here — populated per-environment once the
-- Stripe products exist (UPDATE statements, or the app's plan-sync on boot).
-- ============================================================================

BEGIN;

-- ── Base membership tiers (global catalog) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,                 -- 'freemium' | 'crew' | 'business'
  name text NOT NULL,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  price_nzd_monthly numeric(10,2) DEFAULT 0,
  price_nzd_yearly numeric(10,2) DEFAULT 0,
  jobs_per_month integer,                   -- NULL = unlimited
  max_users integer,                        -- NULL = unlimited
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- ── One subscription per business (per-tenant) ──────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  plan_key text NOT NULL,                   -- → subscription_plans.key
  status text NOT NULL DEFAULT 'trialing',  -- trialing|active|past_due|canceled|incomplete
  billing_interval text NOT NULL DEFAULT 'month',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamp,
  trial_end timestamp,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_business_idx ON subscriptions(business_id);
-- one active base subscription per business
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_per_business
  ON subscriptions(business_id);

-- ── Cost-incurring add-ons (global catalog) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,                 -- 'call_recording' | 'ai' | 'sms' | 'payments'
  name text NOT NULL,
  stripe_price_id text,
  price_nzd numeric(10,2) DEFAULT 0,
  billing_type text NOT NULL DEFAULT 'flat',-- flat | metered
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- ── Which add-ons a business has switched on (per-tenant) ────────────────────
CREATE TABLE IF NOT EXISTS business_add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  add_on_key text NOT NULL,                 -- → add_ons.key
  status text NOT NULL DEFAULT 'active',    -- active | canceled
  stripe_subscription_item_id text,
  activated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT business_add_ons_business_key_uq UNIQUE (business_id, add_on_key)
);
CREATE INDEX IF NOT EXISTS business_add_ons_business_idx ON business_add_ons(business_id);

-- ── Seed: plan catalog (draft NZD ex-GST; Stripe IDs filled per-env later) ──
INSERT INTO subscription_plans (key, name, price_nzd_monthly, price_nzd_yearly, jobs_per_month, max_users, sort_order)
VALUES
  ('freemium', 'Freemium', 0,   0,    15,   1,    0),
  ('crew',     'Crew',     89,  890,  75,   NULL, 1),
  ('business', 'Business', 189, 1890, NULL, NULL, 2)
ON CONFLICT (key) DO NOTHING;

-- ── Seed: add-on catalog ────────────────────────────────────────────────────
INSERT INTO add_ons (key, name, billing_type)
VALUES
  ('call_recording', 'Call recording',     'flat'),
  ('ai',             'AI assist bundle',   'metered'),
  ('sms',            'SMS overage',        'metered'),
  ('payments',       'In-app payments',    'flat')
ON CONFLICT (key) DO NOTHING;

-- ── Seed: comp Treemarkables (tenant #1) on Business, no Stripe ─────────────
-- Per decision 2026-06-02: TM is comped at full (Business) entitlements, $0.
DO $$
DECLARE tm varchar;
BEGIN
  SELECT id INTO tm FROM businesses WHERE slug = 'treemarkables' LIMIT 1;
  IF tm IS NOT NULL THEN
    INSERT INTO subscriptions (business_id, plan_key, status, billing_interval)
    VALUES (tm, 'business', 'active', 'month')
    ON CONFLICT (business_id) DO NOTHING;
  END IF;
END $$;

COMMIT;

-- ── NOTE for Phase 2 RLS ────────────────────────────────────────────────────
-- subscriptions + business_add_ons are PER-TENANT and must be added to the RLS
-- policy set (app_tenant role + app.current_business GUC) when RLS is enabled —
-- see INFLOW_PHASE2_FALLBACK_rls.sql. subscription_plans + add_ons are GLOBAL
-- catalogs (read-only to tenants) and should NOT get a business_id RLS policy.
