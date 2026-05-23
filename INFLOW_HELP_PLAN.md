# Inflow Help Page — Plan

Subscriber-facing help & training hub. How-to videos + written SOPs, organised so a Day-1 subscriber knows exactly which step comes first, second, third.

Locked decisions (from initial planning conversation, 2026-05-24):
- **Audience:** subscribers only, gated behind login. Lives in-app at `/help`.
- **Video hosting:** self-hosted in the existing GCS bucket (`treemarkables-photos`, `videos/` prefix). No YouTube/Loom dependency.
- **Day-1 seed content:** Account + business setup. Other sequences (staff/roles, first quote → job → invoice, safety) come in later content waves.
- **Authoring editor:** TipTap WYSIWYG, persisting markdown to `helpArticles.bodyMarkdown` (DB stays portable, UX stays owner-friendly).
- **Admin gate:** owner-role only for v1. Add a `canEditHelp` per-role permission later when multi-tenant SaaS lands.
- **Tenancy:** global library only for v1 (one set of articles for all subscribers). Per-tenant SOPs deferred — potentially a future paid add-on.
- **Video upload entry point:** the existing Videos page keeps its upload flow for job-attached videos; add a second "Upload knowledge video" button inside `/admin/help` that hits the same `POST /api/videos` backend — no fork, but contextual UX where the author is working.

---

## 1. What already exists

| Piece | Where | Status |
|---|---|---|
| GCS video upload (stream-to-bucket, no RAM spike) | `server/videoStorage.ts` | Done |
| `videos` table with `kind='knowledge'`, `category`, `sequenceOrder`, `description` | `shared/schema.ts` (`videos`) | Done |
| `POST /api/videos` accepts `kind=knowledge` uploads | `server/routes.ts:7143` | Done |
| `GET /api/videos?kind=knowledge` filtered list | `server/routes.ts:7194` | Done |
| Public playback route | `server/routes.ts:7118` + `GET /objects/videos/:filename` | Done |
| Staff Videos library (job + knowledge) | `client/src/pages/Videos.tsx` | Done — but it's a library/admin view, not the subscriber help page |

**Net:** all the video pipework is in place. We're adding a *consumption surface*, an *SOP/article content type*, and *light authoring polish*.

---

## 2. What's new

### 2.1 New content type: SOP articles
Videos alone won't cover every step (some are checklists, settings tours, screenshots). Add a sibling table `helpArticles` so we can mix videos and written SOPs in the same categorised feed.

Proposed schema (`shared/schema.ts`):
```ts
helpArticles = pgTable("help_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),         // "set-up-your-business-details"
  title: text("title").notNull(),
  category: text("category").notNull(),          // matches videos.category vocab
  bodyHtml: text("body_html").notNull(),         // TipTap HTML output, sanitized with DOMPurify on render
  sequenceOrder: integer("sequence_order").default(0),
  relatedVideoIds: text("related_video_ids").array(), // optional: embed videos inline
  published: boolean("published").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
```
HTML body matches TipTap's native output (already in deps, no new lib). DOMPurify (also already in deps) sanitizes before render.

### 2.2 New subscriber view: `/help`
Wouter route, gated by `useAuth`. Layout:

```
┌─ Header ──────────────────────────────────────────┐
│  Help & Training                                   │
│  [Search ──────────────────] (search v2, not v1)   │
├─ Getting Started (sequenced) ─────────────────────┤
│  1. Set up your business details      [▶ video]    │
│  2. Add your logo & branding          [📄 article] │
│  3. Configure default pricing & tax   [📄 article] │
│  ...                                               │
├─ Reference (by category, alpha) ──────────────────┤
│  ▸ Jobs                                            │
│  ▸ Quotes & Invoicing                              │
│  ▸ Staff & Permissions                             │
│  ▸ Safety                                          │
│  ▸ Customers & CRM                                 │
└────────────────────────────────────────────────────┘
```

Item detail view: video player (if video) + markdown body + "next step" link to keep momentum through the sequence.

### 2.3 Admin authoring UI: `/admin/help`
Owner-only (role check). Two tabs:
- **Articles** — list, create, edit (markdown textarea + live preview), drag-to-reorder within category, publish toggle.
- **Knowledge videos** — list of `videos WHERE kind='knowledge'`, edit title/description/category/sequenceOrder, link related articles. (Upload itself can stay in the existing Videos page or get a button here — pick one to avoid two surfaces.)

