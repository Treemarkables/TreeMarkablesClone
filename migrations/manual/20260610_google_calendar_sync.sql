-- Two-way Google Calendar sync (unified calendar Phase C).
-- Per-user OAuth connections, push-side job<->event links, and a pull-side
-- cache of external events rendered as busy time on the calendar.
--
-- Additive: safe to run BEFORE the code deploys, and MUST be run before it —
-- Drizzle selects columns explicitly, so reads error until these tables exist.
--
-- Apply to BOTH the prod Neon branch (via DO App Platform Console) AND the dev
-- Neon branch (local DATABASE_URL). Do NOT run drizzle-kit push from local.
-- After applying, verify with: node scripts/schemaDriftCheck.mjs --sql

-- Per business+user OAuth connection (mirrors xero_connections shape)
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
  "business_id" varchar,
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,                -- employees.id of the connecting user
  "google_email" text,
  "calendar_id" text NOT NULL DEFAULT 'primary',
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "scope" text,
  "sync_token" text,                         -- incremental events.list cursor (pull side)
  "is_active" boolean DEFAULT true,
  "last_synced_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "gcal_conn_business_user_unique" UNIQUE ("business_id", "user_id")
);

-- Push-side state: one Google event per (job, connection, NZ day).
-- Multi-day jobs sync as one event per scheduled day so weekend carve-outs
-- stay accurate.
CREATE TABLE IF NOT EXISTS "google_event_links" (
  "business_id" varchar,
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" varchar NOT NULL,
  "connection_id" varchar NOT NULL,
  "nz_date" text NOT NULL,                   -- YYYY-MM-DD the event covers
  "google_event_id" text NOT NULL,
  "last_pushed_hash" text,                   -- skip no-op pushes
  "sync_status" text NOT NULL DEFAULT 'synced',  -- synced | error
  "last_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "gcal_link_job_conn_day_unique" UNIQUE ("job_id", "connection_id", "nz_date")
);
CREATE INDEX IF NOT EXISTS "gcal_links_job_idx" ON "google_event_links" ("job_id");
CREATE INDEX IF NOT EXISTS "gcal_links_conn_idx" ON "google_event_links" ("connection_id");

-- Pull-side cache: external (non-Inflow) Google events as UTC busy intervals
CREATE TABLE IF NOT EXISTS "google_busy_events" (
  "business_id" varchar,
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" varchar NOT NULL,
  "google_event_id" text NOT NULL,
  "summary" text,
  "start_time" timestamp NOT NULL,           -- UTC
  "end_time" timestamp NOT NULL,             -- UTC
  "status" text DEFAULT 'confirmed',
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "gcal_busy_conn_event_unique" UNIQUE ("connection_id", "google_event_id")
);
CREATE INDEX IF NOT EXISTS "gcal_busy_time_idx" ON "google_busy_events" ("business_id", "start_time", "end_time");

-- RLS — mirror the existing tenant policy shape (INFLOW_RLS_RUNBOOK.md).
-- Confirm the policy expression matches an existing table in the Neon SQL
-- editor before applying if the runbook has moved on.
ALTER TABLE "google_calendar_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_event_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_busy_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON "google_calendar_connections" USING (business_id = (auth.session() ->> 'business_id'));
CREATE POLICY tenant_iso ON "google_event_links"          USING (business_id = (auth.session() ->> 'business_id'));
CREATE POLICY tenant_iso ON "google_busy_events"          USING (business_id = (auth.session() ->> 'business_id'));
