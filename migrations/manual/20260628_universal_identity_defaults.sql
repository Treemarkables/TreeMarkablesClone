-- Universal identity defaults (trade-gen sweep). New tenants must start
-- trade-agnostic, not as Treemarkables/arborist clones.
--
-- 1) Neutralise the business_settings column DEFAULTS so a freshly-created tenant
--    row no longer inherits Jules / arborist / Qualified Arborists / tree. Existing
--    rows are NOT changed by an ALTER DEFAULT (Treemarkables keeps its values).
-- 2) Clear the leftover tree defaults from any EXISTING non-Treemarkables row that
--    still has the EXACT old defaults across the board (i.e. never customised — the
--    demo tenants). Treemarkables is excluded by name and keeps its identity. A
--    tenant that set even one of these fields is left untouched.
--
-- getBusinessIdentity() now falls back to neutral values (blank, discipline =
-- "field-service"), so a blank field renders generically, never as Treemarkables.
-- Idempotent. Run dev then prod.

ALTER TABLE business_settings ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE business_settings ALTER COLUMN business_tagline SET DEFAULT '';
ALTER TABLE business_settings ALTER COLUMN business_discipline SET DEFAULT '';
ALTER TABLE business_settings ALTER COLUMN industry SET DEFAULT 'general';
ALTER TABLE business_settings ALTER COLUMN business_name SET DEFAULT 'My Business';

UPDATE business_settings
   SET owner_name = '', business_tagline = '', business_discipline = '', industry = 'general'
 WHERE business_name <> 'Treemarkables'
   AND owner_name = 'Jules'
   AND business_discipline = 'arborist'
   AND business_tagline = 'Qualified Arborists'
   AND industry = 'tree';
