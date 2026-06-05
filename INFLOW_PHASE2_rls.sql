-- INFLOW PHASE 2 — Row-Level Security (REVIEW ARTIFACT — DO NOT AUTO-RUN)
-- Enables RLS + tenant-isolation policy + grants on all 127 tenant tables.
-- Policy reads the tenant from the per-request JWT via Neon Authorize: auth.session() ->> 'business_id'.
-- PREREQUISITE: Neon Authorize must be configured first (creates the 'authenticated' role).
--
-- SAFE TO RUN EARLY: while the app still connects as neondb_owner (which has BYPASSRLS), these
-- policies are a NO-OP — RLS only bites once queries run as 'authenticated'. So this can land on
-- prod with zero behavioural change, ahead of the app-side query routing.
--
-- NOT forced: neondb_owner keeps full access (login, crons, platform-admin run as owner and must
-- see across tenants). Only the non-bypass 'authenticated' role is filtered. Reversible (bottom).

BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON teams
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO authenticated;

ALTER TABLE customer_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_import_batches
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_import_batches TO authenticated;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_contacts
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_contacts TO authenticated;

ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON communication_preferences
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_preferences TO authenticated;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO authenticated;

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calls
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON calls TO authenticated;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quotes
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON quotes TO authenticated;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jobs
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;

ALTER TABLE job_diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_diary_entries
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_diary_entries TO authenticated;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tasks
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON safety_incidents
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_incidents TO authenticated;

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON risk_assessments
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON risk_assessments TO authenticated;

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proposals
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposals TO authenticated;

ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proposal_sections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_sections TO authenticated;

ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proposal_line_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_line_items TO authenticated;

ALTER TABLE proposal_line_item_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proposal_line_item_choices
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_line_item_choices TO authenticated;

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON photos
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON photos TO authenticated;

ALTER TABLE photo_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON photo_annotations
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_annotations TO authenticated;

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON videos
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activities
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON activities TO authenticated;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reviews
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO authenticated;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaigns
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO authenticated;

ALTER TABLE social_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_plans
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON social_plans TO authenticated;

ALTER TABLE competitor_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON competitor_signals
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON competitor_signals TO authenticated;

ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON price_rules
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON price_rules TO authenticated;

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_requirements
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_requirements TO authenticated;

ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_records
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_records TO authenticated;

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_settings
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON business_settings TO authenticated;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_queue
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_queue TO authenticated;

ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON booking_reminders
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_reminders TO authenticated;

ALTER TABLE role_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_tiers
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON role_tiers TO authenticated;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON schedule_events
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_events TO authenticated;

ALTER TABLE job_staff_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_staff_assignments
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_staff_assignments TO authenticated;

ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_templates TO authenticated;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO authenticated;

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sms_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON sms_templates TO authenticated;

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON equipment
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment TO authenticated;

ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON equipment_maintenance
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_maintenance TO authenticated;

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO authenticated;

ALTER TABLE equipment_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON equipment_checkouts
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_checkouts TO authenticated;

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_transactions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO authenticated;

ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inspection_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_templates TO authenticated;

ALTER TABLE inspection_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inspection_checklist_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_checklist_items TO authenticated;

ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicle_inspections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_inspections TO authenticated;

ALTER TABLE inspection_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inspection_responses
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_responses TO authenticated;

ALTER TABLE induction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON induction_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_templates TO authenticated;

ALTER TABLE induction_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON induction_checklist_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_checklist_items TO authenticated;

ALTER TABLE equipment_inductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON equipment_inductions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_inductions TO authenticated;

ALTER TABLE induction_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON induction_responses
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_responses TO authenticated;

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON communications
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON communications TO authenticated;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_events
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON email_events TO authenticated;

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON communication_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_templates TO authenticated;

ALTER TABLE communication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON communication_rules
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_rules TO authenticated;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversation_messages
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_messages TO authenticated;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO authenticated;

ALTER TABLE invoice_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_sections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_sections TO authenticated;

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_line_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_line_items TO authenticated;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;

ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON xero_connections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON xero_connections TO authenticated;

ALTER TABLE xero_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON xero_settings
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON xero_settings TO authenticated;

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON service_requests
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON service_requests TO authenticated;

ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_auth
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_auth TO authenticated;

ALTER TABLE business_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_reports
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON business_reports TO authenticated;

ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kpi_metrics
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_metrics TO authenticated;

ALTER TABLE performance_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON performance_analytics
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_analytics TO authenticated;

