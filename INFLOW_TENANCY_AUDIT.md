# Inflow — Tenancy Audit (Phase 0 punch list)

Companion to `INFLOW_SAAS_PLAN.md`. First-cut classification of all **126 tables** in
`shared/schema.ts` for the multi-tenant retrofit. Built 2026-06-03.

> **Status: first-cut proposal, needs verification.** The parent→child mappings below are
> inferred from table names, not yet checked against the actual foreign keys in
> `shared/schema.ts`. Verify FK columns before writing the migration. This is the
> "enumerate every table that needs `businessId`" Phase 0 deliverable.

---

## ⚠️ Phase 0 finding that changes the RLS mechanism

`server/db.ts` runs Drizzle on the **`neon-http` driver** — stateless, one HTTP request per
query, **no `db.transaction()` support** (confirmed by 4 in-code comments). It was chosen
deliberately to escape Neon's *"Connection terminated due to connection timeout"* errors.

**Consequence:** the SaaS plan's locked RLS mechanism — middleware does `SET LOCAL
app.current_business` inside a per-request transaction — **cannot work on `neon-http`.** There's
no session continuity between queries and no transaction to scope the GUC into.

**Chosen direction (2026-06-03):** lead with **app-level enforcement** (centralised in
`storage.ts`, which already carries ~88% of query volume — 1,141 `storage.*` calls in
`routes.ts` vs ~160 direct `db.*` sites), then add a **DB-level backstop via Neon Authorize
(JWT-based RLS)** which works statelessly because tenant context rides in a per-request JWT.

### ✅ Phase 0 PoC result (2026-06-03, run against the dev branch)

A contained PoC (throwaway `poc_rls` schema, dropped after) **proved the mechanism and found a
blocker the plan never anticipated:**

| Test | Result | Meaning |
|---|---|---|
| RLS on, query as `neondb_owner` | **3/3 rows returned (no filtering)** | 🚨 **The app's role `neondb_owner` has `rolbypassrls = true`** (via `neon_superuser`). RLS is a **silent no-op** for it. |
| RLS on, query as a non-bypass role `poc_tenant`, biz A context | 2 rows (only A) | RLS isolates correctly |
| same, biz B context | 1 row (only B) | RLS isolates correctly |
| same, **no** tenant context | **0 rows** | **Fail-closed** — a missing filter leaks nothing, exactly the backstop property we want |

**Decisive conclusions:**
1. **The role, not just the driver, is the blocker.** Any DB-level RLS — Neon Authorize *or*
   classic pooler — is worthless while queries run as `neondb_owner`. The app **must run
   tenant-scoped queries under a non-`BYPASSRLS` role** (Neon Authorize's `authenticated`, or a
   custom `app_tenant` role we create + grant table privileges to).
2. **The working mechanism on `neon-http`** is a per-request `SET LOCAL ROLE <non-owner>` +
   `set_config('app.current_business', …, true)` wrapping the queries in one batched transaction.
   **Neon Authorize does exactly this automatically** per HTTP request from the Bearer JWT — which
   is why it fits the stateless driver without rewriting the app to batch every request's queries.
3. **Fallback** (if the session→JWT adapter proves awkward): connect the app as a dedicated
   non-bypass `app_tenant` role and use the `neon-serverless` Pool driver with transaction-scoped
   `SET LOCAL`. Either way, **step one is getting off `neondb_owner` for tenant queries.**

> **New Phase 0 action:** provision a non-`BYPASSRLS` application role (or adopt Neon Authorize's
> `authenticated`), grant it least-privilege DML on all tenant tables, and route tenant-scoped
> queries through it. This is now the true first domino of Phase 1.

### Original direction note

A short Phase 0 PoC must confirm the session→JWT adapter (current auth is session-based via
`connect-pg-simple`, not JWT). Fallback if the PoC fails: switch Drizzle to the
`neon-serverless` WebSocket Pool driver and use classic transaction-scoped `SET LOCAL` RLS,
accepting the connection-timeout reliability regression.

---

## Legend

- **✅ root** — gets `businessId`, backfilled from the row's own data (top-level entity)
- **↳ parent** — gets a **denormalised** `businessId` (required: RLS policies can't efficiently
  filter through a join), backfilled via the named parent
- **⚑ decision** — global seed library vs per-business vs both; product call needed
- **⨯ exclude** — no `businessId` (legacy, global, or infra)

---

## ⨯ Excluded — no `businessId` (3 + infra)

| Table | Why |
|---|---|
| `users` | Legacy unused table (per SAAS plan) |
| `helpArticles` | Global help library for v1 (per `INFLOW_HELP_PLAN.md`); per-tenant SOPs are a deferred add-on — add nullable `businessId` then |
| `session` (not in schema, `connect-pg-simple`-managed) | Already keyed by session id |

---

## ⚑ Global seed library vs per-business (8) — **DECIDED 2026-06-03: nullable `businessId`**

**Decision applied (default accepted):** add a **nullable** `businessId`. `NULL` = global seed
row shipped by Inflow; non-null = a business's own customisation. RLS policy:
`business_id IS NULL OR business_id = current_business`. Ships a starter library every tenant sees
while letting them add their own.

| Table | Note |
|---|---|
| `jhaHazardTemplates` | Hazard library — shared Inflow-curated seed set |
| `jhaControlMeasureTemplates` | Control-measure library |
| `jhaRiskControlTemplates` | Risk/control library |
| `toolboxTalkTopics` | Safety talk topics — global seed + per-business custom |
| `competencyTypes` | Competency catalog — global standard set |
| `materials` | Material/price catalog — per-business pricing on top of seed defaults |
| `services` | Service catalog — same as materials |
| `roleChecklistTasks` | **Reclassified from child (2026-06-03 FK check):** has `isBuiltIn` + `roleKey`, no parent FK. `isBuiltIn=true` rows → seed (NULL); custom → business |

---

## ✅ Direct `businessId` — top-level entities (root backfill)

Core domain:
`customers`, `customerImportBatches`, `customerAuth`, `leads`, `quotes`, `jobs`, `tasks`,
`proposals`, `invoices`, `payments`, `serviceRequests`, `treeMarkers`, `mulchDrops`

People & org:
`teams`, `employees`, `roleTiers`, `jobStaffAssignments`, `scheduleEvents`, `apiKeys`

Media & docs:
`photos`, `videos`, `documentTemplates`, `generatedDocuments`, `jobTemplates`

Comms & marketing:
`calls`, `callRecords`, `communications`, `conversations`, `campaigns`, `marketingCampaigns`,
`socialPlans`, `competitorSignals`, `priceRules`, `reviews`, `reviewRequests`, `activities`,
`emailTemplates`, `smsTemplates`, `communicationTemplates`, `communicationRules`,
`bookingReminders`, `notifications`, `notificationQueue`, `assistantMessages`,
`pendingOutboundMessages`

Equipment & inventory:
`equipment`, `inventory`, `vehicleInspections`, `inspectionTemplates`, `inductionTemplates`,
`equipmentInductions`

Safety & compliance:
`safetyIncidents`, `riskAssessments`, `complianceRequirements`, `complianceRecords`,
`jhaAssessments`, `nearMissReports`, `toolboxTalks`, `prestartChecklistTemplates`,
`prestartChecklists`, `safetyAssets`, `swmsTemplates`, `swmsDocuments`, `notifiableEvents`,
`checklistTemplates`, `quotingProcessSteps`, `employeeCompetencies`

Analytics & config:
`businessReports`, `kpiMetrics`, `performanceAnalytics`, `financialAnalytics`,
`reportAnalytics`, `dashboardConfigs`, `dailyBriefings`

Integrations & devices:
`xeroConnections`, `xeroSettings`, `fcmTokens`, `notificationPreferences`,
`communicationPreferences`

Settings root (special — becomes one row per tenant):
`businessSettings`

---

## ↳ Denormalised `businessId` — child tables (backfill via parent)

| Child table | Backfill via parent |
|---|---|
| `customerContacts` | `customers` |
| `proposalSections` | `proposals` |
| `proposalLineItems` | `proposalSections` |
| `proposalLineItemChoices` | `proposalLineItems` |
| `photoAnnotations` | `photos` **via `sourceUrl` string match — NO FK (verified 2026-06-03). Soft-link backfill: join `source_url` = photo URL** |
| `invoiceSections` | `invoices` |
| `invoiceLineItems` | `invoices` **(direct FK — verified 2026-06-03, not via invoiceSections)** |
| `templateSections` | `documentTemplates` |
| `templateLineItems` | `templateSections` |
| `templatePhotos` | `documentTemplates` |
| `generatedDocumentLineItems` | `generatedDocuments` |
| `generatedDocumentPhotos` | `generatedDocuments` |
| `jobDiaryEntries` | `jobs` |
| `jobChecklistCompletions` | `jobs` |
| `jobQuotingProcessCompletions` | `jobs` |
| `dailyJobNotes` | `jobs` |
| `conversationMessages` | `conversations` |
| `emailEvents` | `communications` **via `messageId` (Resend id) — NO FK (verified 2026-06-03). Soft-link backfill: match `message_id` to the originating send, else by `recipient`→customer** |
| `reviewSubmissions` | `reviewRequests` |
| `equipmentMaintenance` | `equipment` |
| `equipmentCheckouts` | `equipment` |
| `inventoryTransactions` | `inventory` |
| `inspectionChecklistItems` | `inspectionTemplates` |
| `inspectionResponses` | `vehicleInspections` |
| `inductionChecklistItems` | `inductionTemplates` |
| `inductionResponses` | `equipmentInductions` |
| `jhaSteps` | `jhaAssessments` |
| `jhaStepControls` | `jhaSteps` |
| `jhaSignatures` | `jhaAssessments` |
| `swmsSteps` | `swmsDocuments` |
| `swmsSignatures` | `swmsDocuments` |
| `nearMissAttachments` | `nearMissReports` |
| `nearMissWitnesses` | `nearMissReports` |
| `nearMissActions` | `nearMissReports` |
| `toolboxTalkAttendees` | `toolboxTalks` |
| `assetInspections` | `safetyAssets` |

---

## Counts (first cut)

| Bucket | Count |
|---|---|
| ✅ Direct `businessId` (root) | ~73 |
| ↳ Denormalised child | ~35 |
| ⚑ Nullable (global-seed-able) | 8 |
| ⨯ Excluded | 3 |
| **NEW: `businesses` tenant root** | +1 |

≈ **116 of 126 tables get a `businessId` column** — consistent with the plan's "~100 of 110"
estimate, scaled to the current 126.

### FK verification result (2026-06-03)

Parsed every child table's `.references()` in `shared/schema.ts`: **33/37 parent guesses confirmed.**
Four corrections (all now reflected above):
- `invoiceLineItems` → `invoices` directly (not `invoiceSections`).
- `photoAnnotations` → soft link to photos via `sourceUrl` (no FK) — special backfill.
- `emailEvents` → soft link via `messageId` (no FK) — special backfill.
- `roleChecklistTasks` → reclassified to the nullable-`businessId` seed bucket (no parent FK; has `isBuiltIn`).

**Migration note:** the two soft-link tables (`photoAnnotations`, `emailEvents`) can't be backfilled
by a simple FK join — flag them for explicit handling in the Phase 1 migration script.

---

## Next Phase 0 steps (unblocked, read-only)

1. **Verify FK columns** for every ↳ row against `shared/schema.ts` (some parents guessed by name).
2. **Resolve the 7 ⚑ decisions** with the user (global seed vs per-business).
3. **Neon Authorize PoC** — prove a session→short-lived-JWT adapter works with `neon-http` + an
   RLS policy on one table. This is the gate before committing the isolation backstop.
4. **Audit the ~160 direct `db.*` sites** in `routes.ts` that bypass `storage.ts` — these are the
   spots most likely to miss a tenant filter once app-level enforcement lands.
5. **Capability-catalog first cut** — walk `AppSidebar.tsx` + the route groups (feeds Phase 3 RBAC).
