# Inflow — Usage Cap Enforcement (SMS + AI)

Scope doc for enforcing the bundled SMS and AI allowances defined in `INFLOW_SAAS_PLAN.md`. Written 2026-06-22. **Status: scoped, not built.** Read `INFLOW_SAAS_PLAN.md` (§Subscriptions) and `INFLOW_PHASE4_billing.sql` first.

## The problem

The tier table sells bundled monthly allowances:

| Plan | SMS / mo | AI actions / mo |
|---|---|---|
| Freemium | 0 | 0 |
| Crew ($85) | 200 | 75 |
| Business ($130) | 600 | 250 |

**None of these are enforced.** `subscription_plans` only has `active_job_cap`; there is no `sms_cap` / `ai_action_cap` column, no usage counter, and no check at any send/action site. Today every tier can send unlimited SMS and run unlimited AI. This doc closes that gap.

Both SMS and AI cost ~10c per unit, so at the new prices a maxed Business tenant is ~65% COGS — the caps + overage path are what protect margin. Soft-stop-at-cap is therefore the MVP; metered overage is a later add.

## Decisions

| Concern | Decision | Rationale |
|---|---|---|
| **AI metering unit** | **1 "action" = 1 user-facing AI operation**, NOT 1 OpenAI call or 1 token | A Speech-to-Quote makes Whisper + 2 GPT calls but is **one** action. Predictable for the customer, matches the sales-page language, simple to meter. |
| **Period** | **Calendar month, Pacific/Auckland**, resets on the 1st | Matches the existing "active job" cap definition in the plan; use `shared/dateUtils.ts`. Not the Stripe billing period (simpler; revisit only if metered overage needs alignment). |
| **Default overage policy** | **`soft_stop`** (block further use until reset/upgrade) | No Stripe metering needed to ship. `metered` overage is Phase E. |
| **Comped businesses** | **Unlimited (caps bypassed)** for Treemarkables / any comped tenant | TM is comped at Business and uses AI/SMS heavily as the owner's own business — must never be soft-stopped. Reuse the comped-allowlist lever (see entitlements layer). |
| **Metering-failure behaviour** | **Fail-open** — if the usage query throws, allow the send/action and log | Don't block legitimate field operations over a metering bug; cost exposure is bounded by the provider account anyway. |
| **Counting strategy** | **`COUNT(*)` over an append-only `usage_events` log**, indexed by `(business_id, metric, created_at)` | Volume is tiny (hundreds/business/month). A rollup counter is premature; add later if the hot-path query ever matters. |

## Schema (needs explicit DB approval per CLAUDE.md — additive, reversible)

```sql
-- 1. Caps on the plan (NULL = unlimited)
ALTER TABLE subscription_plans ADD COLUMN sms_cap integer;
ALTER TABLE subscription_plans ADD COLUMN ai_action_cap integer;
UPDATE subscription_plans SET sms_cap = 0,   ai_action_cap = 0   WHERE key = 'freemium';
UPDATE subscription_plans SET sms_cap = 200, ai_action_cap = 75  WHERE key = 'crew';
UPDATE subscription_plans SET sms_cap = 600, ai_action_cap = 250 WHERE key = 'business';

-- 2. Per-business overage policy (default soft-stop)
ALTER TABLE subscriptions ADD COLUMN overage_policy text NOT NULL DEFAULT 'soft_stop'; -- 'soft_stop' | 'metered'

-- 3. Append-only usage log (tenant-scoped → RLS + app_tenant grant, like the other Phase 4 tables)
CREATE TABLE usage_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id),
  metric text NOT NULL,                 -- 'sms' | 'ai'
  quantity integer NOT NULL DEFAULT 1,
  feature text,                         -- 'booking_reminder' | 'speech_to_quote' | ...  (for analytics)
  ref text,                             -- optional: jobId / quoteId / messageId
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_lookup ON usage_events (business_id, metric, created_at);
GRANT SELECT, INSERT ON usage_events TO app_tenant;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_events
  USING (business_id = nullif(current_setting('app.current_business', true),''))
  WITH CHECK (business_id = nullif(current_setting('app.current_business', true),''));
```

Mirror the columns in `shared/schema.ts` (and a `usageEvents` table) — `business_id` optional in TS so off-request inserts use the DB default, same pattern as the rest of the tenancy retrofit.

## The enforcement helper

New `server/services/usageMeter.ts`:

```
checkAllowance(metric, businessId): { used, cap, remaining, blocked }   // read-only
consume(metric, businessId, { feature, ref, quantity=1 }): { allowed }  // checks + records (or refuses if soft-stopped over cap)
```

