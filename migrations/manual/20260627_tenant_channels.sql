-- Inbound channel → tenant map (Group B tenant-resolution infra).
-- Resolves a dialed number / inbound SMS sender / email recipient / FB page id to
-- the owning business, so session-less inbound webhooks stop defaulting writes to
-- the column-default tenant (Treemarkables) and stop matching callers across all
-- tenants. See shared/schema.ts (tenantChannels) + server/tenancy/channelMap.ts.
--
-- Idempotent. Run on Dev first, then Prod (Neon SQL editor) BEFORE deploying — but
-- it is also created idempotently at boot (server/index.ts), so the deploy is safe
-- either way. Apply on the same Neon branch as the rest of the Phase-2 RLS objects.

CREATE TABLE IF NOT EXISTS tenant_channels (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  VARCHAR NOT NULL,
  channel_type TEXT NOT NULL,            -- 'phone' | 'email' | 'fb_page'
  identifier   TEXT NOT NULL,            -- normalized: phone=last 8 digits, email=lowercased, fb_page=raw
  label        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One identifier maps to exactly one tenant.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_type_identifier_idx
  ON tenant_channels (channel_type, identifier);
CREATE INDEX IF NOT EXISTS tenant_channels_business_idx
  ON tenant_channels (business_id);

-- RLS: ENABLE (not FORCE) so the owner connection can resolve across all tenants
-- (resolution sets no GUC), while the app_tenant role only ever sees its own rows.
-- The blanket GRANT ON ALL TABLES (FALLBACK grants) already reaches this table, so
-- the policy is what keeps it from being cross-tenant readable — do not omit it.
ALTER TABLE tenant_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_channels;
CREATE POLICY tenant_isolation ON tenant_channels
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_channels TO app_tenant;
