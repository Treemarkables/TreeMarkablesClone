-- Per-business invoice bank details (trade-gen Phase A — payment-routing fix).
-- The public invoice viewer hardcoded Treemarkables' bank account for EVERY tenant,
-- so a paying tenant's customer was told to pay into TM's account. This adds real
-- per-business fields; the viewer now shows the payment block only when set, so an
-- unconfigured tenant shows no bank details (never TM's).
--
-- Seeds Treemarkables' own details so its invoices are unchanged. Matched by
-- business_name (works on dev + prod without hardcoding the differing business_id).
-- Idempotent; also applied at boot (server/index.ts). Run dev then prod.

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS bank_account_name TEXT DEFAULT '';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT '';

UPDATE business_settings
   SET bank_account_name = 'Treemarkables Ltd',
       bank_account_number = '06-0637-0768850-00'
 WHERE business_name = 'Treemarkables'
   AND (bank_account_number IS NULL OR bank_account_number = '');
