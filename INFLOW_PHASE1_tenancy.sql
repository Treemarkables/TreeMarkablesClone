-- INFLOW PHASE 1 — tenancy migration (REVIEW ARTIFACT — DO NOT AUTO-RUN) — v2 (non-breaking via DEFAULT)
-- 127 tables get business_id (8 nullable seed, 119 NOT NULL).
-- Every business_id column gets DEFAULT = Treemarkables id during the single-tenant period, so the
-- running app keeps inserting with NO code change. Multi-tenant code later supplies it explicitly;
-- drop the default in a follow-up once all writes pass business_id.
-- Excluded: users, help_articles, session. Reversible (rollback at bottom). Dev branch first, then prod via DO Console.

BEGIN;

CREATE TABLE IF NOT EXISTS businesses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE,
  status text NOT NULL DEFAULT 'active', created_at timestamp DEFAULT now()
);

-- add nullable business_id everywhere (additive)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE customer_import_batches ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE communication_preferences ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_diary_entries ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE proposal_line_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE proposal_line_item_choices ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE photo_annotations ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE social_plans ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE competitor_signals ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE booking_reminders ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE role_tiers ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_staff_assignments ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE equipment_checkouts ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE vehicle_inspections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE induction_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE induction_checklist_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE equipment_inductions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE induction_responses ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE communication_rules ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE invoice_sections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE xero_settings ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE customer_auth ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE business_reports ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE performance_analytics ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE financial_analytics ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE dashboard_configs ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE report_analytics ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE template_line_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE template_photos ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE generated_document_line_items ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE generated_document_photos ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE services ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE review_submissions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_hazard_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_control_measure_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_assessments ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_steps ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_step_controls ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_signatures ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE jha_risk_control_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE tree_markers ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE mulch_drops ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE daily_briefings ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE daily_job_notes ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE role_checklist_tasks ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE pending_outbound_messages ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE near_miss_reports ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE near_miss_attachments ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE near_miss_witnesses ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE near_miss_actions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_checklist_completions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE quoting_process_steps ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_quoting_process_completions ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE toolbox_talk_topics ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE toolbox_talk_attendees ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE prestart_checklist_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE prestart_checklists ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE safety_assets ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE asset_inspections ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE competency_types ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE employee_competencies ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE swms_templates ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE swms_documents ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE swms_steps ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE swms_signatures ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE notifiable_events ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE daily_time_entries ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE job_time_entries ADD COLUMN IF NOT EXISTS business_id varchar;
ALTER TABLE staff_rates ADD COLUMN IF NOT EXISTS business_id varchar;

