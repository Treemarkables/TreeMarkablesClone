-- Global knowledge (how-to) videos are written business_id = NULL by design
-- (#233), but the legacy tenancy migration left videos.business_id with
-- NOT NULL + a Treemarkables-id DEFAULT in the live databases (schema.ts has
-- the column nullable with no default). The first real knowledge-video upload
-- (2026-07-17) failed with a not-null violation.
--
-- NOTE: this is applied automatically at boot by server/schemaMigrations.ts
-- ("videos-business-id-global-knowledge") — this file is the manual mirror,
-- kept for the migrations/manual/ record. Safe to re-run.

ALTER TABLE videos ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE videos ALTER COLUMN business_id DROP NOT NULL;

-- Un-stamp any knowledge row mis-stamped with a tenant id (e.g. a job video
-- re-tagged into the global library keeps its old stamp) back to global.
UPDATE videos SET business_id = NULL WHERE kind = 'knowledge' AND business_id IS NOT NULL;
