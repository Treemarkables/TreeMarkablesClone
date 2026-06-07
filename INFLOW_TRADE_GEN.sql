-- INFLOW — Trade Generalization Phase B: the trade-preset selector (REVIEW ARTIFACT).
-- Additive, nullable→default, no PK change (safe per CLAUDE.md). Run on prod via the
-- Neon SQL editor when going live. Default 'tree' keeps every existing row (incl.
-- Treemarkables) on the arborist preset — behaviour unchanged. Reversible (drop column).
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'tree';
