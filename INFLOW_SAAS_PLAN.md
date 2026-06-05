# Inflow — Multi-Tenant SaaS Plan

Active initiative as of 2026-05-22. Turn the single-business Treemarkables app into **Inflow**, a multi-tenant SaaS sold to other tree-services businesses.

This is the design + handoff doc for that work, in the same spirit as `MIGRATION_PLAN.md`. Read it before touching tenancy, roles, or billing code.

> **Companion: `INFLOW_TRADE_GENERALIZATION_PLAN.md`.** This doc makes a second *business* possible. That one makes a second *trade* (plumber/electrician/builder) possible — de-hardcoding "Treemarkables"/arborist via trade presets + per-business config so the app isn't tree-specific. Its catalog-seeding hooks into Phase 4 onboarding here; its identity/AI de-hardcoding is independent and can start now. Read it before touching seed data, AI prompts, templates, or onboarding.

> **Status: design phase.** Nothing below is built yet. The "Decisions" table separates what's locked from what's still open. Treemarkables continues running as a single-tenant app the whole time — it becomes **tenant #1** when Phase 1 lands, so the live business is never blocked by this work.

---

## End state

- **One codebase, many businesses.** Each customer (a tree-services company) is an isolated tenant. Their staff, jobs, customers, quotes, photos, and settings never cross into another tenant's data.
- **Treemarkables is tenant #1.** The existing production data is backfilled under one `business` row; the app behaves identically for them.
- **Each business owner customises access.** After subscribing, the owner gets a permissions page where every feature has a toggle — per *role* and per *individual staff member*, for both "can do" (actions) and "can see" (visibility).
- **Billing: a base membership + paid add-ons.** Tier count is TBD (possibly just one membership). Anything that costs *us* money to run — call recording, SMS, etc. — is sold as an add-on on top of the base, not bundled.
- **Brand + domain split.** App migrates to `inflowapp.co.nz` (owned) with a public sales/marketing page. Treemarkables keeps using it as a customer.

## Decisions

