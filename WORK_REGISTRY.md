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
_(nothing currently claimed — add a line before you start a feature)_

## Recently done
- Entitlement enforcement (gate RBAC features by subscription tier, flag-gated) — merged to `main` 2026-06-06 [PR #132]
- Work registry / collision-prevention rule — merged to `main` 2026-06-06 [PR #133]
- Phase 4 billing (Stripe checkout + webhook sync + UI + self-serve signup) — merged to `main` 2026-06
- Trade generalization plan (docs) — merged to `main` 2026-06 [PR #124]
- Phase 1 multi-tenancy (`business_id` on all tables) — on `main` / prod

## Open follow-ups (not yet claimed — pick up when relevant)
- **Frontend admin entitlement gap** — `hasPermission` short-circuits `isAdmin → true`, so an admin's UI doesn't hide entitlement-gated features even when enforcement strips them (backend still blocks → confusing 403). Fix before enabling `ENTITLEMENT_ENFORCEMENT` for paying freemium/crew tenants with admin users.
- **Enable enforcement in prod** — set `ENTITLEMENT_ENFORCEMENT=true` in DO when ready (prereq met: Treemarkables comped Business sub seeded on prod).

## Closed / deleted branches (history)
- `feat/roles-permissions` [PR #11] — closed 2026-06-06; RBAC backend was already byte-identical on `main`.
- `inflow-phase4-billing-foundation` [PR #126] — closed + deleted 2026-06-06 (duplicate billing system).
- `inflow-entitlement-enforcement` / `inflow-work-registry` — deleted 2026-06-06 after merge.
