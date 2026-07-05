-- Per-business email brand colours (trade-gen Phase A — branded-email colours).
-- The shared branded-email template (server/emailTemplates.ts) hardcoded a single
-- BRAND palette (black header + neon-green accent), so every tenant's invoice /
-- proposal / quote email was branded in Treemarkables' colours. These columns make
-- the header background + accent per-business; the template reads them with a
-- contrast-safe text colour computed at render time.
--
-- Defaults reproduce Treemarkables' current black (#0b0b0b) + neon green (#39FF14),
-- so EVERY existing email renders byte-identical until a business sets its own — no
-- TM seed row is needed (unlike GST / bank, where the default had to stay empty).
-- Idempotent; also applied at boot (server/index.ts). Run dev then prod.

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS brand_header_color TEXT DEFAULT '#0b0b0b';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#39FF14';
