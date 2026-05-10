# Treemarkables — Migration off Replit

Active initiative as of 2026-05-10. Full migration off Replit for **both** dev and production.

This file lives in the repo so it survives the dev-environment switch. When you clone to your Mac and run Claude Code locally, this is the handoff doc — read it first.

---

## End state

- **Dev:** macOS laptop, Claude Code desktop app, local clone of this repo
- **Production:** Digital Ocean App Platform, auto-deploys from `main` on push
- **Database:** stays on Neon (cloud-agnostic, no migration needed). Dev uses a Neon **branch**, prod uses the existing Neon main branch
- **Replit:** decommissioned entirely

## Decisions locked in

| Concern | Decision | Rationale |
|---|---|---|
| Compute target | DO App Platform | Closest to Replit autoscale, no VPS ops |
| Database | Keep Neon | Cloud-agnostic; avoids Drizzle driver swap (`@neondatabase/serverless` → `pg`) |
| Dev DB | Neon dev branch | Realistic data, isolated from prod, free tier |
| Cutover style | Side-by-side via `do.app.treemarkables.co.nz` | Both stacks live + same Neon DB during validation; DNS flip is the cutover |
| Dev OS | macOS | |
| Post-migration branching | Drop the `claude` branch convention | Replit Agent is gone; Claude commits to `main`, DO redeploys on push |
| Timeline | 1-2 weeks ASAP | Aggressive, minimal soak |

## Phased plan

### Phase 0 — Audit (in-repo, read-only)

Produce a punch list of:
1. Every `process.env.*` reference (secrets to recreate on DO + locally)
2. Every filesystem write (uploads/caches that need DO Spaces or equivalent)
3. Every cron / interval / scheduled job (must flip atomically in Phase 3)
4. Every inbound webhook route (must flip in Phase 3)
5. Replit-specific code (launcher.mjs, `.replit`, etc.) to remove in Phase 5

### Phase 1 — DO setup (user does in DO dashboard)

1. Create DO account + project
2. Create App Platform app pointed at the GitHub repo, branch `main`
3. Enter env vars (from Phase 0 list)
4. Create DO Spaces bucket if Phase 0 finds disk writes
5. First deploy → verify boots cleanly

### Phase 1.5 — Local dev bootstrap (parallel with Phase 1)

1. Install Claude Code desktop on the Mac
2. Clone the repo locally, `npm install`
3. Create a Neon dev branch via the Neon dashboard, get its connection string
4. Create local `.env` with dev secrets (NOT prod values; Neon dev branch URL, etc.)
5. `npm run dev` runs locally → verify
6. Verify `git push` from laptop → GitHub → DO redeploys

### Phase 2 — Side-by-side validation

- Add `do.app.treemarkables.co.nz` DNS record → DO
- Both stacks live, both hitting the same prod Neon DB
- Internal team uses the DO subdomain, irons out issues
- **Cron stays on Replit only** during this phase
- **Webhooks stay pointed at Replit** during this phase

### Phase 3 — Move side effects

- Repoint Stripe / Twilio / etc. webhooks at DO
- Disable cron on Replit, enable on DO (these flip together — one stack only at any moment)
- If any files were on Replit's disk (per Phase 0), migrate to DO Spaces

### Phase 4 — Customer cutover

- Lower TTL on `app.treemarkables.co.nz` 24h ahead
- Flip DNS to DO
- Replit kept warm 7 days as rollback

### Phase 5 — Tear down Replit

- Delete the Replit deployment
- Remove `.replit`, `launcher.mjs`, the launcher port-bind dance in `server/index.ts`
- Update `CLAUDE.md`: drop the "Replit Agent / claude branch" workflow rules; update off-limits files list; remove "Restarting the backend workflow" section (now `npm run dev` locally)
- Cancel Replit subscription

### Phase 6 — Optional, likely skip

Neon → DO Managed Postgres. Only worth it if single-vendor billing matters. Requires Drizzle driver swap. Recommend skipping.

---

## Gotchas

