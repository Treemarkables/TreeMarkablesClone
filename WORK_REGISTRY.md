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
- add-ons / extras subscribe layer + tier-matrix builder — branch `claude/elegant-lamport-be6dd6` — 2026-06-06 — SMS/Call/AI add-on catalog + Stripe subscription-item add/remove + `/api/billing/addons` + SettingsBilling Extras UI + flag-gated add-on enforcement (`requireEntitlement`) + `/admin/tiers` feature-matrix editor (`plan_features` table) — delta on Phase 4 billing
- entitlement enforcement — branch `inflow-entitlement-enforcement` — 2026-06-06 — gate RBAC features by subscription tier, flag-gated [PR #132]
- work registry / collision-prevention — branch `inflow-work-registry` — 2026-06-06 — this file + CLAUDE.md rule

## Recently done
- Phase 4 billing (Stripe checkout + webhook sync + UI + self-serve signup) — merged to `main` 2026-06
- Trade generalization plan (docs) — merged to `main` 2026-06 [PR #124]
- Phase 1 multi-tenancy (`business_id` on all tables) — on `main` / prod

## Known stale branches (candidates to close)
- `feat/roles-permissions` [PR #11] — its RBAC backend is already identical on `main`; superseded.
- `inflow-phase4-billing-foundation` — deleted 2026-06-06 (was the duplicate billing PR #126).
