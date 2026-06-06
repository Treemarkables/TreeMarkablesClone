-- ============================================================================
-- INFLOW Trade Generalization — Phase B (foundation): industry selector
-- ============================================================================
-- Adds the per-business trade selector. Additive + idempotent; default 'tree'
-- keeps Treemarkables (and every existing row) on the arborist preset, so
-- behaviour is unchanged. Mirrors shared/schema.ts (businessSettings.industry).
-- DO NOT RUN without explicit approval (CLAUDE.md). Dev branch first, then prod.
-- ============================================================================
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS industry text DEFAULT 'tree';
