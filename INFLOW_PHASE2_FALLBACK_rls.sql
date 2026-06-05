-- INFLOW PHASE 2 (FALLBACK) — RLS via app_tenant role + GUC (REVIEW ARTIFACT — DO NOT AUTO-RUN)
-- No Neon Authorize / JWKS. Tenant isolation via a non-bypass role + a per-request GUC set
-- on a pooled connection (app does SET ROLE app_tenant + set_config('app.current_business', ...)).
-- Policy reads current_setting('app.current_business'); empty/unset -> no rows (fail-closed).
-- SAFE TO RUN EARLY: a no-op while the app connects as neondb_owner (BYPASSRLS) with the flag off.
-- Idempotent: drops/recreates the tenant_isolation policy, so it also supersedes any prior
-- auth.session()-based policies left from the Neon-Authorize attempt. Reversible (bottom).

BEGIN;

-- non-bypass application role + least-privilege access
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN CREATE ROLE app_tenant NOLOGIN; END IF; END $$;
GRANT app_tenant TO neondb_owner;                 -- lets the app SET ROLE app_tenant
GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON teams;
CREATE POLICY tenant_isolation ON teams
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO app_tenant;

ALTER TABLE customer_import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_import_batches;
CREATE POLICY tenant_isolation ON customer_import_batches
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_import_batches TO app_tenant;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customers;
CREATE POLICY tenant_isolation ON customers
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO app_tenant;

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_contacts;
CREATE POLICY tenant_isolation ON customer_contacts
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_contacts TO app_tenant;

ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communication_preferences;
CREATE POLICY tenant_isolation ON communication_preferences
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_preferences TO app_tenant;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON leads;
CREATE POLICY tenant_isolation ON leads
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO app_tenant;

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON calls;
CREATE POLICY tenant_isolation ON calls
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON calls TO app_tenant;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON api_keys;
CREATE POLICY tenant_isolation ON api_keys
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO app_tenant;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON quotes;
CREATE POLICY tenant_isolation ON quotes
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON quotes TO app_tenant;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO app_tenant;

ALTER TABLE job_diary_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_diary_entries;
CREATE POLICY tenant_isolation ON job_diary_entries
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_diary_entries TO app_tenant;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tasks;
CREATE POLICY tenant_isolation ON tasks
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO app_tenant;

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON safety_incidents;
CREATE POLICY tenant_isolation ON safety_incidents
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_incidents TO app_tenant;

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON risk_assessments;
CREATE POLICY tenant_isolation ON risk_assessments
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON risk_assessments TO app_tenant;

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON proposals;
CREATE POLICY tenant_isolation ON proposals
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposals TO app_tenant;

ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON proposal_sections;
CREATE POLICY tenant_isolation ON proposal_sections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_sections TO app_tenant;

ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON proposal_line_items;
CREATE POLICY tenant_isolation ON proposal_line_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_line_items TO app_tenant;

ALTER TABLE proposal_line_item_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON proposal_line_item_choices;
CREATE POLICY tenant_isolation ON proposal_line_item_choices
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_line_item_choices TO app_tenant;

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON photos;
CREATE POLICY tenant_isolation ON photos
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON photos TO app_tenant;

ALTER TABLE photo_annotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON photo_annotations;
CREATE POLICY tenant_isolation ON photo_annotations
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_annotations TO app_tenant;

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON videos;
CREATE POLICY tenant_isolation ON videos
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO app_tenant;

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON activities;
CREATE POLICY tenant_isolation ON activities
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON activities TO app_tenant;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON reviews;
CREATE POLICY tenant_isolation ON reviews
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO app_tenant;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaigns;
CREATE POLICY tenant_isolation ON campaigns
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO app_tenant;

ALTER TABLE social_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON social_plans;
CREATE POLICY tenant_isolation ON social_plans
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON social_plans TO app_tenant;

ALTER TABLE competitor_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON competitor_signals;
CREATE POLICY tenant_isolation ON competitor_signals
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON competitor_signals TO app_tenant;

ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON price_rules;
CREATE POLICY tenant_isolation ON price_rules
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON price_rules TO app_tenant;

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON compliance_requirements;
CREATE POLICY tenant_isolation ON compliance_requirements
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_requirements TO app_tenant;

ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON compliance_records;
CREATE POLICY tenant_isolation ON compliance_records
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_records TO app_tenant;

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON business_settings;
CREATE POLICY tenant_isolation ON business_settings
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON business_settings TO app_tenant;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO app_tenant;

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_queue;
CREATE POLICY tenant_isolation ON notification_queue
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_queue TO app_tenant;

ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON booking_reminders;
CREATE POLICY tenant_isolation ON booking_reminders
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_reminders TO app_tenant;

