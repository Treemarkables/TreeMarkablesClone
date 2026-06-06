# Treemarkables — Claude Code Guidelines

Read this file in full before making any changes to this project.
Also read `replit.md` for the full system architecture.

**Migration off Replit:** customer cutover completed 2026-05-12 NZ. Production runs on Digital Ocean App Platform, autodeploying from `main`. The paused Replit deployment is the rollback target until ~2026-05-19; after that, Phase 5 cleanup removes the Replit-specific code and finalizes this file. See `MIGRATION_PLAN.md` for the Phase 5 cleanup queue and history.

---

## Off-limits files — never modify without explicit user instruction

These files are critical infrastructure or tooling-owned:

- `package.json` — dependency and script management
- `vite.config.ts` — Vite build config
- `server/vite.ts` — production static file serving
- `drizzle.config.ts` — database ORM config
- `.claude/settings.local.json` — Claude Code permissions

**Rollback-window holdovers (delete in Phase 5, not before):** `.replit`, `launcher.mjs`. These no longer run in DO production but stay in the tree so the paused Replit deployment remains a valid rollback target.

---

## Database rules

- **Never** run `npm run db:push`, `drizzle-kit push`, or any migration command without explicit user approval
- **Never** change primary key column types (serial ↔ varchar causes irreversible data loss)
- Always check `shared/schema.ts` before proposing schema changes

---

## Dependency rules

- **Never** run `npm install` directly — ask the user first
- **Never** add packages that conflict with existing ones in `package.json`

---

## Deployment

- Production runs on Digital Ocean App Platform (app `plankton-app`, region SGP1). Every push to `main` triggers an autodeploy; for build/runtime logs check the DO dashboard.
- Customer URL: `https://app.treemarkables.co.nz`. DNS lives at Cloudflare on grey-cloud (DNS-only) — never flip the customer-facing records to orange-cloud (proxied), it double-proxies through DO's own Cloudflare edge and breaks TLS / cache assumptions.
- Database: Neon Postgres in `ap-southeast-2` (Sydney). Sessions via `connect-pg-simple` against the same DB.
- Photo storage: GCS bucket `treemarkables-photos` (`australia-southeast1`). `PRIVATE_OBJECT_DIR=/treemarkables-photos/.private` — must not have a trailing space (env reads `.trim()` defensively at `photoStorage.ts` and the matching routes in `server/routes.ts`).
- Cron + background workers: gated by `RUN_CRONS` (unset → enabled in production). Don't toggle without explicit user instruction.
- Don't attempt deploys, env-var edits, or Cloudflare DNS edits yourself — those happen via the DO and Cloudflare dashboards.

---

## Architecture

- Monorepo: frontend in `client/src/`, backend in `server/`, shared types in `shared/schema.ts`
- All API routes live in `server/routes.ts` (22,000+ lines) — make surgical edits only
- Auth: `client/src/contexts/AuthContext.tsx` — use the `useAuth` hook
- Database: PostgreSQL via Drizzle ORM + `@neondatabase/serverless`
- Routing: Wouter (not React Router)
- UI: Shadcn/ui components — always prefer existing components over custom elements

---

## Coding conventions

| Rule | Detail |
|------|--------|
| Currency | NZD only — never USD |
| Timezone | Pacific/Auckland (NZ) via `shared/dateUtils.ts` utilities |
| TypeScript | No `as any` casts |
| Toasts | No success toasts — only `variant: "destructive"` for errors |
| UI | No emoji in the UI |
| Buttons | No manual `hover:bg-*` or `active:bg-*` classes — Shadcn handles this |
| GPT calls | Do **not** pass `temperature` — GPT-5+ doesn't support it |
| Customer URLs | Always hardcode `https://app.treemarkables.co.nz` for customer-facing links |

---

## Design system (marketing pages)

| Concern | Convention |
|---------|------------|
| Brand neon-green | `#39FF14` — use for icon circles, accent borders/highlights, brand CTAs |
| Header bar | Black background (`bg-black`), neon-green text/links, fixed `h-20`. Logo is `h-40` deliberately overflowing — keep `overflow-hidden` on the **top-bar flex row**, not on the `<header>` itself, or the mobile menu drop-down breaks |
| Icon library | `lucide-react` only (not Heroicons / Material). Brand-specific icons via `react-icons/si` (e.g., `SiFacebook`) |
| Standard CTA | Shadcn `<Button>` component. **Never** raw `<button>` with manual `hover:bg-*` / `active:bg-*` |
| "Get a quote" / "Contact" CTAs | Open `<ContactFormModal>` pop-up (set `isQuoteModalOpen` state). Only the home page uses scroll-to-form via `handleGetQuote` — service pages use the modal |
| Card layouts | `bg-card border border-border rounded-lg` — Shadcn theme tokens, auto-handle dark mode. Don't hand-pick gray-100/gray-700 dark variants |
| Image gallery | Reuse `<PhotoSlider>` (`client/src/components/PhotoSlider.tsx`) — handles full-width slider + tap-to-expand modal, mobile-tuned (~80vw thumbs, ~95vw modal) |
| Service-page layout | Hero (full bleed bg) → `<InquiryForm>` section (`bg-muted/30`) → `<PhotoSlider>` → image-left/text-right intro section → article/why-choose → testimonials → FAQ → contact. Stick to this rhythm so pages feel consistent |
| Hero copy on service pages | Single `<h1>` per page, white text on dark/image bg, one primary CTA + phone CTA |
| Page top padding | `pt-20` (or responsive `pt-16 md:pt-20 lg:pt-24`) to clear the fixed header |

---

## Branch + commit workflow

The `claude` branch convention is retired with Replit Agent. Work on a feature branch off `main`.

- Make targeted, surgical edits — not broad refactors. Never rewrite files that are currently working.
- Don't push `main` to `subrepl-k6pnm9de` (GitHub) without explicit user approval — every push triggers a production deploy on DO. Local commits are safe; the push is the side effect.
- Old branches (`claude`, `subrepl-*`, `replit-agent`) are historical; don't recreate the merge-from-main dance on them.

### Avoiding duplicate work — MANY parallel sessions write to this repo

**There IS more than one writer.** Many Claude Code sessions run concurrently in separate git worktrees against this repo; they cannot see each other and have collided by building the same feature twice (e.g. two complete billing systems shipped in parallel). Git worktrees isolate *files*, not *logical work*.

**Before starting any substantial feature, check for existing/in-flight work — then claim yours:**
1. `git fetch origin main && git log origin/main --oneline -25` and `gh pr list` — does this feature already exist or is a branch already building it?
2. Scan `WORK_REGISTRY.md` for an overlapping claim.
3. If it already exists on `main` or in an open PR, build the **delta** — do **not** create a parallel implementation. Reconcile with that branch instead.
4. If it's clear, add a one-line claim to `WORK_REGISTRY.md` before you start, and remove it (or move it to Done) when your PR merges.

---

## Local dev

`npm run dev` runs `tsx server/index.ts` (no watch mode). It serves both the API and the Vite-built frontend on port 5000.

Frontend edits hot-reload via Vite. Backend edits under `server/` require a restart to take effect — `tsx` is not watching. **Don't kill or restart the dev server yourself** — it's the user's foreground process; ask them to restart it, or have them confirm it's been done before re-verifying. Verify reachability afterwards with `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000` (expect `200`).

Don't restart speculatively — only after a server-side edit that actually needs to take effect.
