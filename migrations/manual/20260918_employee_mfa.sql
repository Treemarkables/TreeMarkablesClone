-- Wave 2 MFA: optional TOTP per employee + org enforce-later column.
-- Secrets are AES-GCM ciphertext (never plaintext). Recovery codes are HMAC
-- hashes. mfa_enforcement defaults to 'optional' so field login is unchanged
-- for anyone who has not enrolled. Mirrored by the boot migration
-- "employee-mfa" in server/schemaMigrations.ts. Run as ONE block.

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS mfa_enforcement text NOT NULL DEFAULT 'optional';

CREATE TABLE IF NOT EXISTS employee_mfa (
  employee_id varchar PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  business_id varchar,
  totp_secret_ciphertext text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  enrolled_at timestamp,
  last_verified_at timestamp,
  last_used_counter integer,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS employee_mfa_business_idx ON employee_mfa (business_id);

CREATE TABLE IF NOT EXISTS employee_mfa_recovery_codes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL REFERENCES employee_mfa(employee_id) ON DELETE CASCADE,
  business_id varchar,
  code_hash text NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS employee_mfa_recovery_employee_idx ON employee_mfa_recovery_codes (employee_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employee_mfa', 'employee_mfa_recovery_codes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = t::regclass
    ) THEN
      EXECUTE format('CREATE POLICY tenant_isolation ON %I
                 USING (business_id = nullif(current_setting(''app.current_business'', true), ''''))
                 WITH CHECK (business_id = nullif(current_setting(''app.current_business'', true), ''''))', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant', t);
    END IF;
  END LOOP;
END $$;
