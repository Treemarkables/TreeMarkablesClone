# Sydney Migration Runbook — move the app to SYD1, keep the database

**Goal:** co-locate the app with the database and the users. The DB (Neon,
`ap-southeast-2`) and the users (NZ) are both near Sydney; only the app (DO
App Platform, SGP1) is in the wrong place. Moving the **app** — not the DB —
fixes both latency legs with **zero data migration**.

| Path | Today | After |
|---|---|---|
| User (NZ) → app | ~130 ms (Singapore) | ~25–35 ms (Sydney) |
| App → DB, per query | ~95 ms | ~1–2 ms |
| Rollback | — | flip DNS back (~10 min) |

Measured before this migration: prod TTFB 0.45–1.6 s even for trivial
responses. Expected after: ~50–150 ms for typical API calls.

App Platform supports SYD (verified 2026-07-13:
<https://docs.digitalocean.com/products/app-platform/details/availability/>).
Region is fixed at app creation, so this is a **new app + DNS cutover**, not an
in-place move.

**Division of labor:** DO dashboard + Cloudflare steps are the owner's (per
CLAUDE.md, Claude never edits DO/Cloudflare). Claude preps/verifies from the
repo side and updates docs afterwards.

---

## Phase 0 — Prep (30 min, no user impact)

1. **Inventory env vars on the current app** (old app → Settings → Environment
   Variables, app-level AND component-level). **Copy exactly what the dashboard
   shows — that list is the source of truth**, not the checklist below. The
   checklist is for cross-checking that nothing on the dashboard is missed and
   for flagging scope gotchas.

2. **Check Neon IP Allow** (Neon console → project → Settings → IP Allow). If
   an allowlist is configured, the new app's egress IPs must be added before
   cutover. Default = open, nothing to do.

3. **Pick the cutover window**: low-traffic NZ time (early morning). The only
   downtime is the domain re-attach + cert issue, a few minutes.

### Env-var checklist (cross-check, grouped)

Derived from every `process.env.*` reference in `server/` + `shared/`
(2026-07-13). *Not every name below is necessarily set in DO — dead/dev-only
entries are marked. Anything on the dashboard but not in this list still gets
copied.*

**Boot-critical (app crashes or misbehaves without these):**
- `DATABASE_URL` — Neon pooler endpoint. UNCHANGED (DB stays in Sydney).
- `DIRECT_DATABASE_URL` — direct (non-pooler) endpoint for the RLS tenant pool
  (auto-derived by stripping `-pooler.` if unset).
- `SESSION_SECRET`
- `TENANT_RLS_ENABLED` — must match old app (`true` in prod).
- `APP_URL` — customer-link host; unchanged by this migration.
- `PRIVATE_OBJECT_DIR` — GCS path; **watch for trailing spaces** (known
  footgun, env reads `.trim()` defensively).
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` — GCS service account.

**Enforcement flags (silent behavior changes if missed):**
- `API_AUTH_ENFORCED`, `ENTITLEMENT_ENFORCEMENT`, `FEATURE_GATES_ENFORCE`,
  `USAGE_CAPS_ENFORCE`, `TENANT_RLS_STRICT`, `TENANT_RLS_POLICY_EXEMPT`,
  `INFLOW_COMPED_BUSINESS_IDS`, `INFLOW_CONTENT_PUBLISHER_BUSINESS_IDS`,
  `STRIPE_PAYMENT_BUSINESS_IDS`, `LEGACY_HOST_REDIRECT_ALL`, `REQUIRE_CAPTCHA`

**Crons / workers:**
- `RUN_CRONS` — **the one deliberate difference**: set `false` on the NEW app
  until cutover (two instances on one DB double-send SMS/push/email). Flipped
  in Phase 2.

**Stripe (platform + Connect):**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_GST_TAX_RATE_ID`

**Twilio (voice/dialer/push):**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`,
  `TWILIO_API_KEY_SECRET`, `TWILIO_API_SECRET`, `TWILIO_PHONE_NUMBER`,
  `TWILIO_OUTBOUND_CALLER_ID`, `TWILIO_TWIML_APP_SID`,
  `TWILIO_PUSH_CREDENTIAL_SID`, `TWILIO_PUSH_CREDENTIAL_SID_ANDROID`,
  `TWILIO_CLIENT_IDENTITY`, `TWILIO_VOICEMAIL_GREETING`,
  `TWILIO_VOICEMAIL_GREETING_URL`, `TWILIO_RECORDING_DISCLOSURE`,
  `TWILIO_RECORDING_DISCLOSURE_URL`, `TWILIO_CONNECTING_PROMPT`,
  `OWNER_PHONE_NUMBER`, `HERO_PHONE_NUMBER`, `HERO_WEBHOOK_SECRET`

**Email / SMS:**
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_EVENTS_WEBHOOK_SECRET`
- `SMSEVERYONE_USERNAME`, `SMSEVERYONE_PASSWORD`, `SMSEVERYONE_SENDER_ID`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` *(legacy — copy if present)*

**Firebase (push; served to the client at runtime via `/api/firebase-config`):**
- `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`,
  `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_STORAGE_BUCKET`, `FIREBASE_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT`

**AI / integrations:**
- `OPENAI_API_KEY`, `VOICE_AGENT_MODEL`
- `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
  `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `GOOGLE_MY_BUSINESS_API_KEY`
- `ADDY_API_KEY`, `ADDY_API_SECRET`
- `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `RECAPTCHA_SECRET_KEY`
- `ZAPIER_WEBHOOK_URL`

