-- Neutralize document_templates' Treemarkables-hardcoded identity column defaults
-- (mirrors the business_settings fix from the universalization sweep). A new tenant's
-- templates are seeded explicitly by createTenant; these column defaults are only a
-- footgun for any OTHER insert path, which would stamp TM's identity onto another
-- business's PDFs/invoices.
--
-- 1) Set the identity column DEFAULTS to blank. Existing rows are NOT changed by an
--    ALTER DEFAULT, so Treemarkables keeps its values (stored as data on its own rows).
-- 2) Clear leftover TM identity from any NON-Treemarkables template that still carries
--    the EXACT old defaults across the board (i.e. created from the column defaults and
--    never customised). TM is excluded by its own business_id; a template that changed
--    even one field is left untouched.
-- Idempotent. Also applied at boot (server/index.ts).

ALTER TABLE document_templates ALTER COLUMN company_name SET DEFAULT '';
ALTER TABLE document_templates ALTER COLUMN company_address SET DEFAULT '';
ALTER TABLE document_templates ALTER COLUMN company_email SET DEFAULT '';
ALTER TABLE document_templates ALTER COLUMN company_phone SET DEFAULT '';
ALTER TABLE document_templates ALTER COLUMN gst_number SET DEFAULT '';

UPDATE document_templates
   SET company_name = '', company_address = '', company_email = '', company_phone = '', gst_number = ''
 WHERE business_id IS DISTINCT FROM (SELECT business_id FROM business_settings WHERE business_name = 'Treemarkables' LIMIT 1)
   AND company_name = 'Treemarkables LTD'
   AND company_address = '213 Stanley road, Gisborne'
   AND company_email = 'quotes@treemarkables.nz'
   AND company_phone = '027 216 6882'
   AND gst_number = '131-047-592-GST004';
