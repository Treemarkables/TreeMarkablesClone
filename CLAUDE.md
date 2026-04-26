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

## Branch workflow — coordinating with Replit Agent

Replit Agent commits to `main`. Claude works on the `claude` branch. This is the mechanism that prevents overwrites — Git surfaces real merge conflicts instead of silent clobbers.

- Before starting work: `git checkout claude && git merge main` to catch up with any commits Replit Agent has made. Resolve conflicts now, not later.
- Make all edits on `claude`. Never commit directly to `main`.
- When work is ready to ship, ask the user before merging back to `main`. The user may prefer to merge via GitHub PR (push `claude` to `subrepl-k6pnm9de` and merge in the web UI) or locally.
- Make targeted, surgical edits — not broad refactors. Never rewrite files that are currently working.

---

## Restarting the backend workflow

After editing backend code under `server/`, restart the backend so the change takes effect. Replit's supervisor does **not** auto-respawn `shell.exec` workflows on crash, so this is two steps:

```
pkill -f "tsx server/index.ts" 2>/dev/null
nohup npm run dev > /tmp/backend-dev.log 2>&1 &
disown
```

This kills only the backend (`npm run dev` at the repo root → `tsx server/index.ts`) and starts a fresh, detached one. It does not touch the mockup sandbox vite (which runs `npm run dev` inside `artifacts/mockup-sandbox/`).

Wait ~5 seconds, then verify with `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000` (expect `200`).

Only restart when (a) you're on the `claude` branch, and (b) you just edited backend code. Don't restart speculatively.
