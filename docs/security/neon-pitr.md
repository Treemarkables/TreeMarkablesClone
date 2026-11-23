# Neon point-in-time recovery (PITR)

One-pager for sales / ops questionnaires. **Do not restore over production** without an explicit owner decision — Instant restore rewrites the root branch timeline.

## Where production lives

| Item | Value | Source |
|---|---|---|
| Provider | Neon Postgres | `CLAUDE.md`, `INFLOW_PHASE2_PROD_RUNBOOK.md` |
| Region | `ap-southeast-2` (Sydney) | `CLAUDE.md` (co-located with DO app `plankton-app` region `syd`) |
| Project id | `rapid-wildflower-05348699` | `INFLOW_PHASE1_PROD_RUNBOOK.md`, `INFLOW_PHASE2_PROD_RUNBOOK.md` |
| Production branch name | `production` (`treemarkables-prod`) | same runbooks |
| Pooler host (app) | `ep-fancy-salad-a7zdt2dw-pooler.ap-southeast-2.aws.neon.tech` | `MIGRATION_PLAN.md` (historical; confirm in Neon Console if it has rotated) |
| Direct host | pooler hostname with `-pooler` stripped | `server/db.ts` |
| Sessions | `connect-pg-simple` on the same DB | `CLAUDE.md` |
| Photos | GCS `treemarkables-photos` (`australia-southeast1`) — **not** covered by Neon PITR | `CLAUDE.md` |

## PITR / Instant restore

Neon calls PITR **Instant restore**. It is bounded by the project **history window** (Console → Settings → Postgres / Instant restore, API field `history_retention_seconds`).

| Neon plan | Default window | Maximum window |
|---|---|---|
| Free | 6 hours (capped at 1 GB history) | 6 hours |
| Launch | 1 day | 7 days |
| Scale | 1 day | 30 days |

Paid history storage is billed separately from data storage (Neon docs: ~$0.20/GB-month on root branches).

### Current project settings — ops to fill

These are **not** in the repo or env comments. Read them from Neon Console (project `rapid-wildflower-05348699` → Settings → Postgres) or `GET /api/v2/projects/{project_id}` (`history_retention_seconds`).

| Setting | Value |
|---|---|
| Neon plan (Free / Launch / Scale / Business) | `_TBD — read from Neon Console billing_` |
| Configured history window | `_TBD — hours or days, plus `history_retention_seconds`_` |
| Maximum allowed on that plan | `_TBD — 7 days (Launch) or 30 days (Scale)_` |
| History storage on the last invoice | `_TBD_` |

Until the Console is checked, **do not claim a specific retention SLA**. Safe public wording: “continuous backup with point-in-time restore, retention per the Neon plan.”

## Last tested restore

| Drill | Date | Result |
|---|---|---|
| Last Instant restore / Time Travel / PITR branch drill | **Never recorded in-repo** | `APP_STRENGTHENING_PLAN.md` (2026-07-23) P1 item 3: we rely on Neon PITR but have not rehearsed a restore |
| Related: production branch snapshot before tenancy | 2026-06-05 | `pre-tenancy-backup` child branch taken before Phase 1 SQL (`INFLOW_PHASE1_MIGRATION.md`) — that is a **branch copy**, not a timed Instant restore drill |

**Ops: after the next drill, fill this in.**

| Field | Value |
|---|---|
| Date (NZ) | `_TBD_` |
| Operator | `_TBD_` |
| Method | Instant restore on `production` **or** (preferred) create a child branch from a past timestamp |
| Target time | `_TBD_` |
| Checks | row counts on `businesses` / `customers` / `jobs` / `employees`; spot-check one known job |
| Duration | `_TBD_` |
| Production overwritten? | **No** unless owner explicitly approved |

## How to drill (preferred: branch, do not rewrite prod)

Neon Instant restore can roll a **root** branch back in place. For a test, **create a child branch from a point in time** instead:

1. Neon Console → project `rapid-wildflower-05348699` → branch **production**.
2. New branch from a timestamp inside the history window (or Time Travel query). Auto-delete: Never until the drill is signed off.
3. Point a throwaway `DATABASE_URL` at the child branch. Do **not** change Digital Ocean App Platform env.
4. Verify: `SELECT count(*) FROM businesses; SELECT count(*) FROM customers; SELECT count(*) FROM jobs;` plus one known job number / customer name from before the target time.
5. Record date, duration, and row counts in the table above. Delete the child branch when done.

In-place Instant restore of `production` is an incident action, not a drill.

## What PITR does **not** cover

- **GCS photos / videos** (`treemarkables-photos`). Confirm object-versioning separately (`APP_STRENGTHENING_PLAN.md` still flags this).
- **Digital Ocean app** (code + env). Rollback is git revert on `main` (autodeploy) or the paused Replit target documented in `MIGRATION_PLAN.md` (Phase 5).
- History **older than the configured window**. If Launch is still on the 1-day default, a Friday mistake may be unrecoverable by Monday — consider raising the window to 7 days (Launch max) or 30 days (Scale).

## Sales / questionnaire snippet

> Customer data is in Neon Postgres (Sydney, `ap-southeast-2`). Neon stores a continuous change history (WAL) and can restore a root branch to a point in time within the project history window. Retention is the Neon plan’s Instant restore window (Launch up to 7 days, Scale up to 30 days; the live window is set in the Neon Console). File storage is a separate GCS bucket in Australia. We have not yet recorded a timed restore drill in this repository — next drill date belongs in this file.

## References

- Neon history window: https://neon.com/docs/introduction/history-window
- `APP_STRENGTHENING_PLAN.md` § P1.3 Backup/restore runbook
- `INFLOW_PHASE1_PROD_RUNBOOK.md` / `INFLOW_PHASE2_PROD_RUNBOOK.md`