ALTER TABLE role_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_tiers;
CREATE POLICY tenant_isolation ON role_tiers
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON role_tiers TO app_tenant;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON employees;
CREATE POLICY tenant_isolation ON employees
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO app_tenant;

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON schedule_events;
CREATE POLICY tenant_isolation ON schedule_events
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_events TO app_tenant;

ALTER TABLE job_staff_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_staff_assignments;
CREATE POLICY tenant_isolation ON job_staff_assignments
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_staff_assignments TO app_tenant;

ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_templates;
CREATE POLICY tenant_isolation ON job_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_templates TO app_tenant;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON email_templates;
CREATE POLICY tenant_isolation ON email_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO app_tenant;

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sms_templates;
CREATE POLICY tenant_isolation ON sms_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON sms_templates TO app_tenant;

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON equipment;
CREATE POLICY tenant_isolation ON equipment
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment TO app_tenant;

ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON equipment_maintenance;
CREATE POLICY tenant_isolation ON equipment_maintenance
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_maintenance TO app_tenant;

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inventory;
CREATE POLICY tenant_isolation ON inventory
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO app_tenant;

ALTER TABLE equipment_checkouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON equipment_checkouts;
CREATE POLICY tenant_isolation ON equipment_checkouts
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_checkouts TO app_tenant;

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inventory_transactions;
CREATE POLICY tenant_isolation ON inventory_transactions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO app_tenant;

ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inspection_templates;
CREATE POLICY tenant_isolation ON inspection_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_templates TO app_tenant;

ALTER TABLE inspection_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inspection_checklist_items;
CREATE POLICY tenant_isolation ON inspection_checklist_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_checklist_items TO app_tenant;

ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON vehicle_inspections;
CREATE POLICY tenant_isolation ON vehicle_inspections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_inspections TO app_tenant;

ALTER TABLE inspection_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inspection_responses;
CREATE POLICY tenant_isolation ON inspection_responses
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_responses TO app_tenant;

ALTER TABLE induction_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON induction_templates;
CREATE POLICY tenant_isolation ON induction_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_templates TO app_tenant;

ALTER TABLE induction_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON induction_checklist_items;
CREATE POLICY tenant_isolation ON induction_checklist_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_checklist_items TO app_tenant;

ALTER TABLE equipment_inductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON equipment_inductions;
CREATE POLICY tenant_isolation ON equipment_inductions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_inductions TO app_tenant;

ALTER TABLE induction_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON induction_responses;
CREATE POLICY tenant_isolation ON induction_responses
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON induction_responses TO app_tenant;

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communications;
CREATE POLICY tenant_isolation ON communications
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON communications TO app_tenant;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON email_events;
CREATE POLICY tenant_isolation ON email_events
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON email_events TO app_tenant;

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communication_templates;
CREATE POLICY tenant_isolation ON communication_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_templates TO app_tenant;

ALTER TABLE communication_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communication_rules;
CREATE POLICY tenant_isolation ON communication_rules
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON communication_rules TO app_tenant;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON conversations;
CREATE POLICY tenant_isolation ON conversations
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO app_tenant;

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON conversation_messages;
CREATE POLICY tenant_isolation ON conversation_messages
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_messages TO app_tenant;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoices;
CREATE POLICY tenant_isolation ON invoices
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO app_tenant;

ALTER TABLE invoice_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_sections;
CREATE POLICY tenant_isolation ON invoice_sections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_sections TO app_tenant;

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;
CREATE POLICY tenant_isolation ON invoice_line_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_line_items TO app_tenant;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payments;
CREATE POLICY tenant_isolation ON payments
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO app_tenant;

ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON xero_connections;
CREATE POLICY tenant_isolation ON xero_connections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON xero_connections TO app_tenant;

ALTER TABLE xero_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON xero_settings;
CREATE POLICY tenant_isolation ON xero_settings
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON xero_settings TO app_tenant;

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON service_requests;
CREATE POLICY tenant_isolation ON service_requests
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON service_requests TO app_tenant;

ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_auth;
CREATE POLICY tenant_isolation ON customer_auth
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_auth TO app_tenant;

ALTER TABLE business_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON business_reports;
CREATE POLICY tenant_isolation ON business_reports
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON business_reports TO app_tenant;

ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON kpi_metrics;
CREATE POLICY tenant_isolation ON kpi_metrics
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_metrics TO app_tenant;

