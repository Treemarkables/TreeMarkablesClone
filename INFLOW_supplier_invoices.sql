-- Supplier Invoices — new table + RLS (REVIEW ARTIFACT — run manually via DO Console)
-- Adds the supplier_invoices table for the "add a supplier invoice to a job card"
-- feature, then enables tenant isolation matching the active fallback model
-- (app_tenant role + app.current_business GUC — see INFLOW_PHASE2_FALLBACK_rls.sql,
-- commit c7dae66c). Idempotent. Equivalent to `npm run db:push` for this one table,
-- but written out so it can land on prod without a push.

BEGIN;

CREATE TABLE IF NOT EXISTS supplier_invoices (
  business_id        varchar,
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             varchar NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  supplier_name      text NOT NULL,
  invoice_number     text,
  invoice_date       timestamp,
  due_date           timestamp,
  subtotal           numeric(10,2),
  gst                numeric(10,2),
  total              numeric(10,2) NOT NULL DEFAULT '0',
  currency           text NOT NULL DEFAULT 'NZD',
  cost_category      text NOT NULL DEFAULT 'materials',
  document_url       text,
  thumbnail_url      text,
  original_filename  text,
  mime_type          text,
  file_size          integer,
  line_items         jsonb DEFAULT '[]'::jsonb,
  rebill             boolean NOT NULL DEFAULT false,
  markup_percent     numeric(10,2) DEFAULT '0',
  rebilled_at        timestamp,
  status             text NOT NULL DEFAULT 'confirmed',
  notes              text,
  raw_extraction     jsonb,
  created_by         varchar,
  created_at         timestamp DEFAULT now(),
  updated_at         timestamp DEFAULT now()
);

-- Common lookup: all supplier invoices for a job, newest first.
CREATE INDEX IF NOT EXISTS supplier_invoices_job_id_idx ON supplier_invoices (job_id);

-- RLS — active fallback model (app_tenant role + GUC; fail-closed when unset).
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supplier_invoices;
CREATE POLICY tenant_isolation ON supplier_invoices
  USING (business_id = nullif(current_setting('app.current_business', true), ''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_invoices TO app_tenant;

COMMIT;

-- If/when the Neon-Authorize model is reinstated, swap the policy for:
--   CREATE POLICY tenant_isolation ON supplier_invoices
--     USING (business_id = (auth.session() ->> 'business_id'))
--     WITH CHECK (business_id = (auth.session() ->> 'business_id'));
--   GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_invoices TO authenticated;

-- Rollback:
--   DROP TABLE IF EXISTS supplier_invoices;
