-- Restamp email_events rows to the tenant that actually sent the email.
--
-- /api/webhooks/resend-events is session-less, so createEmailEvent() ran with
-- no ambient tenant and the legacy business_id column DEFAULT stamped every
-- open/click/delivered/bounce event as Treemarkables — regardless of which
-- tenant sent the email. Under RLS, other tenants' email-activity reads
-- (GET /api/email-activity/:messageId → the green "Seen" tick in job diaries)
-- therefore always came back empty. The webhook now resolves the tenant from
-- the job-diary entry whose metadata.sendgridMessageId matches the event's
-- email_id; this backfill applies the same resolution to rows written before
-- the fix.
--
-- Rows with no matching diary entry are left untouched (no tenant signal —
-- same as the webhook's runtime fallback). Idempotent: re-running matches
-- nothing once business_id values agree.
--
-- MANUAL: run in the Neon SQL editor (Dev branch first, then Prod). Not
-- applied at boot.

UPDATE email_events e
SET business_id = d.business_id
FROM job_diary_entries d
WHERE d.metadata ->> 'sendgridMessageId' = e.message_id
  AND d.business_id IS NOT NULL
  AND e.business_id IS DISTINCT FROM d.business_id;
