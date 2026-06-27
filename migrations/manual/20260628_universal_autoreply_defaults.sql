-- Universal inquiry auto-reply defaults (trade-gen sweep).
-- The starter auto-reply templates named "Treemarkables" and "Jules" literally, so a
-- new tenant's auto-reply settings were pre-filled with Treemarkables' identity.
-- Switch the column DEFAULTs to the {businessName} token (fillVars substitutes the
-- tenant's own name at send time) and drop "Jules". Existing rows keep their stored
-- text, so Treemarkables is unchanged. Also applied at boot (server/index.ts).
-- Idempotent.

ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_email_subject SET DEFAULT 'We''ve received your inquiry — {businessName}';

ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_sms_message SET DEFAULT 'Hi {firstName}, thanks for your inquiry with {businessName}. We''ll be in touch within 24 hours to schedule your quote.';

ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_email_message SET DEFAULT 'Hi {customerName},

Thanks for getting in touch with {businessName}. We''ve received your inquiry and we''ll be in touch within 24 hours to schedule your quote.

If it''s urgent, feel free to reply to this email or give us a call.

Thanks,
The {businessName} Team';
