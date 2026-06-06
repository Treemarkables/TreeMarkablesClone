# Inflow — Trade Generalization Plan

Active initiative as of 2026-06-06. Make Inflow trade-agnostic so **plumbers, electricians, builders** (and any other field-service trade) can subscribe and use the app without ever seeing tree/arborist assumptions or the word "Treemarkables".

This is the companion to `INFLOW_SAAS_PLAN.md`. That doc makes a *second business* possible (multi-tenancy, RBAC, billing). This doc makes a *second trade* possible. They are different problems: a perfectly isolated second tenant that still calls every job a "tree removal" and signs every email "The Treemarkables Team" will churn on day one. Read both before touching onboarding, seed data, AI prompts, or templates.

> **Status: design phase.** Nothing below is built yet. Treemarkables remains tenant #1 and keeps its exact current behaviour — every default in this plan is chosen so that Treemarkables, on the `tree` preset, looks identical to today. Generalization is *additive*: we replace literals with per-business values whose defaults reproduce current behaviour.

---

## The principle

**Nothing is hardcoded to Treemarkables or to tree work. Everything a subscriber sees is either (a) their own configured value, or (b) a default seeded from the trade they picked at signup, which they can then edit.**

Three distinct kinds of "tree-ness" are baked into the code today, and each needs a different fix:

1. **Identity literals** — the strings "Treemarkables", "Jules", the logo, the phone number, the footer "Qualified Arborists". These should already come from `businessSettings`; many don't. **Fix: tokenize — read from settings, never from a literal.**
2. **Trade catalogs** — the *lists* a trade works from: service/job types, equipment types, staff position types, safety hazards & SWMS templates, default job descriptions. A plumber's list is different from an arborist's. **Fix: move from code enums into per-business data, seeded from a trade preset at signup, editable after.**
3. **AI prompt context** — GPT/Whisper prompts that literally say "You are Jules, owner of Treemarkables, a NZ arborist business" and list arborist vocabulary. **Fix: build the business/trade context from settings at call time; no literal trade or business name in any prompt.**

---

## End state

- At signup the owner picks a **trade** (Tree services / Plumbing / Electrical / Building / General). That choice seeds their job types, equipment types, staff roles, safety templates, default descriptions, and AI vocabulary from a **trade preset** — a starting point, fully editable afterward.
- Every customer-facing string (emails, SMS, proposals, PDFs, auto-reply, footers) renders the subscriber's own business name, contact details, logo, and sign-off. No "Treemarkables" or "Jules" anywhere unless that *is* the subscriber.
- Every AI feature describes *this* business and *this* trade — a plumber's speech-to-quote understands "rough-in, PEX, hot-water cylinder, backflow", not "stump grind, mulch, firewood lengths".
- Treemarkables runs on the `tree` preset and is visually/behaviourally unchanged.
- A trade the preset library doesn't cover still works on the **General** preset (generic field-service catalogs) — the app is never *blocked* on a missing preset, only less tailored.

---

## Decisions

| Concern | Decision | Status | Rationale |
|---|---|---|---|
| Generalization strategy | Trade **presets** (seed packs) that populate per-business editable data — not per-trade code branches | **Proposed** | `if (industry === 'plumbing')` scattered through 22k lines is unmaintainable. A preset seeds data once; the app stays trade-neutral. |
| Where trade lives | `industry` (preset key) on `businessSettings` (already per-tenant) | **Proposed** | `businessSettings` is already per-business (Phase 1). One column, not a new table. |
| Catalogs as data | Service types, equipment types, staff positions, safety templates become per-business rows seeded from the preset; today's hardcoded enums become the `tree` preset's contents | **Proposed** | "Customizable to the subscriber" is impossible while these are TS string unions. |
| Identity literals | Always read from `businessSettings` (name/phone/email/logo/footer/sign-off); literals are bugs | **Proposed** | A subscriber must never see another business's name. |
| AI prompts | A single `buildBusinessContext(settings)` helper injects business name + trade + trade-vocabulary into every prompt; zero hardcoded trade terms | **Proposed** | One place to get right; scales to every new trade for free. |
| Default trade | New business with no choice → **General** preset (generic field-service) | **Proposed** | Never block onboarding on preset coverage. |
| Treemarkables behaviour | `tree` preset reproduces every current default exactly | **Locked** | Live business must not change. |
| Preset depth at launch | Ship **Tree, Plumbing, Electrical, Building, General** at v1; add trades as data, no code change | **Proposed** | These are the named target trades + a fallback. |

