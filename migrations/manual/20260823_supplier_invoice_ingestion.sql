-- Supplier-invoice ingestion (Phase 1). Mirror of the boot migration
-- "supplier-invoice-ingestion" in server/schemaMigrations.ts — the app applies
-- this automatically at startup; this file is the record for schema-drift
-- checks and for running by hand if a deploy is ever rolled back.
ALTER TABLE supplier_invoices ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS inbound_document_id varchar;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS supplier_connection_id varchar;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'invoice';
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS customer_account_ref text;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS po_or_job_reference text;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS arithmetic_valid boolean;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS confidence numeric(3,2);
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS validation_issues jsonb DEFAULT '[]'::jsonb;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS dedupe_hash text;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS assigned_by_user_id varchar;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS assigned_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_dedupe_uidx
  ON supplier_invoices (business_id, dedupe_hash)
  WHERE dedupe_hash IS NOT NULL AND status <> 'rejected';
CREATE INDEX IF NOT EXISTS supplier_invoices_business_status_idx
  ON supplier_invoices (business_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_connections (
  business_id varchar NOT NULL,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  inbound_token text NOT NULL UNIQUE,
  inbound_address text NOT NULL UNIQUE,
  allowed_sender_domains text[] NOT NULL DEFAULT '{}'::text[],
  pending_sender_domain text,
  status text NOT NULL DEFAULT 'pending_first_email',
  extraction_hint text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now());
CREATE INDEX IF NOT EXISTS supplier_connections_business_idx ON supplier_connections (business_id);

CREATE TABLE IF NOT EXISTS inbound_documents (
  business_id varchar NOT NULL,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_connection_id varchar,
  resend_email_id text NOT NULL UNIQUE,
  from_address text,
  to_address text,
  subject text,
  spf_pass boolean,
  dkim_pass boolean,
  attachment_refs jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'received',
  failure_reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now());
CREATE INDEX IF NOT EXISTS inbound_documents_business_idx ON inbound_documents (business_id);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  business_id varchar NOT NULL,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id varchar NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  description text NOT NULL DEFAULT '',
  sku text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit text,
  unit_cost_ex_gst numeric(12,4) NOT NULL DEFAULT 0,
  line_total_ex_gst numeric(12,2) NOT NULL DEFAULT 0,
  gst_rate numeric(4,3) NOT NULL DEFAULT 0.150,
  created_at timestamp DEFAULT now());
CREATE INDEX IF NOT EXISTS supplier_invoice_lines_invoice_idx ON supplier_invoice_lines (supplier_invoice_id);

CREATE TABLE IF NOT EXISTS invoice_job_allocations (
  business_id varchar NOT NULL,
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_line_id varchar NOT NULL REFERENCES supplier_invoice_lines(id) ON DELETE CASCADE,
  job_id varchar NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_phase_id varchar,
  allocated_amount_ex_gst numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now());
CREATE INDEX IF NOT EXISTS invoice_job_allocations_line_idx ON invoice_job_allocations (supplier_invoice_line_id);
CREATE INDEX IF NOT EXISTS invoice_job_allocations_job_idx ON invoice_job_allocations (job_id);

-- RLS (idempotent-ish; CREATE POLICY has no IF NOT EXISTS — skip if it errors with "already exists")
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_connections','inbound_documents','supplier_invoice_lines','invoice_job_allocations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = t::regclass) THEN
      EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
        USING (business_id = nullif(current_setting('app.current_business', true), ''))
        WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''))$f$, t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant', t);
    END IF;
  END LOOP;
END $$;
