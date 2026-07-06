-- Stripe Connect (Express) — per-tenant card payments (Phase 1).
-- Lets a tenant accept card payments from their customers into their OWN Stripe account.
-- stripe_connect_account_id = the acct_… id; charges only flow once Stripe finishes
-- onboarding (stripe_connect_charges_enabled, synced from /api/billing/connect/status +
-- the account.updated webhook). Blank/false = no Connect → invoice falls back to bank
-- transfer. Treemarkables keeps using the single platform account, not Connect.
-- Idempotent. Also applied at boot (server/index.ts).

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT DEFAULT '';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false;