---

## Data model

### 1. The trade selector — one field

```
businessSettings
  industry  text not null default 'tree'   -- preset key: tree | plumbing | electrical | building | general
```

`businessSettings` is already per-tenant (Phase 1), so this is a single additive column. `default 'tree'` means Treemarkables and every existing row stays on the tree preset with no backfill surprise. **(Additive nullable→default, no PK change — safe per CLAUDE.md; still needs explicit DB approval.)**

### 2. Trade presets — code-defined, data-shaped

A registry in code (mirrors the `capabilities.ts` pattern from the SaaS plan — code is the source of truth, ships with features):

```
// server/trades/presets.ts  (new)
{
  key: "plumbing",
  label: "Plumbing",
  serviceTypes:     ["new_install", "repair", "drainage", "hot_water", "blocked_drain", "maintenance", "other"],
  equipmentTypes:   ["van", "drain_camera", "jetter", "pipe_locator", "hand_tools", "power_tools"],
  staffPositions:   ["plumber", "apprentice", "drainlayer", "estimator", "office"],
  safetyHazards:    ["confined_space", "asbestos", "hot_works", "trenching", "water_damage", ...],
  jobDescriptions:  { repair: "Plumbing repair and diagnosis", ... },   // speech-to-quote fallbacks
  aiVocabulary:     "rough-in, PEX, copper, hot-water cylinder, backflow, isolation valve, drainage, jetting",
}
```

The current hardcoded arborist lists become the `tree` preset verbatim. Adding a trade = adding one object, no schema or route changes.

### 3. Configurable catalogs — preset seeds, business edits

The catalogs that vary by trade move from TS unions / inline arrays into per-business rows, **seeded from the chosen preset at signup**, then editable in settings:

| Catalog | Today | Becomes |
|---|---|---|
| Service / job types | `serviceType` free-text + arborist comments ([schema.ts:1790](shared/schema.ts:1790), [2573](shared/schema.ts:2573)) | per-business `serviceTypes` (seeded from preset) |
| Equipment types | enum `chainsaw/chipper/stump_grinder/ewp/rigging` ([schema.ts:2595](shared/schema.ts:2595)) | per-business `equipmentTypes` |
| Staff positions | `arborist/ground_crew/foreman/driver` ([schema.ts:1628](shared/schema.ts:1628)) | per-business `staffPositions` |
| Safety hazards / SWMS / toolbox topics | arborist seed rows ([schema.ts:4353](shared/schema.ts:4353)+) | seeded from preset (the 8 nullable seed tables already exist — see SaaS plan) |
| Default job descriptions | inline arborist strings ([routes.ts:5020](server/routes.ts:5020)) | preset `jobDescriptions` |

> **Lever already in place:** the SaaS-plan Phase 1 migration made 8 seed tables (`jhaHazardTemplates`, `toolboxTalkTopics`, `competencyTypes`, `materials`, `services`, …) carry a **nullable** `businessId` where `NULL = Inflow global seed`. That mechanism is exactly what per-trade seeding needs — seed the preset's rows per business on signup instead of relying on a single global set.

---

## Inventory of hardcoded surfaces

What has to change, grouped by the three fix-types. File refs are representative, not exhaustive — a full grep sweep is Phase A.

### A. Identity literals → read from `businessSettings`