- **`launcher.mjs` is a Replit-specific hack.** It exists because Replit's health check window is too tight for Node's 5-7s JIT parse of the bundled server. App Platform's health checks are more forgiving. Delete this in Phase 5.
- **Cron + webhooks must run on exactly one stack at a time** during side-by-side, or you'll get duplicate work / double-charged Stripe events / double-sent SMS.
- **Sessions** use `connect-pg-simple` against Postgres. Since Neon doesn't change, sessions survive the cutover — users won't be logged out.
- **`@neondatabase/serverless`** uses websockets, optimised for serverless edge. On a long-lived DO node it still works but `pg` would be more idiomatic. Don't change this until/unless Phase 6.
- **Customer-facing URLs are hardcoded to `https://app.treemarkables.co.nz`** (per CLAUDE.md). The DNS flip in Phase 4 is what makes those work on DO. Don't temporarily rewrite them to the `do.` subdomain.

---

## Phase 0 audit findings (2026-05-10)

### A. Replit Connectors integrations — real code port required

Three files use Replit's sidecar token broker at `http://127.0.0.1:1106`. That endpoint does not exist on DO. These must be replaced before DO can serve traffic.

1. **`server/photoStorage.ts`** — Replit Object Storage (GCS-backed, credentials via sidecar). Recommended fix: keep `@google-cloud/storage`, swap sidecar credentials block for a real Google service account JSON. Smaller diff than moving to DO Spaces / `@aws-sdk/client-s3`.
2. **`server/services/googleCalendarService.ts`** — Google Calendar OAuth tokens via Replit Connectors. Replace with direct Google OAuth + stored refresh tokens.
3. **`server/services/twilioClient.ts`** — Twilio credentials via Replit Connectors. Easiest fix: skip the connector path entirely; the env vars (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) are already populated.

This is the real engineering work of the migration. Estimate: 1-2 days. Item A1 is highest-leverage; A2 and A3 cascade from it.

### B. Cron — already designed for cutover

`RUN_CRONS=false` flag exists in `server/index.ts:528` (comment explicitly references the Replit↔DO migration soak window). Workers gated by it:

- notification queue (`server/index.ts:328`)
- near-miss review reminder (`server/routes.ts:26984`)
- marketing scheduler (`server/services/marketingScheduler.ts`)
- automated triggers — 3 intervals (`server/services/automatedTriggers.ts`)
- email reply poller (`server/services/emailReplyPoller.ts`)
- SMS reply poller (`server/services/smsReplyPoller.ts`)

**Phase 2:** `RUN_CRONS=false` on DO, true (default) on Replit. **Phase 3:** atomic flip — Replit→false, DO→true.

### C. Inbound webhooks to repoint in Phase 3

| Provider | Endpoint(s) |
|---|---|
| Twilio | `/api/webhooks/sms`, `/twilio-answer`, `/twilio-no-answer`, `/twilio-voice` |
| Vonage | `/api/webhooks/vonage-voice` (GET+POST), `/vonage-event`, `/vonage-recording` |
| Resend | `/api/webhooks/resend-events`, `/api/webhooks/email` (also handles Resend Inbound) |
| SendGrid Inbound Parse | `/api/webhooks/email` |
| Facebook Messenger | `/api/webhooks/messenger` |

No Stripe webhooks — payments don't flow through Stripe.

### D. Disk-write surface

`uploads/` is 1.7MB total (`photos/`, `recordings/`, `logos/`). Most production payloads already go to Replit Object Storage via `PRIVATE_OBJECT_DIR`; local disk is fallback. After A1's GCS swap, the fallbacks land in the new bucket. The 1.7MB of existing local-disk content may need a one-shot copy to the new bucket if any of it is referenced from the DB.

`attached_assets/` is 1.5GB / 1,753 files but is checked into git and bundled at build time via Vite's `@assets` alias — not a runtime concern.

### E. Env vars — 63 distinct references

Replit-only (irrelevant after migration): `REPL_IDENTITY`, `REPLIT_CONNECTORS_HOSTNAME`, `WEB_REPL_RENEWAL`.

New ones needed on DO: Google service account credentials for the GCS swap (A1); Google OAuth client ID/secret for calendar (A2). Everything else is already an env var — just needs to be re-entered in DO App Platform.

