-- Add notification_preferences.bell_preferences if missing.
-- shared/schema.ts:3776 declares this column, but no checked-in migration
-- creates it, so production may be missing it depending on whether
-- `db:push` was ever run against Neon. Idempotent — safe to re-run.

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "bell_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
