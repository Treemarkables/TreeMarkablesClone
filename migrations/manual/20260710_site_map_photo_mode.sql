-- Site-map photo mode: markers on an uploaded image instead of the satellite
-- map — for jobs (e.g. council work) where the job-card address is the
-- billing address, not the actual site, so the geocoded satellite view is
-- useless and the user supplies their own aerial/plan photo.
--
-- tree_markers.surface: 'map' = latitude/longitude are geographic; 'image' =
-- normalized 0..1 coords (lat=y from top, lng=x from left) on the job's
-- uploaded site-map image.
--
-- Idempotent. Run on Dev then Prod (Neon SQL editor); also applied
-- idempotently at boot (server/index.ts), so a deploy is safe either way.

ALTER TABLE tree_markers ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'map';

CREATE TABLE IF NOT EXISTS job_site_maps (
  business_id VARCHAR,
  job_id VARCHAR PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE job_site_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_site_maps;
CREATE POLICY tenant_isolation ON job_site_maps
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_site_maps TO app_tenant;