ALTER TABLE performance_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON performance_analytics;
CREATE POLICY tenant_isolation ON performance_analytics
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_analytics TO app_tenant;

ALTER TABLE financial_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON financial_analytics;
CREATE POLICY tenant_isolation ON financial_analytics
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON financial_analytics TO app_tenant;

ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dashboard_configs;
CREATE POLICY tenant_isolation ON dashboard_configs
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_configs TO app_tenant;

ALTER TABLE report_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON report_analytics;
CREATE POLICY tenant_isolation ON report_analytics
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON report_analytics TO app_tenant;

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON document_templates;
CREATE POLICY tenant_isolation ON document_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON document_templates TO app_tenant;

ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON template_sections;
CREATE POLICY tenant_isolation ON template_sections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_sections TO app_tenant;

ALTER TABLE template_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON template_line_items;
CREATE POLICY tenant_isolation ON template_line_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_line_items TO app_tenant;

ALTER TABLE template_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON template_photos;
CREATE POLICY tenant_isolation ON template_photos
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON template_photos TO app_tenant;

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON generated_documents;
CREATE POLICY tenant_isolation ON generated_documents
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_documents TO app_tenant;

ALTER TABLE generated_document_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON generated_document_line_items;
CREATE POLICY tenant_isolation ON generated_document_line_items
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_document_line_items TO app_tenant;

ALTER TABLE generated_document_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON generated_document_photos;
CREATE POLICY tenant_isolation ON generated_document_photos
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_document_photos TO app_tenant;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON materials;
CREATE POLICY tenant_isolation ON materials
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON materials TO app_tenant;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON services;
CREATE POLICY tenant_isolation ON services
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO app_tenant;

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON review_requests;
CREATE POLICY tenant_isolation ON review_requests
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON review_requests TO app_tenant;

ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON review_submissions;
CREATE POLICY tenant_isolation ON review_submissions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON review_submissions TO app_tenant;

ALTER TABLE jha_hazard_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_hazard_templates;
CREATE POLICY tenant_isolation ON jha_hazard_templates
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_hazard_templates TO app_tenant;

ALTER TABLE jha_control_measure_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_control_measure_templates;
CREATE POLICY tenant_isolation ON jha_control_measure_templates
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_control_measure_templates TO app_tenant;

ALTER TABLE jha_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_assessments;
CREATE POLICY tenant_isolation ON jha_assessments
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_assessments TO app_tenant;

ALTER TABLE jha_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_steps;
CREATE POLICY tenant_isolation ON jha_steps
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_steps TO app_tenant;

ALTER TABLE jha_step_controls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_step_controls;
CREATE POLICY tenant_isolation ON jha_step_controls
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_step_controls TO app_tenant;

ALTER TABLE jha_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_signatures;
CREATE POLICY tenant_isolation ON jha_signatures
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_signatures TO app_tenant;

ALTER TABLE jha_risk_control_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jha_risk_control_templates;
CREATE POLICY tenant_isolation ON jha_risk_control_templates
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON jha_risk_control_templates TO app_tenant;

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON marketing_campaigns;
CREATE POLICY tenant_isolation ON marketing_campaigns
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO app_tenant;

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fcm_tokens;
CREATE POLICY tenant_isolation ON fcm_tokens
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON fcm_tokens TO app_tenant;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_preferences;
CREATE POLICY tenant_isolation ON notification_preferences
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO app_tenant;

ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON call_records;
CREATE POLICY tenant_isolation ON call_records
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON call_records TO app_tenant;

ALTER TABLE tree_markers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tree_markers;
CREATE POLICY tenant_isolation ON tree_markers
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON tree_markers TO app_tenant;

ALTER TABLE mulch_drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mulch_drops;
CREATE POLICY tenant_isolation ON mulch_drops
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON mulch_drops TO app_tenant;

ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_briefings;
CREATE POLICY tenant_isolation ON daily_briefings
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_briefings TO app_tenant;

ALTER TABLE daily_job_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_job_notes;
CREATE POLICY tenant_isolation ON daily_job_notes
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_job_notes TO app_tenant;

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON checklist_templates;
CREATE POLICY tenant_isolation ON checklist_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_templates TO app_tenant;

ALTER TABLE role_checklist_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_checklist_tasks;
CREATE POLICY tenant_isolation ON role_checklist_tasks
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON role_checklist_tasks TO app_tenant;

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON assistant_messages;
CREATE POLICY tenant_isolation ON assistant_messages
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_messages TO app_tenant;

