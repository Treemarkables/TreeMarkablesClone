-- Hazard tree / GPS pin register (site-persistent).
-- DISTINCT from tree_markers (job overlay that CASCADE-deletes with the job).
-- See HAZARD_TREE_PINS_PLAN.md.
--
-- Additive only. Does not alter jobs, quotes, or tree_markers.
-- Idempotent — also registered in server/schemaMigrations.ts (name:
-- hazard-tree-pins). Do NOT run against prod until the owner reviews the PR.
--
-- Run as ONE block on a Neon *dev* branch (SQL editor) if you want tables
-- before the next deploy. Prod: wait for merge; boot migration creates them.

CREATE TABLE IF NOT EXISTS customer_sites (
  business_id VARCHAR,
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS customer_sites_customer_id_idx ON customer_sites (customer_id);

CREATE TABLE IF NOT EXISTS tree_pins (
  business_id VARCHAR,
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  site_id VARCHAR NOT NULL REFERENCES customer_sites(id) ON DELETE RESTRICT,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  gps_accuracy REAL,
  risk_rating TEXT NOT NULL,
  recommended_work_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assessed',
  photo_urls TEXT[] DEFAULT '{}',
  species TEXT,
  size_notes TEXT,
  access_notes TEXT,
  notes TEXT,
  created_by VARCHAR,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tree_pins_customer_id_idx ON tree_pins (customer_id);
CREATE INDEX IF NOT EXISTS tree_pins_site_id_idx ON tree_pins (site_id);
CREATE INDEX IF NOT EXISTS tree_pins_status_idx ON tree_pins (status);

CREATE TABLE IF NOT EXISTS tree_pin_work_links (
  business_id VARCHAR,
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id VARCHAR NOT NULL REFERENCES tree_pins(id) ON DELETE CASCADE,
  job_id VARCHAR REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id VARCHAR REFERENCES quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tree_pin_work_links_pin_id_idx ON tree_pin_work_links (pin_id);
CREATE INDEX IF NOT EXISTS tree_pin_work_links_job_id_idx ON tree_pin_work_links (job_id);
CREATE INDEX IF NOT EXISTS tree_pin_work_links_quote_id_idx ON tree_pin_work_links (quote_id);

ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_sites;
CREATE POLICY tenant_isolation ON customer_sites
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));

ALTER TABLE tree_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tree_pins;
CREATE POLICY tenant_isolation ON tree_pins
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));

ALTER TABLE tree_pin_work_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tree_pin_work_links;
CREATE POLICY tenant_isolation ON tree_pin_work_links
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON customer_sites TO app_tenant;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tree_pins TO app_tenant;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tree_pin_work_links TO app_tenant;
  END IF;
END $$;
