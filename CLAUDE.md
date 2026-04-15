# Treemarkables — Claude Code Guidelines

Read this file in full before making any changes to this project.
Also read `replit.md` for the full system architecture.

---

## Off-limits files — never modify without explicit user instruction

These files are owned by Replit Agent or are critical infrastructure:

- `.replit` — Replit workflow and deployment config
- `package.json` — dependency and script management
- `vite.config.ts` — Vite build config
- `server/vite.ts` — production static file serving
- `drizzle.config.ts` — database ORM config
- `launcher.mjs` — production startup launcher
- `.claude/settings.local.json` — Claude Code permissions

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

## Workflow and deployment rules

- **Never** modify Replit workflows or deployment settings
- **Never** kill or restart the "Start application" workflow
- Deployments are managed via Replit — do not attempt to deploy directly

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

## Coordination with Replit Agent

Replit Agent (the main chat interface) is the primary development agent and owns the overall architecture.

- Run `git log --oneline -10` before starting work to understand recent changes
- Make targeted, surgical edits — not broad refactors
- Never rewrite files that are currently working
- If unsure whether a change conflicts with recent Replit Agent work, check git history first