ALTER TABLE financial_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON financial_analytics
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON financial_analytics TO authenticated;

ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dashboard_configs
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_configs TO authenticated;

ALTER TABLE report_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON report_analytics
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON report_analytics TO authenticated;

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON document_templates TO authenticated;

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON template_sections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_sections TO authenticated;

ALTER TABLE template_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON template_line_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_line_items TO authenticated;

ALTER TABLE template_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON template_photos
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_photos TO authenticated;

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON generated_documents
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_documents TO authenticated;

ALTER TABLE generated_document_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON generated_document_line_items
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_document_line_items TO authenticated;

ALTER TABLE generated_document_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON generated_document_photos
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_document_photos TO authenticated;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON materials
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON materials TO authenticated;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON services
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON review_requests
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON review_requests TO authenticated;

ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON review_submissions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON review_submissions TO authenticated;

ALTER TABLE jha_hazard_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_hazard_templates
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_hazard_templates TO authenticated;

ALTER TABLE jha_control_measure_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_control_measure_templates
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_control_measure_templates TO authenticated;

ALTER TABLE jha_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_assessments
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_assessments TO authenticated;

ALTER TABLE jha_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_steps
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_steps TO authenticated;

ALTER TABLE jha_step_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_step_controls
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_step_controls TO authenticated;

ALTER TABLE jha_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_signatures
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_signatures TO authenticated;

ALTER TABLE jha_risk_control_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON jha_risk_control_templates
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_risk_control_templates TO authenticated;

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON marketing_campaigns
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO authenticated;

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fcm_tokens
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON fcm_tokens TO authenticated;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_preferences
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO authenticated;

ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON call_records
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON call_records TO authenticated;

ALTER TABLE tree_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tree_markers
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON tree_markers TO authenticated;

ALTER TABLE mulch_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mulch_drops
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON mulch_drops TO authenticated;

ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON daily_briefings
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_briefings TO authenticated;

ALTER TABLE daily_job_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON daily_job_notes
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_job_notes TO authenticated;

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON checklist_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_templates TO authenticated;

ALTER TABLE role_checklist_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_checklist_tasks
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON role_checklist_tasks TO authenticated;

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON assistant_messages
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_messages TO authenticated;

ALTER TABLE pending_outbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pending_outbound_messages
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_outbound_messages TO authenticated;

ALTER TABLE near_miss_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON near_miss_reports
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_reports TO authenticated;

ALTER TABLE near_miss_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON near_miss_attachments
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_attachments TO authenticated;

ALTER TABLE near_miss_witnesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON near_miss_witnesses
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_witnesses TO authenticated;

ALTER TABLE near_miss_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON near_miss_actions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_actions TO authenticated;

ALTER TABLE job_checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_checklist_completions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_checklist_completions TO authenticated;

ALTER TABLE quoting_process_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quoting_process_steps
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON quoting_process_steps TO authenticated;

ALTER TABLE job_quoting_process_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_quoting_process_completions
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_quoting_process_completions TO authenticated;

ALTER TABLE toolbox_talk_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON toolbox_talk_topics
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talk_topics TO authenticated;

ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON toolbox_talks
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talks TO authenticated;

ALTER TABLE toolbox_talk_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON toolbox_talk_attendees
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talk_attendees TO authenticated;

ALTER TABLE prestart_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prestart_checklist_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON prestart_checklist_templates TO authenticated;

ALTER TABLE prestart_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prestart_checklists
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON prestart_checklists TO authenticated;

ALTER TABLE safety_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON safety_assets
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_assets TO authenticated;

ALTER TABLE asset_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset_inspections
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_inspections TO authenticated;