ALTER TABLE pending_outbound_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pending_outbound_messages;
CREATE POLICY tenant_isolation ON pending_outbound_messages
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_outbound_messages TO app_tenant;

ALTER TABLE near_miss_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON near_miss_reports;
CREATE POLICY tenant_isolation ON near_miss_reports
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_reports TO app_tenant;

ALTER TABLE near_miss_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON near_miss_attachments;
CREATE POLICY tenant_isolation ON near_miss_attachments
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_attachments TO app_tenant;

ALTER TABLE near_miss_witnesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON near_miss_witnesses;
CREATE POLICY tenant_isolation ON near_miss_witnesses
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_witnesses TO app_tenant;

ALTER TABLE near_miss_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON near_miss_actions;
CREATE POLICY tenant_isolation ON near_miss_actions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON near_miss_actions TO app_tenant;

ALTER TABLE job_checklist_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_checklist_completions;
CREATE POLICY tenant_isolation ON job_checklist_completions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_checklist_completions TO app_tenant;

ALTER TABLE quoting_process_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON quoting_process_steps;
CREATE POLICY tenant_isolation ON quoting_process_steps
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON quoting_process_steps TO app_tenant;

ALTER TABLE job_quoting_process_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_quoting_process_completions;
CREATE POLICY tenant_isolation ON job_quoting_process_completions
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_quoting_process_completions TO app_tenant;

ALTER TABLE toolbox_talk_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_topics;
CREATE POLICY tenant_isolation ON toolbox_talk_topics
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talk_topics TO app_tenant;

ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON toolbox_talks;
CREATE POLICY tenant_isolation ON toolbox_talks
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talks TO app_tenant;

ALTER TABLE toolbox_talk_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_attendees;
CREATE POLICY tenant_isolation ON toolbox_talk_attendees
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON toolbox_talk_attendees TO app_tenant;

ALTER TABLE prestart_checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON prestart_checklist_templates;
CREATE POLICY tenant_isolation ON prestart_checklist_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON prestart_checklist_templates TO app_tenant;

ALTER TABLE prestart_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON prestart_checklists;
CREATE POLICY tenant_isolation ON prestart_checklists
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON prestart_checklists TO app_tenant;

ALTER TABLE safety_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON safety_assets;
CREATE POLICY tenant_isolation ON safety_assets
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_assets TO app_tenant;

ALTER TABLE asset_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON asset_inspections;
CREATE POLICY tenant_isolation ON asset_inspections
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_inspections TO app_tenant;

