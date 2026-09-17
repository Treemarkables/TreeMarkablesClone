-- Shared rate-limit counters for login throttle + public mutating routes.
-- Global (not tenant-scoped) — same class as `session`. Both App Platform
-- instances share this table so in-memory per-instance ceilings cannot be
-- doubled. Mirrored by the boot migration "rate-limits-table" in
-- server/schemaMigrations.ts. Run as ONE block if applying by hand.

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx ON rate_limits (reset_at);