ALTER TABLE competency_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON competency_types
  USING (business_id IS NULL OR business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON competency_types TO authenticated;

ALTER TABLE employee_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_competencies
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_competencies TO authenticated;

ALTER TABLE swms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON swms_templates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_templates TO authenticated;

ALTER TABLE swms_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON swms_documents
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_documents TO authenticated;

ALTER TABLE swms_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON swms_steps
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_steps TO authenticated;

ALTER TABLE swms_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON swms_signatures
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_signatures TO authenticated;

ALTER TABLE notifiable_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifiable_events
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON notifiable_events TO authenticated;

ALTER TABLE daily_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON daily_time_entries
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_time_entries TO authenticated;

ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_time_entries
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_time_entries TO authenticated;

ALTER TABLE staff_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff_rates
  USING (business_id = (auth.session() ->> 'business_id'))
  WITH CHECK (business_id = (auth.session() ->> 'business_id'));
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_rates TO authenticated;

COMMIT;

-- ROLLBACK (fully reverses):
-- BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON teams;  ALTER TABLE teams DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON teams FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_import_batches;  ALTER TABLE customer_import_batches DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_import_batches FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON customers;  ALTER TABLE customers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customers FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_contacts;  ALTER TABLE customer_contacts DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_contacts FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_preferences;  ALTER TABLE communication_preferences DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_preferences FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON leads;  ALTER TABLE leads DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON leads FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON calls;  ALTER TABLE calls DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON calls FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON api_keys;  ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON api_keys FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON quotes;  ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON quotes FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jobs;  ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jobs FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_diary_entries;  ALTER TABLE job_diary_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_diary_entries FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON tasks;  ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON tasks FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON safety_incidents;  ALTER TABLE safety_incidents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON safety_incidents FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON risk_assessments;  ALTER TABLE risk_assessments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON risk_assessments FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON proposals;  ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposals FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_sections;  ALTER TABLE proposal_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_sections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_line_items;  ALTER TABLE proposal_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_line_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_line_item_choices;  ALTER TABLE proposal_line_item_choices DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_line_item_choices FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON photos;  ALTER TABLE photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON photos FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON photo_annotations;  ALTER TABLE photo_annotations DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON photo_annotations FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON videos;  ALTER TABLE videos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON videos FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON activities;  ALTER TABLE activities DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON activities FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON reviews;  ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON reviews FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON campaigns;  ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON campaigns FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON social_plans;  ALTER TABLE social_plans DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON social_plans FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON competitor_signals;  ALTER TABLE competitor_signals DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON competitor_signals FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON price_rules;  ALTER TABLE price_rules DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON price_rules FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON compliance_requirements;  ALTER TABLE compliance_requirements DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON compliance_requirements FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON compliance_records;  ALTER TABLE compliance_records DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON compliance_records FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON business_settings;  ALTER TABLE business_settings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON business_settings FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON notifications;  ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notifications FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON notification_queue;  ALTER TABLE notification_queue DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notification_queue FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON booking_reminders;  ALTER TABLE booking_reminders DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON booking_reminders FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON role_tiers;  ALTER TABLE role_tiers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON role_tiers FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON employees;  ALTER TABLE employees DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON employees FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON schedule_events;  ALTER TABLE schedule_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON schedule_events FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_staff_assignments;  ALTER TABLE job_staff_assignments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_staff_assignments FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_templates;  ALTER TABLE job_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON email_templates;  ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON email_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON sms_templates;  ALTER TABLE sms_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON sms_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment;  ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_maintenance;  ALTER TABLE equipment_maintenance DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_maintenance FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON inventory;  ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inventory FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_checkouts;  ALTER TABLE equipment_checkouts DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_checkouts FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON inventory_transactions;  ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inventory_transactions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_templates;  ALTER TABLE inspection_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_checklist_items;  ALTER TABLE inspection_checklist_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_checklist_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON vehicle_inspections;  ALTER TABLE vehicle_inspections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON vehicle_inspections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_responses;  ALTER TABLE inspection_responses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_responses FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_templates;  ALTER TABLE induction_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_checklist_items;  ALTER TABLE induction_checklist_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_checklist_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_inductions;  ALTER TABLE equipment_inductions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_inductions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_responses;  ALTER TABLE induction_responses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_responses FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON communications;  ALTER TABLE communications DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communications FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON email_events;  ALTER TABLE email_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON email_events FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_templates;  ALTER TABLE communication_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_rules;  ALTER TABLE communication_rules DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_rules FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON conversations;  ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON conversations FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON conversation_messages;  ALTER TABLE conversation_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON conversation_messages FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON invoices;  ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoices FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON invoice_sections;  ALTER TABLE invoice_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoice_sections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;  ALTER TABLE invoice_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoice_line_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON payments;  ALTER TABLE payments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON payments FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON xero_connections;  ALTER TABLE xero_connections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON xero_connections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON xero_settings;  ALTER TABLE xero_settings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON xero_settings FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON service_requests;  ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON service_requests FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_auth;  ALTER TABLE customer_auth DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_auth FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON business_reports;  ALTER TABLE business_reports DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON business_reports FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON kpi_metrics;  ALTER TABLE kpi_metrics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON kpi_metrics FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON performance_analytics;  ALTER TABLE performance_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON performance_analytics FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON financial_analytics;  ALTER TABLE financial_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON financial_analytics FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON dashboard_configs;  ALTER TABLE dashboard_configs DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON dashboard_configs FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON report_analytics;  ALTER TABLE report_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON report_analytics FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON document_templates;  ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON document_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON template_sections;  ALTER TABLE template_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_sections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON template_line_items;  ALTER TABLE template_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_line_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON template_photos;  ALTER TABLE template_photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_photos FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_documents;  ALTER TABLE generated_documents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_documents FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_document_line_items;  ALTER TABLE generated_document_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_document_line_items FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_document_photos;  ALTER TABLE generated_document_photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_document_photos FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON materials;  ALTER TABLE materials DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON materials FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON services;  ALTER TABLE services DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON services FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON review_requests;  ALTER TABLE review_requests DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON review_requests FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON review_submissions;  ALTER TABLE review_submissions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON review_submissions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_hazard_templates;  ALTER TABLE jha_hazard_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_hazard_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_control_measure_templates;  ALTER TABLE jha_control_measure_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_control_measure_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_assessments;  ALTER TABLE jha_assessments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_assessments FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_steps;  ALTER TABLE jha_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_steps FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_step_controls;  ALTER TABLE jha_step_controls DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_step_controls FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_signatures;  ALTER TABLE jha_signatures DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_signatures FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_risk_control_templates;  ALTER TABLE jha_risk_control_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_risk_control_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON marketing_campaigns;  ALTER TABLE marketing_campaigns DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON marketing_campaigns FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON fcm_tokens;  ALTER TABLE fcm_tokens DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON fcm_tokens FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON notification_preferences;  ALTER TABLE notification_preferences DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notification_preferences FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON call_records;  ALTER TABLE call_records DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON call_records FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON tree_markers;  ALTER TABLE tree_markers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON tree_markers FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON mulch_drops;  ALTER TABLE mulch_drops DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON mulch_drops FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_briefings;  ALTER TABLE daily_briefings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_briefings FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_job_notes;  ALTER TABLE daily_job_notes DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_job_notes FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON checklist_templates;  ALTER TABLE checklist_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON checklist_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON role_checklist_tasks;  ALTER TABLE role_checklist_tasks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON role_checklist_tasks FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON assistant_messages;  ALTER TABLE assistant_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON assistant_messages FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON pending_outbound_messages;  ALTER TABLE pending_outbound_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON pending_outbound_messages FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_reports;  ALTER TABLE near_miss_reports DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_reports FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_attachments;  ALTER TABLE near_miss_attachments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_attachments FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_witnesses;  ALTER TABLE near_miss_witnesses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_witnesses FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_actions;  ALTER TABLE near_miss_actions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_actions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_checklist_completions;  ALTER TABLE job_checklist_completions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_checklist_completions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON quoting_process_steps;  ALTER TABLE quoting_process_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON quoting_process_steps FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_quoting_process_completions;  ALTER TABLE job_quoting_process_completions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_quoting_process_completions FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_topics;  ALTER TABLE toolbox_talk_topics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talk_topics FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talks;  ALTER TABLE toolbox_talks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talks FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_attendees;  ALTER TABLE toolbox_talk_attendees DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talk_attendees FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON prestart_checklist_templates;  ALTER TABLE prestart_checklist_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON prestart_checklist_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON prestart_checklists;  ALTER TABLE prestart_checklists DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON prestart_checklists FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON safety_assets;  ALTER TABLE safety_assets DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON safety_assets FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON asset_inspections;  ALTER TABLE asset_inspections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON asset_inspections FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON competency_types;  ALTER TABLE competency_types DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON competency_types FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON employee_competencies;  ALTER TABLE employee_competencies DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON employee_competencies FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_templates;  ALTER TABLE swms_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_templates FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_documents;  ALTER TABLE swms_documents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_documents FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_steps;  ALTER TABLE swms_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_steps FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_signatures;  ALTER TABLE swms_signatures DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_signatures FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON notifiable_events;  ALTER TABLE notifiable_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notifiable_events FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_time_entries;  ALTER TABLE daily_time_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_time_entries FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON job_time_entries;  ALTER TABLE job_time_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_time_entries FROM authenticated;
--   DROP POLICY IF EXISTS tenant_isolation ON staff_rates;  ALTER TABLE staff_rates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON staff_rates FROM authenticated;
-- COMMIT;
