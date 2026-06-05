-- ============================================================================
-- INFLOW Phase 4 — Subscriptions & billing schema (ALIGNED TO EXISTING DEV DB)
-- ============================================================================
-- The four billing tables ALREADY EXIST on the Neon dev branch (seeded
-- 2026-06-05 with live Stripe price IDs). This script mirrors that exact shape
-- so it is a valid "create from scratch" for environments that DON'T have them
-- yet (e.g. prod — UNVERIFIED, confirm in the DO console first), and seeds only
-- what's missing. Every statement is idempotent: re-running changes nothing.
--
-- DO NOT RUN without explicit approval (CLAUDE.md). On dev the tables already
-- exist, so only the add_ons seed + the Treemarkables comp row would apply.
--
-- Schema shape (matches dev): single stripe_price_id + interval per plan;
-- active_job_cap is the job limit; subscriptions/business_add_ons reference
-- plans/add-ons by ID (plan_id / add_on_id). Stripe price IDs are env-specific
-- (dev = test mode); set prod IDs via UPDATE once live products exist.
-- ============================================================================

BEGIN;

-- ── Tables (no-op where they already exist) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  stripe_price_id text,
  price_nzd numeric(10,2) NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'month',
  active_job_cap integer,                    -- NULL = unlimited
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  plan_id varchar REFERENCES subscription_plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',      -- active|trialing|past_due|canceled|incomplete
  current_period_end timestamp,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
-- UNIQUE on business_id: one subscription per business, and the conflict target
-- for the atomic webhook upsert (INSERT ... ON CONFLICT). Also serves as the
-- lookup index. Add idempotently (and only if no duplicates exist — dedupe
-- first if this raises a uniqueness error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'subscriptions'::regclass
      AND conname = 'subscriptions_business_id_unique'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_business_id_unique UNIQUE (business_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  stripe_price_id text,
  price_nzd numeric(10,2),
  billing_type text NOT NULL DEFAULT 'flat',  -- flat | metered
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS business_add_ons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  add_on_id varchar REFERENCES add_ons(id),
  status text NOT NULL DEFAULT 'active',       -- active | canceled
  stripe_subscription_item_id text,
  activated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_add_ons_business_idx ON business_add_ons(business_id);

-- ── Seed: plan catalog (skips rows already present by key) ──────────────────
-- Stripe price IDs left NULL — set per-environment (dev already has test IDs).
INSERT INTO subscription_plans (key, name, price_nzd, interval, active_job_cap, sort_order)
SELECT v.key, v.name, v.price_nzd, 'month', v.cap, v.sort
FROM (VALUES
  ('freemium', 'Freemium', 0::numeric,   15,   0),
  ('crew',     'Crew',     89::numeric,  75,   1),
  ('business', 'Business', 189::numeric, NULL, 2)
) AS v(key, name, price_nzd, cap, sort)
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans p WHERE p.key = v.key);

-- ── Seed: add-on catalog (dev currently empty — includes the Payments add-on) ─
INSERT INTO add_ons (key, name, billing_type)
SELECT v.key, v.name, v.billing_type
FROM (VALUES
  ('call_recording', 'Call recording',   'flat'),
  ('ai',             'AI assist bundle', 'metered'),
  ('sms',            'SMS overage',      'metered'),
  ('payments',       'In-app payments',  'flat')
) AS v(key, name, billing_type)
WHERE NOT EXISTS (SELECT 1 FROM add_ons a WHERE a.key = v.key);

-- ── Seed: comp Treemarkables (tenant #1) on Business, no Stripe ─────────────
-- Per decision 2026-06-02: TM is comped at full (Business) entitlements, $0.
DO $$
DECLARE tm varchar; biz_plan varchar;
BEGIN
  SELECT id INTO tm FROM businesses WHERE slug = 'treemarkables' LIMIT 1;
  SELECT id INTO biz_plan FROM subscription_plans WHERE key = 'business' LIMIT 1;
  IF tm IS NOT NULL AND biz_plan IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.business_id = tm) THEN
    INSERT INTO subscriptions (business_id, plan_id, status)
    VALUES (tm, biz_plan, 'active');
  END IF;
END $$;

COMMIT;

-- ── NOTE for Phase 2 RLS ────────────────────────────────────────────────────
-- subscriptions + business_add_ons are PER-TENANT and must join the RLS policy
-- set (app_tenant role + app.current_business GUC) when RLS is enabled — see
-- INFLOW_PHASE2_FALLBACK_rls.sql. subscription_plans + add_ons are GLOBAL
-- catalogs (read-only to tenants) and must NOT get a business_id RLS policy.