Full list (alphabetized): `ADDY_API_KEY`, `ADDY_API_SECRET`, `ALLOW_EMPLOYEE_ID_LOGIN`, `DATABASE_URL`, `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_AD_ACCOUNT_ID`, `FACEBOOK_INBOUND_ENABLED`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_VAPID_KEY`, `GMAIL_APP_PASSWORD`, `GMAIL_USER`, `GOOGLE_MY_BUSINESS_API_KEY`, `GOOGLE_PLACE_ID`, `GOOGLE_PLACES_API_KEY`, `HERO_PHONE_NUMBER`, `HERO_WEBHOOK_SECRET`, `NODE_ENV`, `OPENAI_API_KEY`, `OWNER_PHONE_NUMBER`, `PORT`, `PRIVATE_OBJECT_DIR`, `RECAPTCHA_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_EVENTS_WEBHOOK_SECRET`, `RESEND_WEBHOOK_SECRET`, `RUN_CRONS`, `SESSION_SECRET`, `SMSEVERYONE_PASSWORD`, `SMSEVERYONE_SENDER_ID`, `SMSEVERYONE_USERNAME`, `STATIC_DIR`, `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_KEY_SECRET`, `TWILIO_API_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_CLIENT_IDENTITY`, `TWILIO_PHONE_NUMBER`, `TWILIO_TWIML_APP_SID`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FORWARD_TO_NUMBER`, `VONAGE_NUMBER`, `VONAGE_WEBHOOK_SECRET`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `ZAPIER_WEBHOOK_URL`.

### F. Phase 5 cleanup list

- `launcher.mjs` and the matching port-bind dance in `server/index.ts` (~lines 30-90)
- `.replit`
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-runtime-error-modal` in `package.json` — declared but not imported in `vite.config.ts`. Already dead.
- `RUN_CRONS` flag (no longer load-bearing once Replit is gone; harmless to keep)
- The Replit-Connectors branches in the three files in (A) — once fully replaced, the Replit code paths become dead and can be deleted
- CLAUDE.md: drop the claude-branch workflow, the "Restarting the backend workflow" section, and the off-limits Replit infra files list

### G. Capacitor / iOS — no resubmission needed

`capacitor.config.ts` already points at `https://app.treemarkables.co.nz`. DNS flip in Phase 4 = iOS app continues working without rebuild or App Store resubmission.

### H. Hardcoded `https://app.treemarkables.co.nz`

Per CLAUDE.md convention, ~15 references across client + server. During Phase 2, users on `do.app.treemarkables.co.nz` will see customer-facing links pointing at `app.treemarkables.co.nz` (still on Replit). That's correct — links should always be the canonical customer URL.

---

## Current status

