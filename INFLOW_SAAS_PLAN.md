# Inflow — Multi-Tenant SaaS Plan

Active initiative as of 2026-05-22. Turn the single-business Treemarkables app into **Inflow**, a multi-tenant SaaS sold to other tree-services businesses.

This is the design + handoff doc for that work, in the same spirit as `MIGRATION_PLAN.md`. Read it before touching tenancy, roles, or billing code.

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
| Isolation backstop | Postgres Row-Level Security (RLS) + per-request tenant context, *in addition to* explicit `businessId` filters | **Locked (mechanism), open (pooler interaction)** | A 22k-line `routes.ts` with mostly hand-written queries *will* miss a `WHERE businessId=` somewhere. RLS makes a forgotten filter a non-event instead of a cross-tenant data leak. |
| Tenant resolution | Session-derived `businessId` (from the logged-in employee's row) — **not** subdomain, for v1 | **Locked** | The iOS shell loads one webview; subdomain-per-tenant adds wildcard-cert + DNS complexity for no v1 benefit. Subdomain branding can come later. |
| Roles | Replace the hardcoded `role` enum (`admin`/`crew`) with a per-business `roles` table + a code-defined capability catalog | **Locked** | "Every little feature has a toggle" is impossible with a 2-value enum. |
| Permission storage | Role grants + per-employee overrides; effective = role grants, then employee allow/deny applied on top | **Locked** | Satisfies "per role *and* per staff member." |
| Entitlements vs permissions | Two layers: subscription (what the *business* paid for) gates which capabilities are *available*; RBAC (what each *staff* can do) gates within that | **Locked** | Ties billing → add-ons → toggles together. You can't grant `calls.record` if the business hasn't bought the Call Recording add-on. |
| Billing provider | Stripe, NZD, GST-inclusive | **Locked** | Standard SaaS billing; NZ tax handled. (Note: customer *invoicing* already exists and is unrelated — this is subscription billing.) |
| Tier count | TBD — possibly one membership + add-ons | **OPEN — user deciding** | — |
| Cost-incurring features | Sold as add-ons (call recording, SMS, anything with per-use cost to us) | **Locked** | — |
| Trial / freemium model | TBD | **OPEN** | — |
| Pricing (NZD per tier / add-on) | TBD | **OPEN** | Drives Stripe product setup + sales-page copy. |
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

1. **Tier count + structure** — one membership, or two/three? (User deciding.)
2. **Trial model** — free trial, freemium, or paid-only?
3. **Pricing** — NZD base price + per-add-on prices (drives Stripe + sales page).
4. **Help-centre format** — in-app static, embedded docs tool, or contextual walkthroughs?
5. **Subdomain branding** — worth the wildcard-cert complexity later, or stay single-domain?

---

## Current status

- **Phase 0:** not started — design doc written 2026-05-22.
