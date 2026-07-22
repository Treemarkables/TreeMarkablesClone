-- Clock-in GPS stamp for live crew tracking ("who's at which job").
-- Captured once from the device that taps Start on the job timer;
-- clock_in_distance_km is precomputed against the geocoded job address.
-- All nullable — clock-in works without location.
-- New columns on active_timers inherit its existing tenant_isolation RLS policy.
--
-- Run as ONE block on the Neon prod branch (SQL editor) BEFORE merging the
-- code: timer reads use bare select() (all columns) and would 500 against an
-- un-migrated schema. Idempotent — the same DDL also auto-applies at boot
-- (server/index.ts).

ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS clock_in_lat REAL;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS clock_in_lng REAL;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS clock_in_accuracy_m REAL;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS clock_in_distance_km REAL;