- **Phase 0:** ✅ complete (2026-05-10)
- **Item A1** (`server/photoStorage.ts`): ✅ committed (`e55263f0`). Env-var gated; Replit unchanged
- **Item A2** (`server/services/googleCalendarService.ts`): ✅ committed (`e55263f0`). Env-var gated; Replit unchanged. **OAuth client + refresh token minted (2026-05-11):** values stored in user's secure note as `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`. App published (External, single test user) to avoid 7-day refresh-token expiry.
- **Item A3** (`server/services/twilioClient.ts`): ✅ already implemented before migration started — env-var path was already in place
- **GCS bucket + service-account JSON:** ✅ done (2026-05-10). Bucket `treemarkables-photos` in `australia-southeast1`, uniform access, public access prevention on. Service account JSON downloaded locally; `client_email` granted Storage Object Admin on the bucket. `PRIVATE_OBJECT_DIR` value for DO: `/treemarkables-photos/.private`
- **Replit Secrets extracted:** ✅ done (2026-05-11). All set vars dumped via `scripts/dump-replit-secrets.sh` and stored in user's secure note. Script stays in repo until Phase 5 cleanup.
- **Migration code merged to `main` and pushed to GitHub:** ✅ done (2026-05-11). 5 LFS-tracked files (3 SQL pg_dump backups, 2 Replit-cache zips, ~470 MB) stripped from history via `git filter-branch`. SQL backups archived to user's Google Drive before strip. `.gitattributes` removed. Both `main` and `claude` on GitHub now point at the clean `205e445e` tip.
- **DO App Platform app created + first deploy live:** ✅ done (2026-05-11). App `plankton-app` on SGP1, Professional tier ($25/mo, 1 vCPU / 2 GB), autodeploy from `main`. URL: `https://plankton-app-9kv78.ondigitalocean.app`. `/health` returns 200, `/` serves the SPA, Express + sessions wired up correctly. All 60+ env vars pasted from secure note + 4 net-new vars added (GCS JSON, 3 Calendar OAuth). `RUN_CRONS=false` so Replit keeps cron leadership for Phase 2 soak. Two issues encountered and fixed during initial deploys: (1) `attached_assets/logo-11_1775755479888.png` was being silently gitignored — force-added in `2c40e536`; (2) env vars weren't pasted on first creation, causing `DATABASE_URL must be set` on boot — fixed by adding all secrets via DO's bulk .env paste + per-var form for the multi-line GCS JSON.
- **Phase 1:** ✅ complete (2026-05-11). Phase 2 (side-by-side validation via `do.app.treemarkables.co.nz` DNS record) can begin.
- **Phase 2 — soak window started (2026-05-11):**
  - DNS managed at Cloudflare (discovered mid-setup; Crazy Domains is just the registrar). CNAME `do.app.treemarkables.co.nz` → `plankton-app-9kv78.ondigitalocean.app` added in Cloudflare with **grey-cloud (DNS only)** — orange cloud would break DO's TLS provisioning since DO's origin cert is for the `*.ondigitalocean.app` hostname, not the custom domain.
  - DO auto-provisioned TLS via Google Trust Services within ~5 minutes of DNS going live. `/health` returns 200 over HTTPS on the custom domain.
  - Stale CNAME was also created in Crazy Domains panel before the Cloudflare delegation was discovered. Inert (Crazy Domains nameservers aren't authoritative) — cleanup deferred to Phase 5.
  - **Database surprise:** the Phase 0 audit assumed prod was already on Neon. It wasn't — the actual prod DB is Replit's internal-managed Neon, accessed via the `heliumdb` alias hostname. Internal-only DNS, can't be reached from outside Replit. DO's first runtime requests hit `getaddrinfo ENOTFOUND helium` because the alias only resolves inside Replit's network.
  - **Resolution:** created a fresh Neon project in the user's own Neon account (`treemarkables-prod`, Postgres 16, Sydney AWS region `ap-southeast-2`). 80 MB pg_dump from helium → psql restore into Sydney Neon, ~3 min, all 111 tables and row counts verified byte-exact. DO's `DATABASE_URL` updated to the Sydney pooled URL (`ep-fancy-salad-a7zdt2dw-pooler.ap-southeast-2.aws.neon.tech`). All endpoints now respond clean.
  - **Replit unchanged.** Replit auto-injects `DATABASE_URL` for its connected Production Database (heliumdb) at the deployment runtime, so trying to override via workspace Secrets would fight the platform. Path of least resistance: don't try to share a single DB across both stacks during soak. Replit/heliumdb keeps serving customers, DO/Sydney-Neon serves internal validation. The two DBs drift apart during soak — acceptable because DO is internal-only.
  - **Phase 4 cutover plan revised:** at the moment of customer DNS flip, take a fresh `pg_dump` from helium, restore into Sydney Neon (overwriting any test data), then flip Cloudflare's `app.treemarkables.co.nz` record from Replit to DO. ~10 minute window of no-writes on the old prod (announce a maintenance window).
  - **Security TODO:** the Neon password `npg_kjQRcAtN5e9s` was pasted in the migration chat — rotate via Neon dashboard → Settings → Reset password, then re-paste in DO env vars. Do before Phase 4.
  - **Soak posture:** customers stay on `app.treemarkables.co.nz` (Replit/heliumdb). Internal team uses `do.app.treemarkables.co.nz` (DO/Sydney-Neon). `RUN_CRONS=false` on DO; Replit keeps cron + webhook leadership.
  - **Cron gating bug found and fixed (`b204b99a`):** `AutomatedTriggers.startBackgroundTasks()` was called at module-load time at `automatedTriggers.ts:290`, bypassing the gate in `server/index.ts:646`. While `RUN_CRONS` was also unset on DO during the initial deploy, the email reply poller processed 74 inbound Gmail messages without sending outbound replies (Resend Activity confirmed). After adding `RUN_CRONS=false` to DO env vars and the b204b99a fix, the boot logs confirm `[AutomatedTriggers] RUN_CRONS=false — automated communication background tasks suppressed` and `[Near Miss Review Cron] suppressed (RUN_CRONS=false)` — all cron paths now properly gated.