ALTER TABLE competency_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON competency_types;
CREATE POLICY tenant_isolation ON competency_types
  USING (business_id IS NULL OR business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON competency_types TO app_tenant;

ALTER TABLE employee_competencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON employee_competencies;
CREATE POLICY tenant_isolation ON employee_competencies
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_competencies TO app_tenant;

ALTER TABLE swms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON swms_templates;
CREATE POLICY tenant_isolation ON swms_templates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_templates TO app_tenant;

ALTER TABLE swms_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON swms_documents;
CREATE POLICY tenant_isolation ON swms_documents
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_documents TO app_tenant;

ALTER TABLE swms_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON swms_steps;
CREATE POLICY tenant_isolation ON swms_steps
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_steps TO app_tenant;

ALTER TABLE swms_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON swms_signatures;
CREATE POLICY tenant_isolation ON swms_signatures
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON swms_signatures TO app_tenant;

ALTER TABLE notifiable_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifiable_events;
CREATE POLICY tenant_isolation ON notifiable_events
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON notifiable_events TO app_tenant;

ALTER TABLE daily_time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_time_entries;
CREATE POLICY tenant_isolation ON daily_time_entries
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_time_entries TO app_tenant;

ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON job_time_entries;
CREATE POLICY tenant_isolation ON job_time_entries
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON job_time_entries TO app_tenant;

ALTER TABLE staff_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON staff_rates;
CREATE POLICY tenant_isolation ON staff_rates
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_rates TO app_tenant;

COMMIT;

-- ROLLBACK (fully reverses):
-- BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON teams;  ALTER TABLE teams DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON teams FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_import_batches;  ALTER TABLE customer_import_batches DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_import_batches FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON customers;  ALTER TABLE customers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customers FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_contacts;  ALTER TABLE customer_contacts DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_contacts FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_preferences;  ALTER TABLE communication_preferences DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_preferences FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON leads;  ALTER TABLE leads DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON leads FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON calls;  ALTER TABLE calls DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON calls FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON api_keys;  ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON api_keys FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON quotes;  ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON quotes FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jobs;  ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jobs FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_diary_entries;  ALTER TABLE job_diary_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_diary_entries FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON tasks;  ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON tasks FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON safety_incidents;  ALTER TABLE safety_incidents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON safety_incidents FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON risk_assessments;  ALTER TABLE risk_assessments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON risk_assessments FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON proposals;  ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposals FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_sections;  ALTER TABLE proposal_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_sections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_line_items;  ALTER TABLE proposal_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_line_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON proposal_line_item_choices;  ALTER TABLE proposal_line_item_choices DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON proposal_line_item_choices FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON photos;  ALTER TABLE photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON photos FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON photo_annotations;  ALTER TABLE photo_annotations DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON photo_annotations FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON videos;  ALTER TABLE videos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON videos FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON activities;  ALTER TABLE activities DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON activities FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON reviews;  ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON reviews FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON campaigns;  ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON campaigns FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON social_plans;  ALTER TABLE social_plans DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON social_plans FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON competitor_signals;  ALTER TABLE competitor_signals DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON competitor_signals FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON price_rules;  ALTER TABLE price_rules DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON price_rules FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON compliance_requirements;  ALTER TABLE compliance_requirements DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON compliance_requirements FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON compliance_records;  ALTER TABLE compliance_records DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON compliance_records FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON business_settings;  ALTER TABLE business_settings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON business_settings FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON notifications;  ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notifications FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON notification_queue;  ALTER TABLE notification_queue DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notification_queue FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON booking_reminders;  ALTER TABLE booking_reminders DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON booking_reminders FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON role_tiers;  ALTER TABLE role_tiers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON role_tiers FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON employees;  ALTER TABLE employees DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON employees FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON schedule_events;  ALTER TABLE schedule_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON schedule_events FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_staff_assignments;  ALTER TABLE job_staff_assignments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_staff_assignments FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_templates;  ALTER TABLE job_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON email_templates;  ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON email_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON sms_templates;  ALTER TABLE sms_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON sms_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment;  ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_maintenance;  ALTER TABLE equipment_maintenance DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_maintenance FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON inventory;  ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inventory FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_checkouts;  ALTER TABLE equipment_checkouts DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_checkouts FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON inventory_transactions;  ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inventory_transactions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_templates;  ALTER TABLE inspection_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_checklist_items;  ALTER TABLE inspection_checklist_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_checklist_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON vehicle_inspections;  ALTER TABLE vehicle_inspections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON vehicle_inspections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON inspection_responses;  ALTER TABLE inspection_responses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON inspection_responses FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_templates;  ALTER TABLE induction_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_checklist_items;  ALTER TABLE induction_checklist_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_checklist_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON equipment_inductions;  ALTER TABLE equipment_inductions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON equipment_inductions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON induction_responses;  ALTER TABLE induction_responses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON induction_responses FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON communications;  ALTER TABLE communications DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communications FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON email_events;  ALTER TABLE email_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON email_events FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_templates;  ALTER TABLE communication_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON communication_rules;  ALTER TABLE communication_rules DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON communication_rules FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON conversations;  ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON conversations FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON conversation_messages;  ALTER TABLE conversation_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON conversation_messages FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON invoices;  ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoices FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON invoice_sections;  ALTER TABLE invoice_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoice_sections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;  ALTER TABLE invoice_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON invoice_line_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON payments;  ALTER TABLE payments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON payments FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON xero_connections;  ALTER TABLE xero_connections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON xero_connections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON xero_settings;  ALTER TABLE xero_settings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON xero_settings FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON service_requests;  ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON service_requests FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON customer_auth;  ALTER TABLE customer_auth DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON customer_auth FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON business_reports;  ALTER TABLE business_reports DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON business_reports FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON kpi_metrics;  ALTER TABLE kpi_metrics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON kpi_metrics FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON performance_analytics;  ALTER TABLE performance_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON performance_analytics FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON financial_analytics;  ALTER TABLE financial_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON financial_analytics FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON dashboard_configs;  ALTER TABLE dashboard_configs DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON dashboard_configs FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON report_analytics;  ALTER TABLE report_analytics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON report_analytics FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON document_templates;  ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON document_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON template_sections;  ALTER TABLE template_sections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_sections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON template_line_items;  ALTER TABLE template_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_line_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON template_photos;  ALTER TABLE template_photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON template_photos FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_documents;  ALTER TABLE generated_documents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_documents FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_document_line_items;  ALTER TABLE generated_document_line_items DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_document_line_items FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON generated_document_photos;  ALTER TABLE generated_document_photos DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON generated_document_photos FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON materials;  ALTER TABLE materials DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON materials FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON services;  ALTER TABLE services DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON services FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON review_requests;  ALTER TABLE review_requests DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON review_requests FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON review_submissions;  ALTER TABLE review_submissions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON review_submissions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_hazard_templates;  ALTER TABLE jha_hazard_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_hazard_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_control_measure_templates;  ALTER TABLE jha_control_measure_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_control_measure_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_assessments;  ALTER TABLE jha_assessments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_assessments FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_steps;  ALTER TABLE jha_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_steps FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_step_controls;  ALTER TABLE jha_step_controls DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_step_controls FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_signatures;  ALTER TABLE jha_signatures DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_signatures FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON jha_risk_control_templates;  ALTER TABLE jha_risk_control_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON jha_risk_control_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON marketing_campaigns;  ALTER TABLE marketing_campaigns DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON marketing_campaigns FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON fcm_tokens;  ALTER TABLE fcm_tokens DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON fcm_tokens FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON notification_preferences;  ALTER TABLE notification_preferences DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notification_preferences FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON call_records;  ALTER TABLE call_records DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON call_records FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON tree_markers;  ALTER TABLE tree_markers DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON tree_markers FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON mulch_drops;  ALTER TABLE mulch_drops DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON mulch_drops FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_briefings;  ALTER TABLE daily_briefings DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_briefings FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_job_notes;  ALTER TABLE daily_job_notes DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_job_notes FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON checklist_templates;  ALTER TABLE checklist_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON checklist_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON role_checklist_tasks;  ALTER TABLE role_checklist_tasks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON role_checklist_tasks FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON assistant_messages;  ALTER TABLE assistant_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON assistant_messages FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON pending_outbound_messages;  ALTER TABLE pending_outbound_messages DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON pending_outbound_messages FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_reports;  ALTER TABLE near_miss_reports DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_reports FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_attachments;  ALTER TABLE near_miss_attachments DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_attachments FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_witnesses;  ALTER TABLE near_miss_witnesses DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_witnesses FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON near_miss_actions;  ALTER TABLE near_miss_actions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON near_miss_actions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_checklist_completions;  ALTER TABLE job_checklist_completions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_checklist_completions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON quoting_process_steps;  ALTER TABLE quoting_process_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON quoting_process_steps FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_quoting_process_completions;  ALTER TABLE job_quoting_process_completions DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_quoting_process_completions FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_topics;  ALTER TABLE toolbox_talk_topics DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talk_topics FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talks;  ALTER TABLE toolbox_talks DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talks FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON toolbox_talk_attendees;  ALTER TABLE toolbox_talk_attendees DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON toolbox_talk_attendees FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON prestart_checklist_templates;  ALTER TABLE prestart_checklist_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON prestart_checklist_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON prestart_checklists;  ALTER TABLE prestart_checklists DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON prestart_checklists FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON safety_assets;  ALTER TABLE safety_assets DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON safety_assets FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON asset_inspections;  ALTER TABLE asset_inspections DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON asset_inspections FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON competency_types;  ALTER TABLE competency_types DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON competency_types FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON employee_competencies;  ALTER TABLE employee_competencies DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON employee_competencies FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_templates;  ALTER TABLE swms_templates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_templates FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_documents;  ALTER TABLE swms_documents DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_documents FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_steps;  ALTER TABLE swms_steps DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_steps FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON swms_signatures;  ALTER TABLE swms_signatures DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON swms_signatures FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON notifiable_events;  ALTER TABLE notifiable_events DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON notifiable_events FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON daily_time_entries;  ALTER TABLE daily_time_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON daily_time_entries FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON job_time_entries;  ALTER TABLE job_time_entries DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON job_time_entries FROM app_tenant;
--   DROP POLICY IF EXISTS tenant_isolation ON staff_rates;  ALTER TABLE staff_rates DISABLE ROW LEVEL SECURITY;  REVOKE ALL ON staff_rates FROM app_tenant;
--   REVOKE app_tenant FROM neondb_owner;  DROP ROLE IF EXISTS app_tenant;
-- COMMIT;