DO $$
DECLARE tm text; t text;
BEGIN
  INSERT INTO businesses (name, slug, status) VALUES ('Treemarkables','treemarkables','active') RETURNING id INTO tm;
  -- backfill all existing rows + set DEFAULT (keeps app inserts working) on every target
  FOREACH t IN ARRAY ARRAY['teams','customer_import_batches','customers','customer_contacts','communication_preferences','leads','calls','api_keys','quotes','jobs','job_diary_entries','tasks','safety_incidents','risk_assessments','proposals','proposal_sections','proposal_line_items','proposal_line_item_choices','photos','photo_annotations','videos','activities','reviews','campaigns','social_plans','competitor_signals','price_rules','compliance_requirements','compliance_records','business_settings','notifications','notification_queue','booking_reminders','role_tiers','employees','schedule_events','job_staff_assignments','job_templates','email_templates','sms_templates','equipment','equipment_maintenance','inventory','equipment_checkouts','inventory_transactions','inspection_templates','inspection_checklist_items','vehicle_inspections','inspection_responses','induction_templates','induction_checklist_items','equipment_inductions','induction_responses','communications','email_events','communication_templates','communication_rules','conversations','conversation_messages','invoices','invoice_sections','invoice_line_items','payments','xero_connections','xero_settings','service_requests','customer_auth','business_reports','kpi_metrics','performance_analytics','financial_analytics','dashboard_configs','report_analytics','document_templates','template_sections','template_line_items','template_photos','generated_documents','generated_document_line_items','generated_document_photos','materials','services','review_requests','review_submissions','jha_hazard_templates','jha_control_measure_templates','jha_assessments','jha_steps','jha_step_controls','jha_signatures','jha_risk_control_templates','marketing_campaigns','fcm_tokens','notification_preferences','call_records','tree_markers','mulch_drops','daily_briefings','daily_job_notes','checklist_templates','role_checklist_tasks','assistant_messages','pending_outbound_messages','near_miss_reports','near_miss_attachments','near_miss_witnesses','near_miss_actions','job_checklist_completions','quoting_process_steps','job_quoting_process_completions','toolbox_talk_topics','toolbox_talks','toolbox_talk_attendees','prestart_checklist_templates','prestart_checklists','safety_assets','asset_inspections','competency_types','employee_competencies','swms_templates','swms_documents','swms_steps','swms_signatures','notifiable_events','daily_time_entries','job_time_entries','staff_rates'] LOOP
    EXECUTE format('UPDATE %I SET business_id = %L WHERE business_id IS NULL', t, tm);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id SET DEFAULT %L', t, tm);
  END LOOP;
  -- enforce NOT NULL on non-seed tables only
  FOREACH t IN ARRAY ARRAY['teams','customer_import_batches','customers','customer_contacts','communication_preferences','leads','calls','api_keys','quotes','jobs','job_diary_entries','tasks','safety_incidents','risk_assessments','proposals','proposal_sections','proposal_line_items','proposal_line_item_choices','photos','photo_annotations','videos','activities','reviews','campaigns','social_plans','competitor_signals','price_rules','compliance_requirements','compliance_records','business_settings','notifications','notification_queue','booking_reminders','role_tiers','employees','schedule_events','job_staff_assignments','job_templates','email_templates','sms_templates','equipment','equipment_maintenance','inventory','equipment_checkouts','inventory_transactions','inspection_templates','inspection_checklist_items','vehicle_inspections','inspection_responses','induction_templates','induction_checklist_items','equipment_inductions','induction_responses','communications','email_events','communication_templates','communication_rules','conversations','conversation_messages','invoices','invoice_sections','invoice_line_items','payments','xero_connections','xero_settings','service_requests','customer_auth','business_reports','kpi_metrics','performance_analytics','financial_analytics','dashboard_configs','report_analytics','document_templates','template_sections','template_line_items','template_photos','generated_documents','generated_document_line_items','generated_document_photos','review_requests','review_submissions','jha_assessments','jha_steps','jha_step_controls','jha_signatures','marketing_campaigns','fcm_tokens','notification_preferences','call_records','tree_markers','mulch_drops','daily_briefings','daily_job_notes','checklist_templates','assistant_messages','pending_outbound_messages','near_miss_reports','near_miss_attachments','near_miss_witnesses','near_miss_actions','job_checklist_completions','quoting_process_steps','job_quoting_process_completions','toolbox_talks','toolbox_talk_attendees','prestart_checklist_templates','prestart_checklists','safety_assets','asset_inspections','employee_competencies','swms_templates','swms_documents','swms_steps','swms_signatures','notifiable_events','daily_time_entries','job_time_entries','staff_rates'] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id SET NOT NULL', t);
  END LOOP;
  -- FK + index on every target (seed stays nullable)
  FOREACH t IN ARRAY ARRAY['teams','customer_import_batches','customers','customer_contacts','communication_preferences','leads','calls','api_keys','quotes','jobs','job_diary_entries','tasks','safety_incidents','risk_assessments','proposals','proposal_sections','proposal_line_items','proposal_line_item_choices','photos','photo_annotations','videos','activities','reviews','campaigns','social_plans','competitor_signals','price_rules','compliance_requirements','compliance_records','business_settings','notifications','notification_queue','booking_reminders','role_tiers','employees','schedule_events','job_staff_assignments','job_templates','email_templates','sms_templates','equipment','equipment_maintenance','inventory','equipment_checkouts','inventory_transactions','inspection_templates','inspection_checklist_items','vehicle_inspections','inspection_responses','induction_templates','induction_checklist_items','equipment_inductions','induction_responses','communications','email_events','communication_templates','communication_rules','conversations','conversation_messages','invoices','invoice_sections','invoice_line_items','payments','xero_connections','xero_settings','service_requests','customer_auth','business_reports','kpi_metrics','performance_analytics','financial_analytics','dashboard_configs','report_analytics','document_templates','template_sections','template_line_items','template_photos','generated_documents','generated_document_line_items','generated_document_photos','materials','services','review_requests','review_submissions','jha_hazard_templates','jha_control_measure_templates','jha_assessments','jha_steps','jha_step_controls','jha_signatures','jha_risk_control_templates','marketing_campaigns','fcm_tokens','notification_preferences','call_records','tree_markers','mulch_drops','daily_briefings','daily_job_notes','checklist_templates','role_checklist_tasks','assistant_messages','pending_outbound_messages','near_miss_reports','near_miss_attachments','near_miss_witnesses','near_miss_actions','job_checklist_completions','quoting_process_steps','job_quoting_process_completions','toolbox_talk_topics','toolbox_talks','toolbox_talk_attendees','prestart_checklist_templates','prestart_checklists','safety_assets','asset_inspections','competency_types','employee_competencies','swms_templates','swms_documents','swms_steps','swms_signatures','notifiable_events','daily_time_entries','job_time_entries','staff_rates'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES businesses(id)', t, t||'_business_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(business_id)', t||'_business_idx', t);
  END LOOP;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK (fully reverses):
-- BEGIN;
-- DO $$ DECLARE t text; BEGIN
--   FOREACH t IN ARRAY ARRAY['teams','customer_import_batches','customers','customer_contacts','communication_preferences','leads','calls','api_keys','quotes','jobs','job_diary_entries','tasks','safety_incidents','risk_assessments','proposals','proposal_sections','proposal_line_items','proposal_line_item_choices','photos','photo_annotations','videos','activities','reviews','campaigns','social_plans','competitor_signals','price_rules','compliance_requirements','compliance_records','business_settings','notifications','notification_queue','booking_reminders','role_tiers','employees','schedule_events','job_staff_assignments','job_templates','email_templates','sms_templates','equipment','equipment_maintenance','inventory','equipment_checkouts','inventory_transactions','inspection_templates','inspection_checklist_items','vehicle_inspections','inspection_responses','induction_templates','induction_checklist_items','equipment_inductions','induction_responses','communications','email_events','communication_templates','communication_rules','conversations','conversation_messages','invoices','invoice_sections','invoice_line_items','payments','xero_connections','xero_settings','service_requests','customer_auth','business_reports','kpi_metrics','performance_analytics','financial_analytics','dashboard_configs','report_analytics','document_templates','template_sections','template_line_items','template_photos','generated_documents','generated_document_line_items','generated_document_photos','materials','services','review_requests','review_submissions','jha_hazard_templates','jha_control_measure_templates','jha_assessments','jha_steps','jha_step_controls','jha_signatures','jha_risk_control_templates','marketing_campaigns','fcm_tokens','notification_preferences','call_records','tree_markers','mulch_drops','daily_briefings','daily_job_notes','checklist_templates','role_checklist_tasks','assistant_messages','pending_outbound_messages','near_miss_reports','near_miss_attachments','near_miss_witnesses','near_miss_actions','job_checklist_completions','quoting_process_steps','job_quoting_process_completions','toolbox_talk_topics','toolbox_talks','toolbox_talk_attendees','prestart_checklist_templates','prestart_checklists','safety_assets','asset_inspections','competency_types','employee_competencies','swms_templates','swms_documents','swms_steps','swms_signatures','notifiable_events','daily_time_entries','job_time_entries','staff_rates'] LOOP
--     EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS business_id CASCADE', t);
--   END LOOP;
-- END $$;
-- DROP TABLE IF EXISTS businesses;
-- COMMIT;
