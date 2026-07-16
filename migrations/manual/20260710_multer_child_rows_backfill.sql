-- Heal job-child rows created behind multer with the wrong tenant stamp.
--
-- Every route that parses its body with multer (photo/diary/CSV uploads) runs
-- its handler in busboy's stream-callback async context — the socket's, not the
-- request's — so the AsyncLocalStorage tenant context is GONE inside them:
-- withTenant() stamps nothing and inserts take the business_id column DEFAULT,
-- which on the legacy tables is Treemarkables' business id. For TM that is
-- correct by accident; for any other tenant the row lands stamped as TM —
-- invisible to the uploading tenant under RLS and leaked into TM's dataset.
-- (On tables with no default, e.g. job_site_maps, the same bug produced NULL
-- rows — see 20260710_job_site_maps_backfill_business_id.sql / PR #379.)
--
-- The upload routes now restore the tenant context explicitly from the target
-- job row (fix/multer-tenant-context); these idempotent updates restamp any
-- child row whose business_id disagrees with its parent job's. A job-child row
-- (diary entry, photo, job notification, quoting-process completion) belongs to
-- its job's tenant by definition, so the restamp is always safe.
--
-- As of 2026-07-10 the dev Neon branch has ZERO mismatched rows (only TM
-- generates real data, and TM's uploads hit the TM default), so this heals
-- nothing today — it is insurance for rows created between tenant #2 going
-- live and this fix deploying, and it also repairs NULL-stamped strays.
--
-- Idempotent. Run on Dev then Prod (Neon SQL editor); also applied at boot
-- (server/index.ts), so a deploy is safe either way.

UPDATE job_diary_entries d SET business_id = j.business_id
  FROM jobs j WHERE d.job_id = j.id AND d.business_id IS DISTINCT FROM j.business_id;

UPDATE photos p SET business_id = j.business_id
  FROM jobs j WHERE p.job_id = j.id AND p.business_id IS DISTINCT FROM j.business_id;

UPDATE notifications n SET business_id = j.business_id
  FROM jobs j WHERE n.job_id = j.id AND n.business_id IS DISTINCT FROM j.business_id;

UPDATE job_quoting_process_completions q SET business_id = j.business_id
  FROM jobs j WHERE q.job_id = j.id AND q.business_id IS DISTINCT FROM j.business_id;

-- Round 2 (fix/multer-tenant-context-2): the remaining multer instances
-- (videoUpload / audioUpload / csvUpload / logoUpload / nearMissUpload) shared
-- the same ALS loss. Job-linked videos belong to their job's tenant; knowledge
-- videos are deliberately business_id NULL (global content, job_id NULL) and
-- are untouched by the job_id join. Near-miss attachments belong to their
-- parent report's tenant. CSV-imported customers/jobs and mobile-app call
-- recordings have no parent row to heal from — those routes now stamp at
-- insert, but pre-fix rows are indistinguishable from genuine TM data (today
-- only TM uses those features, so the default stamp was correct by accident).

UPDATE videos v SET business_id = j.business_id
  FROM jobs j WHERE v.job_id = j.id AND v.business_id IS DISTINCT FROM j.business_id;

UPDATE near_miss_attachments a SET business_id = r.business_id
  FROM near_miss_reports r WHERE a.report_id = r.id AND a.business_id IS DISTINCT FROM r.business_id;
