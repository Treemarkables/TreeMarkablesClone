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
- AI voice agent (inbound IVR) — branch `feat/voice-agent-ivr` — 2026-06-10 — Twilio answer webhook gains a press-1/press-2 menu; press 1 bridges the caller to an OpenAI Realtime voice agent over Twilio Media Streams (new `server/services/voiceAgent.ts` WS bridge + `voiceAgentLead.ts` post-call lead pipeline); press 2 / timeout keeps the exact dial-Jules flow. business_settings `voice_agent_*` columns via schemaMigrations; ships dark (`voice_agent_enabled=false`)
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
