-- =============================================================================
-- Scheduled-status retirement migration
--
-- Context: the 'scheduled' job status was retired in 2026-05. Going forward
-- scheduling is a calendar concept (scheduledDate set or not), never a
-- status value. Bookings no longer auto-transition status.
--
-- This migration flips every existing 'scheduled' job to 'work_order'.
-- 'work_order' jobs with a scheduledDate keep their date; they just live
-- under the work_order status now.
--
-- RUN ORDER:
--   1. Dev Neon branch first. After the app deploy you've verified locally,
--      run on prod via the DO Console.
--   2. The Zod enum in shared/schema.ts no longer accepts 'scheduled', so
--      any row left at status='scheduled' after the app deploy will fail
--      to deserialize. Run the migration BEFORE merging to main, or
--      simultaneously, to avoid that window.
--
-- ROLLBACK NOTE:
--   The reverse migration is included at the bottom but ONLY works while
--   the Zod enum still has 'scheduled'. If you've already deployed the
--   code change, the rollback requires reverting the code first.
-- =============================================================================

-- Preview (run first to see how many rows you're about to touch):
SELECT status, COUNT(*) AS jobs
FROM jobs
GROUP BY status
ORDER BY jobs DESC;

-- Preview the rows that will be migrated:
SELECT id, job_number, status, scheduled_date, customer_id
FROM jobs
WHERE status = 'scheduled'
ORDER BY scheduled_date DESC NULLS LAST
LIMIT 50;

-- The migration. Wrap in a transaction so you can ROLLBACK if the count
-- looks wrong before you COMMIT.
BEGIN;

UPDATE jobs
SET status = 'work_order',
    updated_at = NOW()
WHERE status = 'scheduled';

-- Sanity check inside the transaction:
SELECT COUNT(*) AS still_scheduled FROM jobs WHERE status = 'scheduled';
-- ^ Should return 0 before you COMMIT.

COMMIT;
-- (or ROLLBACK; if the numbers don't look right)


-- =============================================================================
-- ROLLBACK (only valid while shared/schema.ts still has 'scheduled' in the
-- Zod enum — i.e. before the code change is deployed, or after reverting it):
-- =============================================================================
--
-- Can't be done cleanly because we lose the distinction between
-- "originally work_order" and "originally scheduled" after the UPDATE.
-- If you must roll back: every work_order with a scheduledDate IS NOT NULL
-- and an assignedTeam was probably scheduled before. Best-effort rollback:
--
-- UPDATE jobs
-- SET status = 'scheduled',
--     updated_at = NOW()
-- WHERE status = 'work_order'
--   AND scheduled_date IS NOT NULL
--   AND assigned_team IS NOT NULL
--   AND array_length(assigned_team, 1) > 0;
--
-- This may misclassify a small number of work_orders that were always
-- work_orders (just happened to have a date set). Accept the rollback is
-- lossy.