### 2.4 New API routes (`server/routes.ts`)
- `GET /api/help/articles` — subscriber-facing, returns published only, grouped by category
- `GET /api/help/articles/:slug` — single article + related videos resolved
- `POST /api/help/articles` (admin) — create
- `PATCH /api/help/articles/:id` (admin) — edit / publish / reorder
- `DELETE /api/help/articles/:id` (admin)

Reuse existing `/api/videos?kind=knowledge` for the video side.

---

## 3. Category vocabulary (v1)

Fixed list so videos and articles align. Keep small — expand only when content demands it.

1. **Getting started** ← the Day-1 sequenced path
2. **Jobs**
3. **Quotes & Invoicing**
4. **Customers & CRM**
5. **Staff & Permissions**
6. **Safety**
7. **Settings & Billing**

`sequenceOrder` only matters inside **Getting started** for v1; elsewhere we sort alphabetically by title.

---

## 4. Day-1 content slate (Account + business setup)

Per the user's selection, this is the seed sequence. Each row becomes one help item (article, video, or both).

| # | Title | Format | Notes |
|---|---|---|---|
| 1 | Welcome to Inflow — 2-minute tour | Video | High-level orientation |
| 2 | Set up your business details | Article + video | Company name, ABN/GST, address, contact |
| 3 | Upload your logo & set brand colours | Article | Where it appears (invoices, quotes, customer portal) |
| 4 | Configure default pricing & tax (GST) | Article | NZD, 15% GST default |
| 5 | Set your service area & timezone | Article | Pacific/Auckland default |
| 6 | Connect your bank details for payouts | Article | Stripe/payment processor setup |
| 7 | Enable email notifications | Article | What sends to who, by default |
| 8 | You're ready — what's next | Article | Pointer to the next sequence (staff/roles) once that wave ships |

All 8 should be ready before the help page goes live to subscribers.

---

## 5. Phased rollout

**Phase A — Foundation (no user-visible content yet)**
1. Add `helpArticles` table + migration (run via DO Console per CLAUDE.md DB rules — no `db:push` from here)
2. Add the 5 API routes
3. Add `/help` route stub (empty state: "Content coming soon")
4. Add `/admin/help` authoring UI
5. Wire markdown rendering (verify react-markdown is in `package.json`; if not, ask)

**Phase B — Day-1 content authored**
6. Owner records the 1–2 needed videos, writes the 8 articles via `/admin/help`
7. Mark all published

**Phase C — Launch**
8. Add a `Help` link to the main app nav (icon + label)
9. Optional v1.1: contextual `?` icons on key pages deep-linking to specific articles

**Phase D — Later waves (not blocking launch)**
- Search (Postgres full-text on `title + bodyMarkdown`)
- Per-role visibility (hide "billing" articles from field staff)
- Video chapters / transcripts
- Subsequent sequences: Staff & Permissions → First Quote→Job→Invoice → Safety

---

## 6. Off-limits / things NOT in this plan

- No public-facing docs site (decision locked: subscribers only)
- No third-party video host (decision locked: self-hosted GCS)
- No CMS dependency — markdown-in-DB is the content store
- No schema changes beyond the new `helpArticles` table
- No changes to the existing `videos` table (already has every field we need)

---

## 7. Suggested next action

All design decisions resolved (see "Locked decisions" at top). Phase A breakdown:

| Step | Where | DB write? |
|---|---|---|
| A1. Define `helpArticles` table | `shared/schema.ts` | No |
| A2. Generate migration SQL (drizzle-kit generate, not push) | `migrations/` | No |
| A3. Add `GET/POST/PATCH/DELETE /api/help/articles` routes | `server/routes.ts` | No |
| A4. Add `/help` subscriber view stub + nav link | `client/src/pages/Help.tsx` + router | No |
| A5. Add `/admin/help` authoring UI with TipTap | `client/src/pages/admin/HelpAdmin.tsx` | No |
| A6. Wire "Upload knowledge video" button → existing `POST /api/videos` | inside `/admin/help` | No |
| A7. **GATED** — run migration on prod DB via DO Console | DO dashboard | Yes (needs explicit approval) |

Steps A1–A6 can proceed without DB approval. A7 is the only gated step.