| Surface | Location | Current literal |
|---|---|---|
| Job-assignment emails | [routes.ts:605–719](server/routes.ts:605) | "Treemarkables Team", `'Tree Service'` fallback title |
| Proposal/invoice PDF | [routes.ts:906](server/routes.ts:906), [1049](server/routes.ts:1049), [1103](server/routes.ts:1103) | logo path, "Treemarkables LTD — Qualified Arborists", hardcoded phone/email |
| Inquiry auto-reply defaults | [schema.ts:1334–1336](shared/schema.ts:1334) | "We've received your inquiry — Treemarkables", "Jules will be in touch" |
| Comms/SMS seed templates | [seedTemplates.ts:20–171](server/seedTemplates.ts:20) | "tree service", "Treemarkables Team" (some already `{businessName}`-tokenized — finish the job) |
| Fallback logo | [routes.ts:438](server/routes.ts:438), [459](server/routes.ts:459), [507](server/routes.ts:507) | `treemarkables-logo.png` |
| Cookie / domain | [routes.ts:1736](server/routes.ts:1736), [1854](server/routes.ts:1854) | `treemarkables.sid`, `.treemarkables.co.nz` (tenancy/infra — out of scope here, note only) |

**Approach:** every customer-facing render pulls `businessName`, `businessPhone`, `businessEmail`, `businessLogo`, plus a new `emailSignoff` / `businessTagline` (replacing "Qualified Arborists") from `businessSettings`. Defaults reproduce Treemarkables today. The auto-reply path already does `.replace(/\{businessName\}/g, …)` at [routes.ts:2800](server/routes.ts:2800) — extend that tokenization (`{businessName}`, `{tagline}`, `{contactName}`) across all templates and kill the literal defaults.

### B. Trade catalogs → preset-seeded per-business data

`serviceType` values, equipment types, staff positions, safety templates, default job descriptions — see the Data Model table above. Speech-to-quote regex/keyword matching ([routes.ts:4881–4895](server/routes.ts:4881)) and default descriptions ([routes.ts:5020–5029](server/routes.ts:5020)) read from the preset, not inline arborist arrays.

### C. AI prompt context → `buildBusinessContext(settings)`

Every prompt that names the trade or business:

| Prompt | Location | Current |
|---|---|---|
| Contact extraction | [routes.ts:3005](server/routes.ts:3005) | "a tree removal/arborist company … called Treemarkables" |
| SMS screenshot parse | [routes.ts:3091](server/routes.ts:3091) | "for a tree removal/arborist company" |
| Speech-to-quote | [routes.ts:7761](server/routes.ts:7761), [7796](server/routes.ts:7796) | "dismantle, stump grind, mulch, chip, firewood lengths"; "NZ tree services company" |
| AI assistant persona | [routes.ts:8137](server/routes.ts:8137), [8241](server/routes.ts:8241) | "You are Jules, the owner of Treemarkables, a NZ arborist business" |

**Approach:** one helper builds `"You are an assistant for {businessName}, a New Zealand {tradeLabel} business. Relevant work includes: {aiVocabulary}."` from settings + preset. No prompt contains a literal trade term or business name again. The persona prompts drop "Jules" in favour of `contactName` from settings.

---

## Phased plan

This slots alongside `INFLOW_SAAS_PLAN.md`'s phases. **Track A (identity tokenization) and Track C (AI context) have no schema dependency and can start now** — they're pure literal-removal that benefits Treemarkables immediately (cleaner config). Track B (catalogs) depends on the per-business seed mechanism and rides with SaaS Phase 4 onboarding.

### Phase A — Identity de-hardcoding (no DB change)
1. Grep sweep for "Treemarkables", "arborist", "Jules", "Qualified Arborists", "Tree Service", the logo path — full inventory.
2. Add `businessTagline` / `emailSignoff` / `contactName` to `businessSettings` (additive) defaulting to today's Treemarkables values.
3. Route every customer-facing render (emails, PDFs, SMS, auto-reply) through settings + token replacement. Kill literal defaults.
4. Verify: Treemarkables output is byte-identical.

### Phase B — Trade presets + configurable catalogs (rides SaaS Phase 4)
1. `industry` column on `businessSettings` (`default 'tree'`).
2. `server/trades/presets.ts` — Tree, Plumbing, Electrical, Building, General. Tree = current arborist lists verbatim.
3. Move service types / equipment types / staff positions / default descriptions from enums/inline arrays to per-business catalogs seeded from the preset (reuse the nullable-`businessId` seed-table mechanism).
4. Signup flow (SaaS Phase 4) seeds the chosen preset's rows into the new business.
5. Settings UI to edit any catalog after seeding.

