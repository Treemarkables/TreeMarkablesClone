-- Heal job_site_maps rows inserted with business_id NULL.
--
-- The site-photo upload route runs behind multer, and busboy's stream callbacks
-- execute in the socket's async context rather than the request's — so the ALS
-- tenant context was gone by the time the row was inserted: withTenant() stamped
-- nothing, the owner connection accepted the NULL, and the row was invisible to
-- every tenant-scoped (RLS) read. Uploads returned 200 but the photo never
-- appeared. The route now stamps business_id explicitly from the job row and
-- upserts ON CONFLICT, so new uploads are correct AND overwrite these orphans;
-- this backfill makes the photos uploaded before the fix visible immediately.
--
-- Idempotent. Run on Dev then Prod (Neon SQL editor); also applied idempotently
-- at boot (server/index.ts), so a deploy is safe either way.

UPDATE job_site_maps jsm SET business_id = j.business_id
  FROM jobs j WHERE jsm.job_id = j.id AND jsm.business_id IS NULL;
