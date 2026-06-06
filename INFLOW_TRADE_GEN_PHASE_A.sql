-- ============================================================================
-- INFLOW Trade Generalization — Phase A (identity de-hardcoding)
-- ============================================================================
-- Adds three per-business identity fields so customer-facing output + AI prompts
-- can read them instead of the hardcoded "Jules" / "Qualified Arborists" /
-- "arborist" literals. Additive + idempotent; defaults reproduce Treemarkables'
-- current values, so behaviour is unchanged until a business overrides them.
--
-- DO NOT RUN without explicit approval (CLAUDE.md). Apply on the Neon DEV branch
-- first, then prod via the Neon/DO console. Mirrors the Drizzle decl in
-- shared/schema.ts (businessSettings).
-- ============================================================================

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS owner_name text DEFAULT 'Jules';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_tagline text DEFAULT 'Qualified Arborists';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_discipline text DEFAULT 'arborist';