### Phase C — AI context builder (no DB change beyond Phase A)
1. `buildBusinessContext(settings)` helper.
2. Replace the literal trade/business strings in all prompts ([routes.ts:3005](server/routes.ts:3005), [3091](server/routes.ts:3091), [7761](server/routes.ts:7761), [7796](server/routes.ts:7796), [8137](server/routes.ts:8137), [8241](server/routes.ts:8241)) with the helper + preset `aiVocabulary`.
3. Verify: on the tree preset, prompts read equivalently to today.

### Phase D — Preset polish & onboarding UX
1. Trade picker in the signup funnel (SaaS Phase 4).
2. Per-trade safety/SWMS/toolbox seed packs (the biggest content lift — can grow trade-by-trade post-launch).
3. Per-trade marketing/sales copy on `inflowapp.co.nz` (SaaS Phase 6).

---

## Gotchas

- **Defaults must reproduce Treemarkables exactly.** Every new column defaults to the current literal; every preset move keeps `tree` = today. The live business is the regression test — its output must not shift by a character.
- **Don't branch on `industry` in route logic.** The whole point of presets is that the *data* differs, not the *code*. An `if (industry === …)` in `routes.ts` is the anti-pattern this plan exists to avoid. Industry selects a seed pack; the app stays trade-neutral.
- **`serviceType` is free-text today, not a DB enum** — generalizing it is low-risk (no enum migration), but the UI dropdowns and any switch statements that assume the arborist set need auditing.
- **Safety/SWMS content is the long pole.** Real plumbing/electrical SWMS and hazard libraries are domain content, not code. Ship `General` safety as a baseline and grow per-trade packs incrementally — don't gate launch on complete safety coverage for every trade.
- **Tenancy literals (`treemarkables.sid` cookie, `.treemarkables.co.nz` domain) are infra, not trade** — they belong to the SaaS-plan Phase 6 brand/domain move, not here. Listed for completeness only.
- **Additive migrations only.** New columns are nullable-with-default; no PK changes; explicit DB approval per CLAUDE.md before any `db:push`.

---

## Open questions (need user input)

1. **Preset list at launch** — Tree, Plumbing, Electrical, Building, General. Add others (HVAC, landscaping, painting, roofing) now, or grow as customers ask?
2. **How editable?** Should owners be able to *add* their own service/equipment types beyond the preset (free-form), or only toggle the preset's set? (Recommend free-form add — it's the "fully customizable" ask.)
3. **Safety depth per trade** — ship `General` safety for non-tree trades at launch and build real per-trade SWMS later, or hold trade launches until their safety pack is real?
4. **Multi-trade businesses** — a firm doing both plumbing *and* drainage (or building + handyman). One preset with edits, or support multiple trades per business? (Recommend one preset + free-form edits for v1.)
5. **"Jules" persona** — should the AI assistant persona use the owner's name (`contactName`) generically, or a neutral "your assistant" voice across all trades?

---

## Relationship to `INFLOW_SAAS_PLAN.md`

| Concern | SaaS plan | This plan |
|---|---|---|
| Second **business** can exist | ✅ (tenancy, RBAC, billing) | — |
| Second **trade** can exist | — | ✅ (presets, tokenization, AI context) |
| Signup flow | Phase 4 creates the `business` row | Phase B seeds the trade preset into it |
| Seed tables (nullable `businessId`) | Built in Phase 1 | Reused to seed per-trade catalogs |
| `businessSettings` per-tenant | Phase 1 | Host for `industry` + identity fields |

**Sequencing:** Phases A and C can land before SaaS Phase 4 (they only de-hardcode, benefiting Treemarkables). Phase B's seeding hooks into the SaaS Phase 4 signup flow — so trade generalization is *substantially independent* and only joins the SaaS track at onboarding.

---

