# App Strengthening Plan

**Date:** 2026-07-23. **Trigger:** production-readiness checklist circulating for AI-built apps (input validation, rate limiting, bot protection, N+1 queries, missing indexes, background jobs, migrations, backups). This plan maps that checklist onto our actual codebase state, verified by a three-way audit (abuse protection, database performance, operational readiness) on this date.

**How to use this doc:** each item is either ✅ ALREADY DONE (do not rebuild — parallel sessions have collided before), or an open work item with a priority. Work the priorities top-down; each P1/P2 item is sized to be one PR.

---

## ✅ Already covered — do NOT re-implement

Verified in the audit. Re-fixing these wastes effort and risks regressions.

| Area | State | Evidence |
|---|---|---|
| Tenant isolation | RLS enabled in prod on effectively all tables; two security audits (2026-07-02 → PR #313, 2026-07-14 → PR #432) fully remediated | memory + audit |
| Login protection | bcrypt (cost 10) + dual-key throttle (30/IP + 10/identifier per 15 min, 429) + suspended-business lockout | `server/routes.ts:2220-2256` |
| Bot/spam on public contact form | honeypot + per-IP rate limit + Cloudflare Turnstile (PR #316) | `server/routes.ts:3486-3618` |
| Webhook forgery protection | Twilio / Stripe / Resend-Svix / Meta HMAC signature verification | `server/routes.ts:672-728, 21315, 27189` |
| Payload limits | `express.json` 50 MB cap; every multer route has an explicit `fileSize` ceiling | `server/index.ts:151-157`, `server/routes.ts:124-448` |
| Error monitoring | Sentry on server + client; global error handler; uncaughtException/unhandledRejection handlers; graceful SIGTERM shutdown | `server/instrument.ts`, `server/index.ts:392-428, 557-571` |
| Health monitoring | `/health` endpoint + 15-min synthetic probe of the lead pipeline + Twilio, alerting the owner (PR #221) | `server/services/healthCheck.ts` |
| Env separation | Neon dev branch vs prod; `ALLOW_EMPLOYEE_ID_LOGIN` fail-safe forced off outside development; dev-test-login only registered when `NODE_ENV=development`; `RUN_CRONS` + worker-lease dedup across the 2 instances | `server/index.ts:26-33, 689, 1117`, `server/routes.ts:2112-2125, 2291` |
| Secrets | `.env` gitignored; no server secrets committed; client bundle clean (Firebase config fetched at runtime) | audit |
| Session store | `connect-pg-simple` ships `IDX_session_expire` + pruning — sessions ARE indexed | `server/index.ts:189-190` |

---

## P1 — do these first

### 1. Index the hot tables (top scalability risk) 🔴

~125 of 145 tables in `shared/schema.ts` declare **no index**. RLS filters every query by `business_id`, but the fastest-growing tables have no `business_id` index, and key FKs are unindexed. These queries currently sequential-scan and will degrade sharply as tenant data grows.

Starter set (verified missing in the audit):

```sql
-- run on Neon prod with CONCURRENTLY (no table locks); mirror in shared/schema.ts index() defs
CREATE INDEX CONCURRENTLY IF NOT EXISTS customers_business_id_idx ON customers (business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS photos_business_id_idx ON photos (business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS photos_job_id_idx ON photos (job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_business_id_idx ON conversations (business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_messages_conversation_id_idx ON conversation_messages (conversation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_customer_id_idx ON jobs (customer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_job_id_idx ON invoices (job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_customer_id_idx ON invoices (customer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_business_id_idx ON activities (business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_business_id_idx ON notifications (business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_business_id_idx ON leads (business_id);
```

Before finalizing, confirm the worst offenders on prod with `SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 20;` and add anything hot that's missing. Notes: `jobs`, `quotes`, `invoices` already get `business_id`-prefix coverage from their composite unique constraints — don't duplicate those. Process per house rules: add to `shared/schema.ts`, ship a dated file in `migrations/manual/`, run manually on Neon prod (dev branch first), never `db:push`.

### 2. Self-service password reset (+ email verification decision)

The app has **no forgot-password flow** — reset is admin-only (`POST /api/employees/emergency-password-reset`, `server/routes.ts:18270`). For a multi-tenant SaaS this is both a support burden and the #1 item on the checklist. Build: `password_reset_tokens` table (single-use, hashed token, 1-hour expiry) → `POST /api/auth/forgot-password` (rate-limited, always-200 to avoid account enumeration, sends via existing per-tenant email sender) → `/reset-password/:token` page → consume + bcrypt-hash. Signup **email verification** is a product decision — signup already goes through Stripe checkout which is itself a strong bot filter, so verification is optional; decide separately.

### 3. Backup/restore runbook + tested restore drill

Nothing in the repo documents backup or restore; we implicitly rely on Neon PITR but have never tested it. "Backups actually work" means a restore has been rehearsed. Write `BACKUP_RESTORE_RUNBOOK.md`: confirm Neon PITR retention window on the current plan (and whether it's long enough — consider a nightly `pg_dump` to the GCS bucket as a second copy), then do one timed drill: branch prod at a point-in-time, verify row counts/spot data, record the steps and how long it took. Also covers GCS photo bucket versioning status.

---

## P2 — next wave

### 4. Rate-limit `/api/signup` + widen coverage

Hand-rolled in-memory limiters cover only login, contact, mulch, and address autocomplete. `/api/signup` (`server/routes.ts:2156`) has none — fake-account creation is unthrottled (Stripe checkout softens but doesn't eliminate this). Reuse the existing login-limiter pattern (per-IP, modest window). Known accepted caveat: limits are per-instance and the app runs 2 instances, so effective ceilings are ~2× — fine at current scale; a shared-store limiter (or `express-rate-limit` + PG/redis store) is a future step that needs owner approval for the dependency.

### 5. Bound the unbounded queries

- `getAllCustomers()` — full `SELECT * ORDER BY name`, no limit (`server/storage.ts:1271`; served by `/api/customers` `server/routes.ts:4462`). Add limit/offset + total, same shape as `getAllJobs`.
- `getConversationMessages()` — returns every message in a conversation (`server/storage.ts:5896`). Page newest-first with a cursor.
- `/api/today-overview` calls `getAllJobs({ limit: 100000 })` (`server/routes.ts:19927`) — replace with a date-scoped query.
Client side: the callers use React Query; keep response shapes backward-compatible (see the shared query-key envelope trap — coerce arrays defensively).

### 6. Fix the real N+1s

- JHA list: 3+ awaited count queries **per assessment** (`server/storage.ts:7175`) and one query per hazard template (`server/storage.ts:7029`) → replace with grouped aggregate joins.
- Scheduling conflict check: one query per employee (`server/storage.ts:4793`) → single `IN (...)` query.
- Bulk job delete: per-job cascade of child-table deletes (`server/storage.ts:2125`) → batch deletes.
The primary jobs list already uses single-statement filtered aggregates — leave it alone.

### 7. Public-form loose ends

- Add Turnstile verification to the public mulch order endpoint (`server/routes.ts:3956`) — it has honeypot + rate limit but not the captcha the contact form has, and it's newly public (#461).
- Delete the dead duplicate `POST /api/contact` handler at `server/routes.ts:23967` (shadowed by the real one at `:3491` — Express first-match). Confusing and a trap for future edits.

---

## P3 — structural, do as capacity allows

### 8. CI pipeline (currently zero)

No `.github/workflows/`. Strong manual harnesses exist (`scripts/signupSmokeTest.mts`, `scripts/tenancyIsolationTest.mts`, `scripts/schemaDriftCheck.mjs`) but nothing runs automatically. Phase A (no secrets needed): GitHub Actions on PR running `vite build` + esbuild server bundle (the real ship gate — full `tsc` OOMs and has ~1000 pre-existing errors, don't gate on it). Phase B: nightly job with a Neon dev-branch secret running the isolation + signup harnesses and drift check.

### 9. Migration discipline

Schema changes currently flow through four parallel mechanisms (boot-time idempotent ALTERs in `server/schemaMigrations.ts` + inline ALTERs in `server/index.ts:691+`, `migrations/manual/*.sql`, drizzle push, and hand-run Neon SQL) — this is exactly the "AI making direct changes to your production schema" failure mode the checklist warns about, and it already bit us once (`business_settings.industry` drift incident). Pragmatic target, not a big-bang rewrite: (a) every schema change ships as a dated file in `migrations/manual/` even when also boot-migrated, (b) extend `scripts/schemaDriftCheck.mjs` to also diff **indexes and RLS policies** (currently columns only — and indexes/policies are precisely what lives outside the tracked layer), (c) run the drift check after every schema.ts merge (wire into CI Phase B).

### 10. Move heavy work out of the request path

Background worker infra exists (DB-polling `setInterval` workers with lease-based dedup) but AI/vision calls (`server/routes.ts:610, 4195, 8289`), Whisper transcription (`:8724`), PDFKit generation, sharp image processing (`server/photoStorage.ts`), and inline email/SMS sends all block requests for seconds. Where the UX is fire-and-forget (email sends, thumbnail generation, transcription), enqueue onto the existing `notification_queue`-style pattern instead. Where the user is actively waiting (speech-to-quote), inline is correct — leave it. Do this opportunistically per endpoint, not as a rewrite.

### 11. Validation sweep for raw-body routes

~⅓ of the 311 POST/PUT routes still trust `req.body` without a zod/drizzle-zod schema (all known public endpoints ARE validated; the gap is authenticated routes, e.g. `convert-to-quote` `server/routes.ts:10646`, `lanes/reorder` `:17674`). Chip away: any PR touching a handler adds the missing `safeParse`; optionally a one-off sweep of the top ~20 highest-traffic write routes.

### 12. Secrets/housekeeping

- Restrict the committed Firebase iOS client API key (`ios/App/App/GoogleService-Info.plist`) in the Firebase console (app/bundle-ID restrictions). Client keys are normal to ship, but restriction is free hardening.
- Delete `scripts/dump-replit-secrets.sh` in Phase 5 cleanup as already planned.

---

## Explicitly deferred / rejected

- **express-rate-limit or a queue library (BullMQ/pg-boss):** needs owner approval per dependency rules; current hand-rolled + DB-polling patterns are adequate at present scale.
- **Signup email verification:** optional — Stripe checkout already gates signup; revisit if free-tier signup ever ships.
- **Full drizzle-kit migrate pipeline conversion:** high-risk big-bang; the incremental discipline in item 9 gets most of the value.
- **tsc as a CI gate:** ~1000 pre-existing errors and OOMs; the app ships via Vite/esbuild.