**Tenant JWT (Neon Authorize path, staged):**
- `TENANT_JWT_PRIVATE_KEY_B64`, `TENANT_JWT_KID`

**Observability:**
- `SENTRY_DSN` (server, runtime)
- `VITE_SENTRY_DSN` (client) — ⚠️ **BUILD-TIME scope**. Vite bakes it into the
  bundle during `vite build`, so on App Platform it must be set with scope
  "Build time" (or "Build & run"). Runtime-only scope silently produces a
  bundle with no Sentry.

**Tuning (optional, have code defaults):**
- `SESSION_POOL_MAX` (default 10), `TENANT_POOL_MAX` (default 20)

**Do NOT set / dead:**
- `PORT`, `STATIC_DIR`, `NODE_ENV` — platform/launcher-managed.
- `REPL_IDENTITY`, `REPLIT_CONNECTORS_HOSTNAME`, `WEB_REPL_RENEWAL` — Replit
  leftovers, dead on DO.
- `ALLOW_EMPLOYEE_ID_LOGIN` — dev-only; auto-forced `false` in production.
- `FACEBOOK_*` — integration dropped; copy only if present on the old app.

---

## Phase 1 — Build the Sydney twin (~1 hr, zero user impact)

4. DO → Create App → **region SYD** → same GitHub repo
   (`Treemarkables/TreeMarkablesClone`), branch `main`, autodeploy ON.
5. Same instance size and build/run commands as the old app. Set all env vars
   from Phase 0, **with `RUN_CRONS=false`**.
6. Deploy; wait for green health checks.
7. Smoke-test on the app's default `*.ondigitalocean.app` URL — it talks to
   the real prod DB, so this is a true test:
   - login (owner account) → dashboard renders
   - Dispatch board shows real jobs
   - open a job card; photos load (GCS reachability)
   - `curl -s -o /dev/null -w "%{time_total}" https://<new-app>.ondigitalocean.app/api/health`
     — expect the app↔DB portion to collapse; loosely compare against the same
     curl on the prod domain.
   - Do NOT test SMS/email sends from the twin pre-cutover (mock creds aren't
     set locally, but here they're real — sends would be live).

---

## Phase 2 — Cutover (~10 min, in the chosen window)

A custom domain can be attached to only ONE DO app, so this is a swap:

8. Old app → Settings → Domains → **remove** `app.inflowapp.co.nz` (and the
   legacy `app.treemarkables.co.nz` if attached).
9. New app → Settings → Domains → **add** both domains.
10. Cloudflare → DNS → update the CNAME for `app.inflowapp.co.nz` (and legacy
    host) to the new app's `*.ondigitalocean.app` target — **grey-cloud
    (DNS-only), never proxied** (orange-cloud double-proxies through DO's edge
    and breaks TLS; it's why the inflow apex 525'd).
11. Wait for DO cert issuance (a few minutes). Site serves from Sydney.
12. Swap cron ownership — order matters:
    1. OLD app: set `RUN_CRONS=false` (redeploys old app; it keeps serving
       nothing since the domain moved).
    2. NEW app: set `RUN_CRONS=true` (or delete the var — unset = enabled in
       production).
    A minute of cron gap is harmless (60 s-tick queue workers); overlap is the
    thing to avoid.
13. **Verify** (sessions survive — same DB, same hostname, host-only cookie):
    - site loads on `app.inflowapp.co.nz`; existing users still logged in
    - inbound call rings the iOS app (Twilio webhooks — URLs unchanged)
    - Stripe: dashboard → Webhooks → recent deliveries succeeding
    - quote form → lead appears (the 15-min health-check cron also covers this)
    - push notification arrives on a phone

---

## Phase 3 — Soak & cleanup (1 week)

14. Keep the Singapore app deployed (domainless, `RUN_CRONS=false`) as the
    rollback target for ~1 week (~$24 of overlap). Autodeploy can stay on so
    the rollback target tracks `main`.
15. **Rollback** = reverse steps 8–12 (domains back to old app, Cloudflare
    CNAME back, cron flags swapped back). ~10 minutes, no data implications —
    both apps always pointed at the same DB.
16. After a clean week: delete the SGP app. Update `CLAUDE.md` + `replit.md`
    (region SGP1 → SYD1) and delete this runbook's "pending" status (Claude's
    job — ask any session).

---

## Why not move the DB to Singapore instead?

Rejected: it requires a real data migration (new Neon project — projects are
region-bound — dump/restore or logical replication, recreate the `app_tenant`
role + grants + 144 RLS policies, repoint connection strings), carries actual
data risk, has a much slower rollback, and still leaves NZ users ~130 ms from
the app. Moving the app is strictly better on every axis. Only revisit if DO
SYD capacity ever blocks App Platform apps.
