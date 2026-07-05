-- Per-business GST number (trade-gen Phase A follow-up; plan line 219).
-- The branded-email footer + identity helper previously fell back to COMPANY.gstNumber
-- (Treemarkables' GST) for every tenant. This adds a real per-business field; the
-- helper now defaults it to '' (no GST line) instead of leaking TM's number.
--
-- Seeds Treemarkables' own GST so its output is unchanged. Matched by business_name
-- (works on both dev + prod branches without hardcoding the differing business_id).
-- Idempotent; also applied at boot (server/index.ts).

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_gst_number TEXT DEFAULT '';

UPDATE business_settings
   SET business_gst_number = '131-047-592-GST004'
 WHERE business_name = 'Treemarkables'
   AND (business_gst_number IS NULL OR business_gst_number = '');