- Resolves the plan cap from `subscriptions → subscription_plans` (reuse the resolver shape in `server/tenancy/entitlements.ts`).
- Comped allowlist → `cap = null` (unlimited) → always allowed.
- `cap = 0` (Freemium) → always blocked (the feature gate already hides it; this is defence in depth).
- Counts `usage_events` for the current NZ calendar month.
- On `soft_stop` + over cap → `allowed:false`, **records nothing**. On allowed → inserts a `usage_events` row.
- Throws nothing on its own failures — fail-open + `console.warn('USAGE_METER_ERROR …')`.

## Enforcement points (from the 2026-06-22 code audit)

### SMS — one choke point
Wrap inside **`smsService.sendSMS()` ([server/services/smsService.ts:59](server/services/smsService.ts))**. Every one of the ~14 callers funnels through it:
- routes.ts: 734, 3064, 10934, 17135, 18959, 21845, 24984, 24996, 27068
- `notificationService.ts`: 140, 184, 293, 301
- `bookingReminderService.ts`: 163
- `index.ts`: 382 (post-voicemail)

Before send → `consume('sms', businessId, …)`; if `!allowed` return a typed `UsageCapError` (callers already handle send failures). **businessId source:** `currentBusinessId()` on request paths; for the cron callers (`bookingReminderService`, `notificationService` when fired off-request) pass `job.businessId` / `quote.businessId` explicitly — `currentBusinessId()` is undefined there. Add a `businessId` arg to `sendSMS()` so cron callers must supply it.

### AI — ~11 sites, no choke point
Guard each endpoint with `consume('ai', businessId, { feature })` **before** the OpenAI call:

| Feature | File:line | businessId |
|---|---|---|
| Speech-to-Quote (web) | routes.ts:27445 | `req.session.businessId` |
| Speech-to-Quote (mobile) | routes.ts:20216 | API-key tenant |
| Lead extract — message | routes.ts:3212 | session |
| Lead extract — screenshot | routes.ts:3295 | session |
| FB message extract | routes.ts:29662 | session |
| Screenshot extract (mulch) | routes.ts:29703 | session |
| Video transcription | routes.ts:8177 | video → businessId |
| Supplier-invoice extract | routes.ts:8889 | job → businessId |
| Call → job extract | routes.ts:19906 | session |
| Assistant chat | routes.ts:30401 / `aiAssistant.ts:275` | session |
| Quote follow-up draft (**cron**) | `quoteFollowupAi.ts:21`, called from `reminderChecker.ts:95` | **quote.businessId — no request context** |

Count **once per user-facing action** even when the handler makes multiple OpenAI calls (capitalise + extract). v1: a `consume()` call at the top of each handler (surgical, low-risk). Cleanup option (later): consolidate the 3 `new OpenAI()` instances into one metered client.

## UI + instrumentation (ship alongside, not after)

- **`GET /api/billing/usage`** → `{ sms: {used,cap}, ai: {used,cap}, periodEnd }`.
- **SettingsBilling** — usage meters ("142 / 200 SMS", "30 / 75 AI"), amber banner at 80%, block modal at cap with CTA (upgrade tier / enable overage / buy top-up).
- **Structured log line** on every block: `USAGE_CAP_BLOCK business=<id> metric=<sms|ai> used=<n> cap=<n>` — greppable in DO logs, same convention as `FIELD_CLEAR_AUDIT`.

## Phases

- **A — Schema** (DB approval gate): caps columns + seed, `overage_policy`, `usage_events` table + RLS, `shared/schema.ts`.
- **B — Meter + SMS**: `usageMeter.ts`, wrap `sendSMS()` (soft-stop), `businessId` arg for cron callers, `/api/billing/usage`, the log line.
- **C — AI**: guard the 11 sites; thread `businessId` through the quote-follow-up cron path.
- **D — UI**: meters + near-cap banner + block/upsell modal in SettingsBilling.
- **E — later**: metered overage (Stripe usage records on a metered price), top-up packs, per-business `metered` policy.

## Gotchas

- **Cron paths have no tenant context.** `bookingReminderService`, `notificationService` (off-request), and `quoteFollowupAi` must pass businessId from the domain object — `currentBusinessId()` returns undefined. This is the #1 way to ship a silently-unmetered path.
- **Comped TM must be unlimited** — verify before rollout, or the owner's own business gets soft-stopped mid-job.
- **Don't double-count** the multi-call AI handlers — meter the action, not each OpenAI request.
- **Active-job cap is also unenforced** — same period/metering pattern would cover it, but it's out of scope here (SMS/AI only).
