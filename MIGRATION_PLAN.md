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
  - **Neon password rotation (2026-05-11):** ✅ done. The original Neon password was pasted in the migration chat, so it was rotated via Neon dashboard → Branch `production` → Roles & Databases → `neondb_owner` → Reset password. New pooled connection string copied from Neon's "Connect" panel (with pooling toggle ON) and pasted into DO's `DATABASE_URL`; DO auto-redeployed clean. Secure note updated, old password is now invalid. Note for any future rotation: Neon's reset flow downloads a `.env`-style snippet (PGUSER/PGPASSWORD/PGHOST/PGDATABASE separately), but the "Connect" panel is much easier — it shows the assembled `postgresql://…` string with the new password already baked in, plus a copy button.
  - **Soak posture:** customers stay on `app.treemarkables.co.nz` (Replit/heliumdb). Internal team uses `do.app.treemarkables.co.nz` (DO/Sydney-Neon). `RUN_CRONS=false` on DO; Replit keeps cron + webhook leadership.
  - **Cron gating bug found and fixed (`b204b99a`):** `AutomatedTriggers.startBackgroundTasks()` was called at module-load time at `automatedTriggers.ts:290`, bypassing the gate in `server/index.ts:646`. While `RUN_CRONS` was also unset on DO during the initial deploy, the email reply poller processed 74 inbound Gmail messages without sending outbound replies (Resend Activity confirmed). After adding `RUN_CRONS=false` to DO env vars and the b204b99a fix, the boot logs confirm `[AutomatedTriggers] RUN_CRONS=false — automated communication background tasks suppressed` and `[Near Miss Review Cron] suppressed (RUN_CRONS=false)` — all cron paths now properly gated.
  - **`PRIVATE_OBJECT_DIR` gotcha (2026-05-11):** photo upload from Soak threw 403 `storage.objects.create denied` for `treemarkables-photo-storage@…`. Root cause: DO's `PRIVATE_OBJECT_DIR` was the Replit Object Storage path carried over from the bulk .env paste, not the new GCS bucket. The new service account has no IAM on the old Replit-managed bucket → 403. Fix: set `PRIVATE_OBJECT_DIR=/treemarkables-photos/.private` on DO (per the value above). General gotcha for Phase 4 cutover and any future env-var reseeding: the bulk paste from Replit silently includes `PRIVATE_OBJECT_DIR`, which must be overridden to the GCS bucket value on DO. Note: GCP project has two buckets — `treemarkables-photos` (canonical, per plan) and `treemarkables-photos-prod` (created during setup, never used); delete `-prod` at Phase 5 cleanup once Soak has confirmed the canonical one works.
  - **Cloudflare proxy drift, then a bigger discovery (2026-05-11):** while debugging the photo upload, a response from `do.app.treemarkables.co.nz/objects/photos/...` returned `Server: cloudflare` and `Cf-Cache-Status: HIT` — meaning the `do.app` CNAME had been flipped from grey-cloud (DNS only) to orange-cloud (proxied) at some point after the original Phase 2 DNS setup. Reverted to grey-cloud + ran *Caching → Configuration → Purge Everything* in Cloudflare. But responses *still* showed Cloudflare headers. Ran `dig plankton-app-9kv78.ondigitalocean.app` and got `162.159.140.98` + `172.66.0.96` — **both Cloudflare IPs**. **DigitalOcean App Platform fronts all `*.ondigitalocean.app` URLs with Cloudflare as their edge**, so a CDN is *always* in the path on App Platform, regardless of the customer's own Cloudflare proxy setting. Our `do.app` grey-cloud is still correct (prevents double-proxying), but the "if a CDN sits in front" framing in earlier planning was wrong — it always does.
  - **`Cache-Control: private` fix shipped:** `server/photoStorage.ts` was sending `Cache-Control: public, max-age=31536000` from all four photo-serving response paths (thumbnail-on-the-fly, HEIC convert success, HEIC fallback, normal serve). Combined with the no-auth `/objects/photos/:filename` route at `routes.ts:6624`, that meant DO's Cloudflare edge would cache private user photos under unguessable-but-not-private UUIDs for up to a year — any URL leaked once would stay at the edge. Flipped all four to `Cache-Control: private, max-age=31536000`: browser cache still holds (no perceived perf hit), but Cloudflare won't share across users. Verified on Soak: API calls with `Cache-Control: private` already show `Cf-Cache-Status: MISS`. **Phase 5 follow-up:** `routes.ts:12382` and `routes.ts:12391` (`/uploads`, `/photos` local-disk fallback routes) still send `public, max-age=86400`. Local disk is fallback-only on DO so not actively serving, but flip them to `private` during cleanup. `/logos` at `routes.ts:12401` is intentionally public marketing content — leave alone. Longer-term consideration also for Phase 5: the `/objects/photos/:filename` route has no auth; security-through-obscurity via UUID is OK in practice but signed/expiring URLs would be more defensible.
  - **Google Calendar `invalid_grant` from re-minted refresh token (2026-05-11):** "Book" action in Mail returned toast `Failed to create calendar event`; DO runtime logs showed `GaxiosError: invalid_grant` from `OAuth2Client.refreshAccessToken` (`googleCalendarService.ts:23`). OAuth consent screen was confirmed "In production" so the 7-day Testing-mode expiry didn't apply. Resolution: re-minted refresh token via [OAuth Playground](https://developers.google.com/oauthplayground/) with `Use your own OAuth credentials` + `Force prompt: Consent Screen` + `Access type: Offline`, scope `https://www.googleapis.com/auth/calendar`. Updated `GOOGLE_CALENDAR_REFRESH_TOKEN` on DO with the new value; secure note also updated. Likely root cause: special chars (slashes/underscores in the `1//...` token) mangled by DO's bulk .env paste. Same family as the `PRIVATE_OBJECT_DIR` gotcha. **Phase 4 cutover gotcha:** after any bulk env-var re-paste, verify token-shaped values (anything with `/`, `_`, `-`, multi-line, or unusual length) by either re-pasting per-var via DO's form UI, or by running a quick boot smoke test on each integration (Calendar, GCS, OAuth refresh tokens). Don't trust the bulk paste alone.
  - **Old-photo backlog still on Replit Object Storage (2026-05-11):** internal testers on Soak see thumbnail placeholders/greyed-out images for photos uploaded to job cards *before* the migration. Expected — those photos live in Replit's managed Object Storage bucket; DO's service account has no IAM there. New uploads from Soak land in `treemarkables-photos` and display correctly. **Acceptable during Soak** since the audience is internal-only and the test is validating the new code path, not historical content. **Required at Phase 4 cutover:** copy the existing photo backlog from Replit Object Storage → `treemarkables-photos` so customer URLs in the DB continue resolving after the DNS flip. The Replit sidecar (`127.0.0.1:1106`) is reachable only from inside Replit, so the copy script must run on Replit (using `objectStorageClient` for reads via sidecar + a parallel direct-creds `Storage` client for writes to the new bucket). Preserve object paths so the existing `/objects/photos/<filename>` DB URLs continue resolving post-cutover. Add this as a step in the Phase 4 cutover plan alongside the fresh pg_dump.
  - **Phase 3 collapses into Phase 4 (drafted 2026-05-11):** the original Phase 3 ("move side effects 24h ahead of the DNS flip") doesn't survive the two-DB design — repointing webhooks at DO while customers still read from heliumdb on Replit means webhook-driven writes (SMS reply, email reply, voicemail upload, Messenger inbound) land in Sydney-Neon and never reach customer reads on heliumdb. So webhook + cron flips have to be *atomic* with the pg_dump→restore→DNS flip. There is no separate Phase 3 anymore; see the Cutover runbook section below.
  - **Backlog copy script + trailing-space `PRIVATE_OBJECT_DIR` discovery (2026-05-11):** built `scripts/migrate-object-storage.ts` to dual-client copy (sidecar read → direct-creds write) the Replit-bucket backlog. Dry-run revealed **1,667 photos / 1.5 GB** (two orders larger than the audit's 1.7 MB local-disk estimate; no recordings yet). Smoke test (`--limit 5`) copied cleanly to `treemarkables-photos`, but end-to-end verification via `https://do.app.treemarkables.co.nz/objects/photos/<file>` returned **404**. Root cause: DO's `PRIVATE_OBJECT_DIR` env var had a **trailing space** (likely from the same bulk-paste origin as the earlier `PRIVATE_OBJECT_DIR` and Calendar-refresh-token corruption). The space made DO upload/lookup keys land at `.private /photos/...` (with literal space). Soak photos worked internally because the bug was symmetric, but our backlog copies at `.private/photos/...` (no space) were invisible to DO. **Fixes shipped:** (1) `.trim()` added at the three env read sites (`photoStorage.ts:158`, `routes.ts:8784`, `routes.ts:8973`) so any future whitespace-corrupting paste is neutralized in code. (2) The 10 existing soak files at `.private /photos/...` duplicated to `.private/photos/...` on GCS so DO keeps serving soak photos across the env fix. **User-side step:** strip the trailing space from DO's `PRIVATE_OBJECT_DIR` env var; redeploy will pick up both the env fix and the `.trim()` defence. **Phase 5 cleanup:** delete the 10 legacy `.private /photos/...` (with-space) entries after DO has been confirmed reading from no-space for a while. **Full copy completed 2026-05-11:** 1,662 new + 5 smoke-test = 1,667 objects copied, 0 errors. Dest bucket has 1,677 canonical objects + 10 legacy-with-space pending cleanup. Idempotent re-run takes ~2 min wall-clock for zero new files; cutover-day re-run will pick up only the soak-window delta.

---

## Cutover runbook (drafted 2026-05-11)

Phase 3 and Phase 4 collapse into a single atomic cutover window. Order matters: webhook + cron flips can't precede the DB cutover (writes would land in Sydney-Neon while customers read heliumdb), and can't follow the DNS flip (post-DNS writes hitting Replit are lost). Everything happens inside a single short maintenance window.

### Open question to resolve before cutover day

Each webhook provider has a URL configured in its console. **We don't yet know whether those URLs target `https://app.treemarkables.co.nz/...` (the customer hostname, follows DNS) or a raw Replit deploy URL (`*.replit.app` / `*.repl.co`, pinned to Replit).**

- If **customer hostname** → DNS flip moves the webhook automatically. No per-provider console edit needed. In-flight retries during the flip may hit either side depending on cached DNS; auto-retry on 5xx covers it.
- If **raw Replit URL** → per-provider console edit required during the maintenance window. Adds 5-10 min of click-work and a step that can fail.

**Action (T-2 days):** log into each console below and record the current URL. If any are raw Replit URLs, pre-stage the new DO URLs (`https://do.app.treemarkables.co.nz/...` until DNS flips, then `https://app.treemarkables.co.nz/...`).

### Webhook provider matrix

| Provider | Endpoints | Console | Signing secret env var | Auto-retry? |
|---|---|---|---|---|
| Twilio | `POST /api/webhooks/sms`, `/api/webhooks/twilio-answer`, `/api/webhooks/twilio-no-answer`, `/api/webhooks/twilio-voice` | console.twilio.com → Phone Numbers → the prod number → Voice/Messaging | (signature header validated in route; `TWILIO_AUTH_TOKEN`) | Yes — 11 retries over 24h on 5xx |
| Vonage | `GET/POST /api/webhooks/vonage-voice`, `POST /api/webhooks/vonage-event`, `POST /api/webhooks/vonage-recording` | dashboard.nexmo.com → Numbers → the prod number → Voice settings | `VONAGE_WEBHOOK_SECRET` | Yes — limited retries |
| Resend (events) | `POST /api/webhooks/resend-events` | resend.com/webhooks | `RESEND_EVENTS_WEBHOOK_SECRET` | Yes |
| Resend Inbound + SendGrid Inbound Parse | `POST /api/webhooks/email` | resend.com/inbound + app.sendgrid.com → Settings → Inbound Parse | `RESEND_WEBHOOK_SECRET` (Resend) | Resend: yes. SendGrid: limited |
| Facebook Messenger | `GET /api/webhooks/messenger` (verify), `POST /api/webhooks/messenger` (events). Also `GET /api/webhooks/facebook/messenger` as an alias. | developers.facebook.com → app → Messenger → Webhooks | `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Yes |
| Zapier (outbound from us; no inbound to flip) | — | — | `ZAPIER_WEBHOOK_URL` | n/a |

No Stripe (payments don't flow through Stripe — confirmed in Phase 0 audit).

### Cron flip

Single env-var flip per stack:

- **Replit:** set `RUN_CRONS=false` (currently unset → defaults to enabled).
- **DO:** delete `RUN_CRONS` env var (currently `false` → unset defaults to enabled).

Both happen inside the maintenance window. Order: kill Replit's crons *before* enabling DO's, to avoid the brief window where both run and a notification queue ticks twice. The gates are at `server/index.ts:528` (central `cronsEnabled`), `routes.ts:26982` (near-miss reminder), `services/automatedTriggers.ts:293` (automated triggers module-load), plus uses of `cronsEnabled` for the notification queue, marketing scheduler, email reply poller, SMS reply poller.

### Maintenance-window sequence (T-0)

Estimated window: 10-15 minutes. Schedule for low-traffic time (late evening NZ).

| Step | Action | Verification |
|---|---|---|
| 1 | Announce maintenance start (status page / in-app banner if available) | — |
| 2 | Set `RUN_CRONS=false` on Replit; restart the Replit workflow to apply | Replit logs show `RUN_CRONS=false — automated communication background tasks suppressed` |
| 3 | Block app traffic on Replit (return a maintenance HTML for all routes, or kill the workflow) so no further writes hit heliumdb | `curl https://app.treemarkables.co.nz/health` returns maintenance page or 503 |
| 4 | `pg_dump` from helium → `psql` restore into Sydney-Neon (overwrites all soak data). Use the same procedure that created the soak DB. | Row count parity on the 5 highest-traffic tables (jobs, customers, photos, messages, communications) |
| 5 | Run `tsx scripts/migrate-object-storage.ts` from Replit one final time to pick up any photos uploaded since the last copy | Final summary: `copied=<small N>  errors=0` |
| 6 | If any webhook URLs were raw Replit URLs (per audit), repoint each console entry to `https://do.app.treemarkables.co.nz/...` | Send a test event from each provider's console where supported (Twilio, Vonage, Resend, Messenger all have test buttons) |
| 7 | Remove `RUN_CRONS` env var on DO; trigger a redeploy to apply | DO logs show cron startup logs (notification queue, marketing scheduler, email reply poller, etc.) |
| 8 | Flip Cloudflare's `app.treemarkables.co.nz` CNAME from Replit's URL to `plankton-app-9kv78.ondigitalocean.app`. Keep grey-cloud (DNS only). | `dig +short app.treemarkables.co.nz` from multiple resolvers shows DO's IPs |
| 9 | Smoke-test the live customer URL: log in, load a job card with a backlog photo, view inbox, submit a contact form | All return 200 with expected content |
| 10 | Announce maintenance end. Keep watching DO logs for ~30 min for unexpected errors. | — |

### Verification (post-cutover, T+1h to T+24h)

- DO request logs show steady traffic ramp as DNS propagates
- Cron tick logs appear at expected intervals
- Inbound webhook logs show events from each provider (test send during Step 6, then real traffic)
- No `getaddrinfo ENOTFOUND helium` errors (would mean DO is still hitting heliumdb)
- Spot-check a customer-uploaded photo from the backlog: it should serve from `treemarkables-photos`

### Rollback (decision criteria + procedure)

**Trigger rollback if:** any of (a) DO can't serve traffic, (b) a critical integration (Twilio voice, Stripe-replacement payment flow, Calendar booking) is broken and not fixable within 30 min, (c) data corruption suspected on Sydney-Neon.

**Procedure:**

1. Flip Cloudflare CNAME back to Replit.
2. Set `RUN_CRONS=false` on DO (env var), redeploy.
3. Unset `RUN_CRONS` on Replit, restart workflow.
4. If webhook consoles were edited, revert them.
5. Replit's heliumdb is untouched by the cutover sequence — re-enabling Replit traffic is enough; no DB restore needed.
6. **Writes that landed on Sydney-Neon during the broken window are lost.** If those are unrecoverable from the providers (e.g., a customer SMS reply), apologize and request re-send.

Replit stays warm for 7 days post-cutover per the original plan; this is the rollback target.
