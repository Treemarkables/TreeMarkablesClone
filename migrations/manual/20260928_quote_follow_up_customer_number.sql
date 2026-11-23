-- Follow-up drafts store the number the customer sees, not PROP-<timestamp>.
-- Applied on boot by server/schemaMigrations.ts ("quote-follow-up-customer-number").
-- Idempotent. Adds a column only. The rewrite of untouched pending drafts runs
-- in that migration's post-check, because it has to match the generated SMS
-- and email templates. Sent, sending, dismissed, and user-edited drafts are
-- not updated. Re-running is a no-op.

ALTER TABLE quote_follow_ups ADD COLUMN IF NOT EXISTS draft_edited_at timestamp;