| Concern | Decision | Status | Rationale |
|---|---|---|---|
| Tenancy model | Shared schema, `businessId` discriminator column on every domain table | **Locked** | 110 tables on one Neon DB — schema-per-tenant or DB-per-tenant is operationally unmanageable. Discriminator is the only sane retrofit. |
| Isolation backstop | App-level `businessId` enforcement (lead) + Postgres RLS backstop via **Neon Authorize (JWT)** — see `INFLOW_TENANCY_AUDIT.md` | **Mechanism revised 2026-06-03** | A 22k-line `routes.ts` *will* miss a `WHERE businessId=` somewhere. RLS makes a forgotten filter a non-event. **Correction:** the code runs the stateless `neon-http` driver (no transactions), so the original "`SET LOCAL` in a per-request transaction" mechanism is impossible. JWT-based RLS works statelessly; PoC pending. Fallback: switch to `neon-serverless` Pool driver. |
| Tenant resolution | Session-derived `businessId` (from the logged-in employee's row) — **not** subdomain, for v1 | **Locked** | The iOS shell loads one webview; subdomain-per-tenant adds wildcard-cert + DNS complexity for no v1 benefit. Subdomain branding can come later. |
| Roles | Replace the hardcoded `role` enum (`admin`/`crew`) with a per-business `roles` table + a code-defined capability catalog | **Locked** | "Every little feature has a toggle" is impossible with a 2-value enum. |
| Permission storage | Role grants + per-employee overrides; effective = role grants, then employee allow/deny applied on top | **Locked** | Satisfies "per role *and* per staff member." |
| Entitlements vs permissions | Two layers: subscription (what the *business* paid for) gates which capabilities are *available*; RBAC (what each *staff* can do) gates within that | **Locked** | Ties billing → add-ons → toggles together. You can't grant `calls.record` if the business hasn't bought the Call Recording add-on. |
| Billing provider | Stripe, NZD, **prices displayed ex-GST** (+15% GST at checkout) | **Locked** | Ex-GST display is the B2B norm — GST-registered customers claim it back and read ex-GST as cheaper. (Customer *invoicing* already exists and is unrelated — this is subscription billing.) |
| Tier count | Three tiers: **Freemium (free) / Crew / Business** (free entry + two paid) | **Decided (2026-05-30)** — structure draft in §Subscriptions | Freemium (free) tier is the funnel; paid tiers gate features + raise job caps. |
| Cost-incurring features | Sold as add-ons (call recording, SMS, anything with per-use cost to us) | **Locked** | — |
| Trial / freemium model | **Freemium** — the Freemium (free) tier is the trial (job-capped, no time limit); optional 14-day Business trial on top | **Decided (2026-05-30)** | — |
| Pricing (NZD per tier / add-on) | Crew $89/mo, Business $189/mo (draft, ex-GST); Freemium $0 | **Draft — needs validation** | Drives Stripe product setup + sales-page copy. |
| Treemarkables (tenant #1) billing | **Comped — does not pay.** Gets full (Business-equivalent) entitlements at $0 | **Decided (2026-06-02)** | Owner's own business, backfilled as tenant #1 in Phase 1; exercises the full feature set without charging ourselves. |
| Domain / sales page | Migrate to `inflowapp.co.nz`, build marketing/sales site | **Locked (intent), later phase** | Owned already. |

---

## Multi-tenancy data model

### The tenant root

A new `businesses` table is the tenant identity. The existing `businessSettings` table (currently a single global row) becomes **per-tenant** — one settings row per business, linked by `businessId`.

```
businesses
  id            varchar pk (uuid)
  name          text not null
  slug          text unique          -- future subdomain / URL key
  status        text                 -- active, suspended, cancelled, trialing
  createdAt     timestamp
  -- subscription linkage lives on the subscriptions table (below), not here
```

### The discriminator

Add to **every domain table** (~100 of the 110):

```
businessId  varchar not null references businesses(id)
```

Tables that get it include (non-exhaustive): `customers`, `leads`, `quotes`, `jobs`, `tasks`, `proposals`, `photos`, `invoices`, `employees`, `teams`, `equipment`, `inventory`, `campaigns`, `socialPlans`, `communications`, `conversations`, `notifications`, `scheduleEvents`, `jobStaffAssignments`, `callRecords`, `treeMarkers`, all template/document tables, all safety/compliance tables, all analytics tables.

Tables that do **not** get it: the legacy unused `users` table; any pure lookup/enum tables with no tenant-specific rows; `session` (already keyed by session id).

**Two classes of user, both scoped:** `employees` (the tree business's staff) and `customerAuth` (the tree business's *own* customers using the customer portal). Both reference `businessId`.

### Tenant context + isolation

1. **Middleware** resolves `businessId` from the authenticated session on every request and attaches it to a request-scoped context.
2. **RLS policies** on each table: `USING (business_id = current_setting('app.current_business')::uuid)`. The middleware sets that GUC per request.
3. **Explicit filters** still added to queries during the retrofit — RLS is the backstop, not an excuse to skip them.

> **Open design question (Phase 0):** `@neondatabase/serverless` uses a websocket *pooler*, so connections are shared across requests. Setting `app.current_business` must be transaction-scoped (`SET LOCAL` inside a per-request transaction) or applied on connection checkout — a bare `SET` would leak the value to whatever request reuses the connection next. **This is the single most important thing to get right.** Resolve the exact mechanism before writing any RLS.

### Platform admin (you)

A concept *above* all tenants — the Inflow operator who can see/manage every business. Kept separate from any business's `employees`/`roles` so a tenant admin can never escalate to platform admin. Likely a small `platformAdmins` table + a distinct auth path.

---

## Customisable roles & permissions (the toggle system)

This is the heart of the "full customisability" requirement. Four pieces:

### 1. Capability catalog (code-defined)

A single registry in code listing **every grantable capability** in the app. Code, not DB, is the source of truth — it ships and evolves with features, so "every little feature has a toggle" stays true as the app grows. Each entry:

```
{
  key:        "jobs.edit",          // stable, never renamed
  module:     "Jobs",               // grouping for the UI
  label:      "Edit jobs",
  kind:       "action" | "view",    // "do" vs "see"
  requires:   "addon:call_recording" | null   // entitlement gate, if any
}
```

`kind` cleanly separates "can see" (drives nav + UI visibility) from "can do" (drives whether the action is permitted). `requires` is how a capability is gated behind a tier/add-on.

### 2. Roles as data (per business)

Replace the hardcoded `employees.role` enum with:

```
roles
  id            varchar pk
  businessId    varchar not null references businesses(id)
  name          text                 -- "Office Manager", "Foreman", "Apprentice"
  isSystem      bool                 -- seeded defaults (Admin, Crew) — can't be deleted
  grantedCaps   jsonb                -- array of capability keys this role grants
```

Every new business is seeded with **Admin** (all caps) and **Crew** (sensible field-staff subset) so existing behaviour is preserved on day one. `employees.role` (text) becomes `employees.roleId` (FK).

### 3. Per-employee overrides

```
employeePermissionOverrides
  employeeId    varchar references employees(id)
  capabilityKey text
  granted       bool                 -- true = allow on top of role, false = deny
```

**Effective permissions = role grants ∪ employee-allows − employee-denies**, then intersected with the business's subscription entitlements. Resolved once per request into a Set on the request context.

### 4. Enforcement on two planes

- **Backend (the authority):** `requireCapability("jobs.edit")` middleware on routes. Frontend hiding is cosmetic; this is what actually protects data.
- **Frontend (visibility):** AuthContext exposes the effective capability Set; a `<Can capability="…">` wrapper + `useCan()` hook hide nav items and buttons. This is the "what they can see" half.

### 5. The settings page

A new admin-only screen (gated behind `permissions.manage`):
- **Roles tab:** matrix of roles × capabilities, grouped by module, collapsible. Toggle per cell. Capabilities the business hasn't unlocked (via tier/add-on) show as locked with an upsell.
- **Staff tab:** pick an employee → see their role's effective grants → toggle individual overrides.

---

## Subscriptions, tiers & add-ons

```
subscriptionPlans      -- the base membership(s); maybe just one
  id, name, stripePriceId, priceNzd, interval (month/year)

subscriptions          -- one active per business
  id, businessId, planId, stripeCustomerId, stripeSubscriptionId,
  status (trialing/active/past_due/cancelled), currentPeriodEnd, trialEnd

addOns                 -- cost-incurring features sold on top
  id, key (matches capability `requires`), name, priceNzd,
  billingType (flat | metered)

businessAddOns         -- which add-ons a business has switched on
  businessId, addOnId, status, activatedAt
```

- **Entitlements layer:** `business → plan + active add-ons → set of unlocked capability keys`. This set gates what the RBAC page can grant (the `requires` field on the catalog).
- **Metered vs flat:** SMS is naturally per-message (Stripe metered/usage records). Call recording is more likely a flat monthly add-on. Decide per add-on.
- **Onboarding:** new businesses need a self-serve sign-up → create `business` row → seed default roles → start trial/subscription. Today employees are created internally only; this flow is net-new.

### Proposed three-tier structure — **DRAFT for review (NOT locked)**

> Resolves open question #1 with a concrete starting point. **The entry tier is free (freemium), named "Freemium" — decided by user 2026-05-30.** Pricing and bracket sizes on the paid tiers are placeholders to react to, not final. Grounded in the ServiceM8 NZ benchmark but **calibrated down**: tree work is lower-volume / higher-value / multi-day, so job brackets are smaller than ServiceM8's (30/150/500). NZD, **prices shown ex-GST** (15% GST added at checkout — B2B norm; customers claim it back). **Jobs/month is the price axis — never per-seat; users are unlimited on every *paid* tier** (field-service buyers reject per-seat pricing; high crew turnover). Freemium is the one exception — single-user, as a funnel limit.

| | **Freemium** (free) | **Crew** | **Business** |
|---|---|---|---|
| **Price (NZD/mo, ex-GST)** | $0 | $89 | $189 |
| **Annual (2 months free)** | — | $890/yr | $1,890/yr |
| **Who it's for** | Trial / solo owner-operator testing the water | Small established crew | Multi-crew company |
| **Active jobs / month** | 15 | 75 | Unlimited |
| **Users** | 1 user | Unlimited | Unlimited |
| **Core: jobs, invoicing, scheduling, photos** | ✅ | ✅ | ✅ |
| **Photos** | ✅ max 3 / job | ✅ Unlimited | ✅ Unlimited |
| **Quoting & Proposals** | ✅ | ✅ | ✅ |
| **SMS (booking reminders, customer texting)** | — | ✅ capped allowance | ✅ capped allowance |
| **Safety module (SWMS, toolbox talks, checklists)** | — | ✅ | ✅ |
| **Custom roles & per-staff permissions (RBAC)** | Defaults only (Admin/Crew) | ✅ Full | ✅ Full |
| **CompanyCam-style: voice captions, public timeline link, before/after** | — | ✅ | ✅ |
| **Marketing suite (Meta/social planner, campaigns)** | — | — | ✅ |
| **Advanced analytics & job costing** | — | Basic | ✅ |
| **Help centre access** | ✅ | ✅ | ✅ |
| **Support** | Community / docs | Email | Priority |
| **Card-processing fee** | 3.4% | 2.8% | 2.49% |

**What counts as an "active job":** a job **created within the calendar month** (the counter resets on the 1st) — *not* open-status. Simple to display, simple to meter in Stripe, and can't be gamed by closing/reopening jobs.

**SMS handling** (cost-incurring → **paid tiers only, capped**):
- **Freemium:** no SMS at all. Keeps the free tier free of any payment method (cleaner funnel) and makes "text your customers / send booking reminders" a concrete Freemium→Crew upgrade hook.
- **Crew / Business:** bundled monthly allowance (300 / 1000 messages) that rides the tier and is **capped**. Once the cap is hit, choose per-business: **soft-stop** (block further sends until next cycle) or **metered overage** (~10c/SMS) + top-up packs. The allowance is the cost ceiling; overage is opt-in. *(Open sub-choice: soft-stop vs. overage as the default.)*

**AI/GPT assist:** **not on Freemium** (it has no payment method, and GPT/Whisper carry real per-use cost). AI features — Smart Dispatch, Speech-to-Quote, lead/message extraction, video transcription — sit on **Business** (bundled with a fair-use cap) or as a **metered add-on** to Crew. Freemium users see them as locked upsells.

**Add-ons (flat, on top of any *paid* tier):**
- **Call recording** — flat monthly (per the locked decision; real per-use cost to us).
- **AI bundle** — metered usage, or a flat "unlimited-AI" add-on for Crew (Business bundles it under fair-use).

**Freemium funnel (resolves open question #2 — freemium chosen):**
- The **Freemium** (free) tier *is* the trial — no time limit, but single-user, hard-capped at 15 active jobs/month and max 3 photos/job, core features only. Upgrade prompts appear when a business hits the job cap, needs a second user, exceeds the photo limit, or taps a gated feature (SMS, safety, marketing).
- Optionally layer a **14-day Business trial** on top of Freemium for new sign-ups so they can feel the full product before the free caps bite — auto-reverts to Freemium (not data deletion) on expiry.
- Freemium businesses are still full tenants (their own `business` row, RLS-isolated) — freemium doesn't change the tenancy model, only the entitlement set.

**How this maps to the entitlements layer above:** each tier = one `subscriptionPlans` row; each ✅ feature = a capability key the plan unlocks; SMS allowance + call recording = `addOns` rows (one metered, one flat). The RBAC page then only lets an owner grant capabilities their tier has unlocked — e.g. `safety.*` is grantable on Crew/Business but shows a locked upsell on Freemium.

### Billing lifecycle — failed payments & downgrades

> Resolves the dunning gap + the over-cap question (#4). One policy covers failed payments, voluntary downgrades, and trial expiry — they all funnel to the same place: **drop to Freemium, never delete data.**

**Failed payment (dunning):**
1. Card declines → Stripe **Smart Retries** re-attempt over ~14 days (e.g. days 1, 3, 5, 7, 14). Subscription status → `past_due`.
2. During this window, **paid features stay ON** — don't punish a transient bank glitch. Owner gets an email + an in-app banner on each failed attempt prompting them to update their card (Stripe customer portal).
3. If no attempt succeeds by the end of the retry window → **auto-downgrade to Freemium**. No suspension, no lockout of the account itself, no data deletion.

**Voluntary downgrade** (Business→Crew→Freemium) and **trial expiry** use the identical downgrade path.

**Over-cap handling when landing on a smaller tier** (the #4 question — proposed default, your call):
- **Jobs over the cap:** existing jobs stay **read-only/viewable**; creating *new* jobs is blocked until they're back under the limit (or upgrade). Nothing is hidden or deleted.
- **Extra users:** seats beyond the new tier's limit are **deactivated** — on a drop to Freemium (1 user), the owner picks who keeps the single seat; the rest can't log in until re-upgrade.
- **Gated features** (SMS, safety, AI, marketing, integrations): lock to upsell prompts; any data they produced is retained and reappears on re-subscribe.
- **Re-subscribing instantly restores** full access — the data was never touched, just gated.

### Complete feature → tier mapping (derived from a 2026-06-02 code audit)

> Built by walking `client/src/components/AppSidebar.tsx`, all ~94 pages in `client/src/pages/`, and the route groups in `server/routes.ts` (~100+ groups, 30k lines). This is the real feature surface — the high-level table above is the summary; this is the line-by-line placement. **Placement is a proposal — the upsell hooks (what's free vs. what forces an upgrade) are a business call, not a code fact.**

| Module | Features (from code) | Freemium | Crew | Business |
|---|---|---|---|---|
| **Jobs & Dispatch** | Job dashboard, job cards, tasks/Kanban, activity dashboard, daily briefing | Jobs + tasks only | ✅ + dispatch board, job templates | ✅ |
| **AI Smart Dispatch** | `/ai-scheduler` (GPT) | — | — | ✅ *(AI add-on / fair-use)* |
| **Quoting & Proposals** | Quotes, quote viewer, follow-up automation, quoting-process settings, multi-item proposal builder, proposal viewer/accept | ✅ | ✅ | ✅ |
| **Speech-to-Quote** | `/api/speech-to-quote` (Whisper + GPT) | — | — | ✅ *(AI add-on)* |
| **Invoicing & Finance** | Invoices, invoice viewer, reconciliation, profitability calculator | Basic invoicing | ✅ + reconciliation, profitability | ✅ |
| **Scheduling** | Calendar, staff schedule, schedule events | Basic calendar | ✅ + staff schedule | ✅ |
| **Photos & media** | Photos, annotations, before/after, voice captions, public timeline link | Photos + annotations (max 3 / job) | ✅ Unlimited + captions, timeline | ✅ |
| **Videos** | Upload/playback (GCS), video transcription (Whisper) | — | ✅ playback/upload | ✅ + transcription *(AI add-on)* |
| **Safety & compliance** (13 modules) | Safety hub, toolbox talks, SWMS, pre-start checklists, equipment register, competency register, notifiable events, JHA, near-miss (+ attachments/witnesses/actions) | — | ✅ Full suite | ✅ + safety analytics |
| **Equipment** | Catalog, checkouts, maintenance, inductions, vehicle inspections | — | ✅ | ✅ |
| **Staff & permissions** | Staff management, assignments, competencies, time tracking, RBAC, permissions-management page | Defaults only (Admin/Crew) | ✅ Full custom RBAC + time tracking | ✅ |
| **Communications** | Email (transactional), SMS templates, comms templates, booking reminders, inquiry auto-reply, unified inbox | Transactional email only | ✅ templates, reminders, auto-reply, inbox | ✅ |
| **Calls / voice** | Call records, recording playback, in-app calling, unlinked calls (Twilio/Vonage) | — | — | — *(**flat add-on**, any tier)* |
| **Marketing & reputation** | Marketing planner, social plans, campaigns, reputation, reviews (Google/FB), price rules, blog/SEO | — | — | ✅ |
| **Documents** | Template builder, document builder, generated docs | — | ✅ | ✅ |
| **Analytics** | Dashboard stats, today metrics, man-hours, revenue stats/breakdown | Basic dashboard | Basic | ✅ Advanced + job costing |
| **Workflows / automation** | Workflow rules, automated triggers | — | — | ✅ |
| **Integrations** | Xero (accounting/payroll), Google Calendar, Gmail | — | ✅ Xero, Calendar, Gmail | ✅ + Mailchimp, Facebook |
| **Field specializations** | Tree removal, pruning, stump grinding, hedge trimming, mulch drops planners | ✅ (core job types) | ✅ | ✅ |
| **Help centre** | `/help` consumption (see `INFLOW_HELP_PLAN.md`) | ✅ | ✅ | ✅ |

**Cost-incurring features → add-ons (per the locked rule), regardless of tier:**
- **Call recording + in-app calling** (Twilio/Vonage voice) — flat monthly add-on + per-minute usage.
- **AI bundle** (smart dispatch, speech-to-quote, lead extraction from screenshots/messages, video transcription) — metered, or bundled into Business with a fair-use cap and sold as a flat add-on to Crew (not Freemium — no payment method).
- **SMS** — bundled allowance on paid tiers + metered overage (see SMS handling above).
- **Storage overage** (GCS photos/videos, 2 GB uploads) — watch as a future metered line if heavy-video tenants appear.

**Placement decisions that are genuinely yours to make (not derivable from code):**
1. Is the **safety suite** a Crew feature (as drafted) or a paid-everywhere differentiator? It's your biggest build and a strong upgrade hook — could justify its own tier or add-on.
2. Should **Xero** be Crew or Business-only? Accounting integration is a classic "serious business" gate.
3. Is **15 jobs/month + 1 user + 3 photos/job** the right Freemium cap for multi-day tree work, or does it strangle the funnel?
4. Does **AI** belong bundled-in-Business, or always a metered add-on (cleaner cost control)?

---

## Phased plan

### Phase 0 — Design + audit (read-only)
1. Lock the RLS-vs-pooler mechanism (the open question above) — prototype `SET LOCAL` in a per-request transaction against the Neon pooler.
2. Enumerate every table that needs `businessId` and every query in `routes.ts` that needs scoping (punch list).
3. Build the first cut of the capability catalog by walking the existing nav + routes.
4. Confirm tenant-resolution + onboarding flow shape.

### Phase 1 — Multi-tenancy foundation (data layer)
1. `businesses` table; make `businessSettings` per-tenant.
2. Add `businessId` to all domain tables (one big migration — **needs explicit DB approval per CLAUDE.md**).
3. Backfill: create the Treemarkables `business` row, stamp every existing row with its id.
4. Tenant-context middleware sets `businessId` + the RLS GUC per request; session carries `businessId`.

### Phase 2 — Tenant isolation hardening (highest-risk)
1. Add RLS policies on every table.
2. Retrofit explicit `businessId` filters across `routes.ts`.
3. Cross-tenant leakage tests — create two test businesses, assert zero bleed across every endpoint. This is the gate before a second real tenant touches the system.

### Phase 3 — Custom RBAC
1. `roles`, `rolePermissions`/`grantedCaps`, `employeePermissionOverrides` schema; migrate `employees.role` → `roleId` with seeded defaults.
2. Effective-permission resolver + `requireCapability` backend middleware.
3. Frontend `useCan()` / `<Can>` + nav gating.
4. The permissions settings page (Roles tab + Staff tab).

### Phase 4 — Subscriptions & billing
1. Stripe setup (NZD/GST), plan(s), add-ons, webhooks.
2. Entitlements layer wired into the capability catalog `requires` gating.
3. Trial + Stripe customer portal.
4. Self-serve business sign-up / onboarding.

### Phase 5 — Help centre → **spun out to `INFLOW_HELP_PLAN.md`**
This phase now has its own dedicated plan (written 2026-05-24, design decisions all locked). **Read `INFLOW_HELP_PLAN.md`, not this stub.** What was decided there since this doc was written:
- **Format resolved:** in-app `/help` (subscribers only, login-gated) + `/admin/help` TipTap authoring — *not* a public docs site or a third-party tool.
- **Video hosting:** self-hosted GCS (`treemarkables-photos`, `videos/` prefix); no YouTube/Loom.
- **~60% already built:** the `videos` table (`kind='knowledge'`), the GCS upload pipeline, and `POST/GET /api/videos` already exist. Net-new work is a `helpArticles` table, the `/help` consumption surface, and the authoring UI.
- **Tenancy alignment:** v1 ships a *global* article library for all subscribers; per-tenant SOPs are deferred (a possible future paid add-on, which would tie back into this doc's Phase 4 entitlements layer). The `canEditHelp` per-role permission is explicitly deferred until the multi-tenant RBAC (Phase 3 here) lands — so Phase 3 owes the help plan a capability key it's waiting on.
- **Sequencing:** the help plan can start independently (lowest architectural risk), but its per-role gating and per-tenant content both depend on this doc's RBAC + entitlements work.

### Phase 6 — Inflow brand + go-to-market
Migrate app to `inflowapp.co.nz`, public sales/marketing page, pricing page, sign-up funnel. Optional subdomain-per-tenant branding (`acme.inflowapp.co.nz`) with a wildcard cert.

---

## Gotchas

- **The Neon pooler + RLS interaction is the make-or-break detail.** A connection-scoped `SET app.current_business` leaks to the next request that reuses that pooled connection. Must be transaction-scoped. Get this right in Phase 0 or every later phase rests on sand.
- **Backend enforcement is non-negotiable.** Frontend `<Can>` hiding is cosmetic — anyone can call the API directly. Every gated action needs `requireCapability` server-side.
- **The `businessId` migration touches ~100 tables and the live prod DB.** Per CLAUDE.md, no `db:push` / migration without explicit user approval, and never change PK column types. Plan the migration as additive (add nullable `businessId` → backfill → set NOT NULL) to stay reversible.
- **Capability keys are an API contract.** Once a role stores `grantedCaps: ["jobs.edit"]`, renaming that key orphans the grant. Keys are append-only; deprecate, don't rename.
- **Entitlements ∩ permissions, in that order.** A staff member can have `calls.record` granted by their role but still not do it if the business dropped the Call Recording add-on. The resolver must intersect with live entitlements every request.
- **iOS shell is one webview at `app.treemarkables.co.nz` (per memory).** Session-derived tenancy works there unchanged; subdomain-per-tenant would need shell rework — another reason to defer it.

---

## Open questions (need user input)

1. ~~**Tier count + structure**~~ — **DECIDED 2026-05-30:** three tiers, Freemium (free) / Crew / Business (free entry + two paid). Draft in §Subscriptions.
2. ~~**Trial model**~~ — **DECIDED 2026-05-30:** freemium (the Freemium free tier is the trial), optional 14-day Business trial on top.
3. **Pricing** — Crew/Business NZD prices are draft placeholders; still need validation against cost-to-serve + willingness-to-pay. Add-on prices TBD.
4. **Help-centre format** — RESOLVED in `INFLOW_HELP_PLAN.md` (in-app `/help`).
5. **Subdomain branding** — worth the wildcard-cert complexity later, or stay single-domain?

---

## Current status

- **Phase 0:** in progress (started 2026-06-03). Done: driver/RLS finding (`neon-http`, no transactions); table punch list (`INFLOW_TENANCY_AUDIT.md`, ~116/126 tables get `businessId`); data-access centralisation measured (~88% via `storage.ts`); **RLS PoC run against the dev branch — proved RLS isolates correctly under a non-`BYPASSRLS` role AND found the app role `neondb_owner` has `rolbypassrls=true`, so today RLS would be a silent no-op.** Decisive new requirement: route tenant queries through a non-bypass role (Neon Authorize's `authenticated`). **Route A (Neon Authorize) chosen 2026-06-03** — see `INFLOW_RLS_ROUTES.md` (comparison) + `INFLOW_RLS_RUNBOOK.md` (steps). **Built:** dev RS256 keypair (in gitignored `.env`), `server/tenancy/` module (`tenantKeys`/`dbForRequest`/`tenantContext`/`jwksHandler`, all dormant — imported nowhere), key sign+verify round-trip smoke-tested. **Live JWT proof DEFERRED 2026-06-03** (user call) — core isolation already proven via PoC #2; the vendor-feature confirmation gets exercised when the Phase 1 middleware is wired. JWKS published to a gist for resume (see runbook). **Capability-catalog first cut done** → `server/tenancy/capabilities.ts` (~95 caps / 16 modules + Admin/Crew seed roles, dormant). **FK verification done** (33/37 parent guesses confirmed; 4 corrected incl. 2 soft-link tables flagged for special backfill). **Seed-table decision applied** (8 tables → nullable `businessId`, NULL=Inflow seed). **Phase 0 effectively complete** — the only deferred item is the live JWT proof (gets wired in Phase 1). **Phase 1 IN PROGRESS** (`INFLOW_PHASE1_MIGRATION.md` + `INFLOW_PHASE1_tenancy.sql`). ✅ Migration applied + validated on **dev** AND **PRODUCTION** (2026-06-05). 127 tables got `business_id` (119 NOT NULL + 8 nullable seed; backfilled to Treemarkables tenant #1; 127 FK constraints + defaults). Dev testing caught + fixed a break (NOT NULL needed a `DEFAULT`=TM-id to keep app inserts working — v2, non-breaking). Prod run: one transaction, validated (businesses=1, 127 cols, 0 nulls); `pre-tenancy-backup` branch retained as rollback. **Code retrofit underway (branch, undeployed):** ✅ `businessId` declared on all 127 tables in `schema.ts`/`timeTracking.ts` (optional in TS so existing inserts compile; DB default fills it); ✅ session carries `businessId` at login (`SessionData` + login handler). **Strategy decided 2026-06-05: lean on Phase 2 RLS for read isolation; do write-path stamping only** (no exhaustive 498-site read-filter grind). Built: `server/tenancy/tenantStore.ts` — AsyncLocalStorage tenant context (`runWithBusiness`/`currentBusinessId`/`withTenant`) + `tenantStoreMiddleware` mounted after session in `index.ts`. `withTenant()` stamps inserts with the request's business (falls back to DB default off-request). **Write-path retrofit COMPLETE 2026-06-05** (branch-only, undeployed): `withTenant()` applied to **every** insert into a tenant-scoped table — `storage.ts` 74 sites + `routes.ts` 27 sites = 101, zero misses. Correctly skips the only 2 non-tenant tables (`users`, `servicem8Config`). All changed files transpile (esbuild); ALS verified to survive `await`. Tooling guarded every wrap against the live schema (only wraps tables that actually have `businessId`), catching `servicem8Config` (not migrated) before it could break. **Read isolation deferred to Phase 2 RLS** (the agreed strategy). Now safe to deploy since prod columns exist. **Phase 2 (RLS) — Neon Authorize attempt FAILED (`jwk not found`, Neon proxy/JWKS too fragile), pivoted to FALLBACK which WORKS** (2026-06-05; `INFLOW_PHASE2_RLS.md` + `INFLOW_PHASE2_FALLBACK_rls.sql`). Fallback = `app_tenant` non-bypass role + GUC-based RLS policies on all 127 tables + a per-request pinned `neon-serverless` pool connection (`SET ROLE app_tenant` + `app.current_business`). App integration built (flag-gated `TENANT_RLS_ENABLED`): `db.ts` context-aware proxy + `acquireTenantDb`, `tenantMiddleware.ts` (pins/releases per request), `tenantStore.ts` (ALS carries businessId + pinned tenantDb). **Validated on real Dev tables** (customers 2371 / jobs 3612 / photos 29): tenant sees only its rows, other tenant sees 0, fail-closed, no GUC leak. No Neon proxy/JWKS dependency — pure Postgres. **Remaining (user-gated):** apply fallback SQL to prod + deploy (flag off) + flip `TENANT_RLS_ENABLED=true`. Design doc written 2026-05-22.
