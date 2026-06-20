# Work Registry — collision prevention for parallel sessions

Many Claude Code sessions run at once in separate git worktrees against this repo.
**They cannot see each other.** This has caused duplicate work (two complete billing
systems were built in parallel before anyone noticed). Claim substantial feature
work here so it doesn't happen again. See the "Avoiding duplicate work" rule in
`CLAUDE.md`.

## How to use
1. **Before** starting a feature: `git fetch origin main && git log origin/main --oneline -25`,
   `gh pr list`, and scan the **Active** claims below for overlap.
2. If your feature already exists on `main` or in an open PR/claim, build the *delta* —
   don't create a parallel copy. Reconcile with that branch instead.
3. If clear, add a claim under **Active** (newest at top).
4. When your PR merges (or you abandon the branch), move the line to **Recently done**
   or delete it. Prune **Recently done** periodically.

Format: `- <area> — branch \`<name>\` — <YYYY-MM-DD> — <one-line scope> [PR #<n>]`

## Active
- App Store readiness (B2B web-billing path) — branch `feat/appstore-readiness-and-tenancy-isolation-test` — 2026-06-20 — make the iOS shell App-Store-submittable without Apple IAP. DONE: (1) gate all subscription checkout/portal CTAs in `SettingsBilling.tsx` behind `!isNativeApp()` (new `client/src/lib/platform.ts`), show read-only plans + "manage at inflowapp.co.nz" on native; (2) in-app account deletion (Guideline 5.1.1(v)) — `DELETE /api/auth/account` (scrub PII + sever login via `storage.anonymizeEmployeeForDeletion`, no hard-delete b/c 20+ unguarded FKs to employees.id; drops fcm tokens; destroys session) + new `SettingsAccount.tsx` page (`/settings/account`, typed-DELETE confirm) + "Account" card on Settings landing. Vite + server esbuild both clean. (3) cross-tenant isolation test harness `scripts/tenancyIsolationTest.mts` — seeds two throwaway tenants, logs in as each admin over HTTP, drives a list/direct-id/portal endpoint matrix and asserts no cross-tenant id leak (UUID-substring scan); prints PASS/SECURITY-FAIL/WARN matrix, exit code = #leaks. Needs dev server up w/ TENANT_RLS_ENABLED=true. NOT done (mostly non-code / your side): App Store Connect listing/screenshots/privacy-labels/reviewer demo account, optional capacitor `server.url` → Inflow domain; closing the portal/public-link/webhook owner-path gaps before tenant #2.
- tenant resolution on owner-context writes — branch `feat/tenant-resolution-webhooks-public` — 2026-06-20 — close pre-tenant-2 isolation gaps where owner-pathed (session-less) handlers stamp inserts with the column DEFAULT (=Treemarkables) instead of the real owning tenant. GROUP A DONE (public resource-link writes): wrap the write blocks of `/api/quotes/:id/accept`, `/api/proposals/:id/accept`, `/api/reviews/submit`, and the Stripe deposit webhook's `finalizeProposalAcceptance`+`createPayment` in `runWithBusiness(resource.businessId, …)` so the work order / payment / notifications / diary land on the resource owner. Isolation harness extended with an owner-path WRITE-stamping assertion (accept B's quote via the public link → assert the job is stamped to B). GROUP B (webhooks: twilio-voice/sms, vonage-recording, resend-events, inbound email, messenger, contact-form) NOT done — needs tenant-resolution infra (phone#→business + page→business mapping tables; messenger + contact-form have NO tenant signal → product decision needed: per-business form URLs / FB page mapping). Harmless while single-tenant (everything stamps to TM, the only tenant). `/api/reviews/send-request` is session-authed (not a gap).
- compliance expiry reminders — branch `feat/compliance-expiry-reminders` — 2026-06-15 — Phase 2 "alerts" for the /today fleet compliance: daily cron scan (server/services/complianceReminderService.ts, hooked into the 60s notification worker, self-throttled hourly) fires in-app notification + push to admins when a vehicle's rego/CoF/scheduled-service crosses a configured lead time (and once overdue). Configurable lead times (default [30,7] days) on business_settings (`compliance_reminders_enabled` + `compliance_reminder_offsets`); settings UI = ExpiryReminderSettings card on /settings/vehicle-inspections. Dedupe via new `equipment_compliance_reminders` table (unique equipment_id+kind+expiry_date+offset_days). Boot DDL in server/index.ts. Builds on the merged /today work below.
- today / daily command centre — branch `claude/jolly-curie-0fc41e` — 2026-06-15 — new `/today` page (TodayDashboard.tsx) + `GET /api/today-overview` aggregator: fleet compliance (rego/CoF/scheduled-service incl. OVERDUE — note `/api/equipment/expiring` only covers next-30-days, skips overdue + service) + today's NZ-calendar jobs + summary tiles. Sidebar "Today" link above Dispatch. Phase 1 = page (read-only, reuses existing storage, no schema/migration). Phase 2 (planned) = morning cron scanning expiry dates → notifications + push (the "alerts" half)
- staff-schedule multi-week views — branch `feat/staff-schedule-multiweek` — 2026-06-12 — 1/2/3/4-week view toggle on /staff-schedule: scrollable readable availability grid (staff × days, job chips w/ names+times, heatmap tints, unassigned lane, per-day revenue footer), new `/api/jobs/for-date-range` endpoint, drill-to-day; Day Gantt unchanged [PR #176]
- inbound caller-ID wrong name — branch `fix/caller-id-forwarded-from` — 2026-06-12 — forwarded calls identified the caller as the owner's own number (ForwardedFrom preferred over From, semantics inverted) so caller-ID matched whatever customer record held that number ("Kim"); flip to From-first at all three webhook sites; findCustomerByPhoneLast8 scoped by currentBusinessId() when set + deterministic ORDER BY
- call-ring diagnosability — branch `fix/call-ring-diagnosability` — 2026-06-11 — voicemail recordings no longer logged as status 'answered' (now 'missed' via the existing &source=voicemail param); /api/twilio/admin/diagnostic recentCalls reads the right table (calls, not call_records); iOS app surfaces Twilio voice registration failures as a destructive toast instead of silent console logs
- quote online view/accept + PDF description — branch `fix/quote-view-accept-online` — 2026-06-11 — quote email CTA becomes "View Quote" → quote-aware ProposalAccept page (Accept Quote → finalizeProposalAcceptance, Download PDF, /viewed ping); PDF renders section descriptions + clickable accept-online link; email-reply fallback kept [PR #168]
- multi-day diary day-picker — branch `claude/nifty-ritchie-4b2bad` — 2026-06-09 — schedule a job across an arbitrary set of days (calendar multi-select in the Schedule Job modal + "remove weekends" toggle) instead of a contiguous start/end range. Adds `jobs.scheduled_dates` jsonb + `getJobScheduledNZDates`/`jobRunsOnNZDate` helpers; staff-assignment expansion + CalendarGrid + DispatchBoard honour the day set. Migration `migrations/manual/20260609_job_scheduled_dates.sql` (run on dev + prod before deploy)
- RLS session-less paths — branch `claude/festive-rubin-2cef4b` — 2026-06-08 — fix RLS prod regression: allowlist public viewers + webhooks + review flow to owner connection in `tenantMiddleware.ts` so they don't fail closed under `TENANT_RLS_ENABLED`. Also surfaces the real error in proposal/quote send-email routes. Immediate mitigation = unset the flag in DO.
- video auto-captions — branch `claude/romantic-blackburn-e8634c` — 2026-06-07 — Loom-style WebVTT captions on walkthrough videos (Whisper segment timestamps, auto on upload, `<track>` on all players). videos.captions_* columns applied to dev + prod Neon branches
- entitlement enforcement — branch `inflow-entitlement-enforcement` — 2026-06-06 — gate RBAC features by subscription tier, flag-gated [PR #132]
- work registry / collision-prevention — branch `inflow-work-registry` — 2026-06-06 — this file + CLAUDE.md rule

## Recently done
- Phase 4 billing (Stripe checkout + webhook sync + UI + self-serve signup) — merged to `main` 2026-06
- Trade generalization plan (docs) — merged to `main` 2026-06 [PR #124]
- Phase 1 multi-tenancy (`business_id` on all tables) — on `main` / prod

## Known stale branches (candidates to close)
- `feat/roles-permissions` [PR #11] — its RBAC backend is already identical on `main`; superseded.
- `inflow-phase4-billing-foundation` — deleted 2026-06-06 (was the duplicate billing PR #126).