## Phase A — Part 2: email sending domain (deferred task)

Phase A "Part 1" de-hardcodes the *content* of emails (footer, body, AI persona) — done via `getBusinessIdentity()`. The *from / reply-to addresses* are a separate, deliverability problem and are **not** done yet. Captured here so it can be picked up cleanly.

**The decision (made 2026-06-06):** use the **shared-domain model** (what ServiceM8-style tools do — simplest for the client, zero setup on their end):
- Send `from: "{businessName}" <noreply@inflowapp.co.nz>` — the subscriber's business name as the **display name**, on Inflow's verified domain.
- Set `reply-to = {businessEmail}` so customer replies go to the subscriber.
- The subscriber configures **nothing** — they just fill in business name + email in settings (already wired).

**Why not just swap to the subscriber's email:** you can only send "from" a domain verified in Resend; sending from an arbitrary `info@theirbusiness.co.nz` bounces / lands in spam.

**The task (when ready):**
1. **One-time platform setup:** verify `inflowapp.co.nz` (or `mail.inflowapp.co.nz`) as a sending domain in Resend (DNS records). Done once, for all subscribers.
2. **Code:** in `server/services/emailService.ts`, change `defaultFromEmail` to `"{businessName}" <noreply@inflowapp.co.nz>` (built from settings) and set `replyTo` to `businessSettings.businessEmail` when no job-specific reply address applies. Today's reply routing (`job-{n}@jobs.treemarkables.co.nz` → Gmail) is Treemarkables-specific infra — keep it for TM, fall back to the per-business `reply-to` for everyone else.
3. **Treemarkables stays as-is** (its own domain is already verified) — only *new* trades use the shared domain.

**Effort:** small code change; the gate is the one-time Resend domain verification. **Not blocking** — email content is already trade-neutral; this only changes the envelope addresses.

### Remaining Phase A — Part 1 follow-ups (mechanical, same `getBusinessIdentity()` pattern)
- `emailService.ts` — 4 job-status text emails ("tree service", "Treemarkables Team"). Needs care: don't import `storage` into the service (circular-import risk) — pass identity in, or fetch at the caller.
- `routes.ts` — ~20 scattered HTML email-signature literals.
- PDF footers (`routes.ts` proposal/invoice generation) — "Treemarkables LTD — Qualified Arborists" + contact line → use `getBusinessIdentity()` (`name`, `tagline`, `phone`, `email`).
- **Customer-facing document viewers** (`ProposalViewer`/`ProposalAccept`/`InvoiceViewer`/`QuoteViewer`) — ⚠️ **bigger than a literal swap.** These are **public routes** (`/proposal/:id`, `/invoice/:id`, `/quote/:id`) opened by customers who are **not logged in**, so they can't call `/api/business-settings`. The identity must instead be **included in the document API payload** (`/api/proposals/:id/public`, `/api/invoices/:id`, the `DocumentTemplate` object) — then the viewers read it instead of the hardcoded fallbacks (`companyPhone: '+64 6 867 1234'`, `quotes@treemarkables.nz`, etc.). A **server-payload + client** slice — scope it as its own effort. ⚠️ **Also entangled with multi-tenancy:** the public request has no session, so the server must resolve **which business's** identity from the document's `businessId` — i.e. a `getBusinessSettings(businessId)`-scoped fetch (the keystone single-tenant-debt refactor, [[project_phase4_billing_shipped]] tenancy work). That's actively being built by parallel efforts (recent "multi-tenant isolation" commits), so this slice should **wait for that to settle** rather than collide with it.
- Client-side admin template defaults (`ProposalBuilder`/`TemplateManagement`/`EmailComposerModal`) — hardcoded phone/email/owner form defaults (admin-side, lower priority).
- **GST number** — the branded-email footer + PDFs still use `COMPANY.gstNumber` (Treemarkables' GST). Needs a `businessGstNumber` settings field before it's truly per-business.
- The 2 AI **extraction** prompts (`routes.ts` contact-extraction + SMS-screenshot) — `content:`/`text:` inside request objects; need the identity fetch hoisted to the handler top.
