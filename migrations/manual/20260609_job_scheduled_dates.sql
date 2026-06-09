-- Multi-day diary scheduling: explicit per-day set for a job.
-- Lets a multi-day booking skip days inside its span (e.g. Wed–Mon excluding the
-- weekend). When NULL/empty, consumers fall back to the contiguous
-- scheduled_date..scheduled_end_date span, so existing jobs are unaffected.
--
-- Additive + backward compatible: safe to run BEFORE the code deploys. It MUST be
-- run before the new code deploys, though — Drizzle selects columns explicitly, so
-- job reads error until this column exists.
--
-- Apply to BOTH the prod Neon branch (via DO App Platform Console) AND the dev
-- Neon branch (local DATABASE_URL) — local job reads break otherwise.
-- Do NOT run drizzle-kit push from local — local DATABASE_URL is the dev branch.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "scheduled_dates" jsonb;
