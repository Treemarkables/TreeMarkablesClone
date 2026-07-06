# Demo environment runbook

A sales-demo copy of the app, seeded with **fully fictional data**, so prospects can
see how it works without ever touching real customer information.

## Why a separate environment

The app is **single-tenant** — all data is global and shared across every logged-in
account. There is no per-account or per-business data isolation, so a "demo account"
inside the live app would expose real customers. The only safe isolation is a
**separate database** (and a separate app pointing at it). Same codebase, separate data.

```
  main  ──autodeploy──▶  plankton-app (DO)  ──▶  Neon prod DB        (real customers)
   │
   └────same build────▶  demo app (DO)      ──▶  Neon DEMO DB        (fake data only)
```

---

## One-time setup

### 1. Create the demo database (Neon)

Either spin up a new Neon project, or create a **branch** off the existing project in
`ap-southeast-2`. A branch is cheapest and gives you a fresh, isolated DB. Grab its
connection string — call it `DEMO_DATABASE_URL` below.

### 2. Apply the schema to the demo DB

The demo DB starts empty, so push the Drizzle schema into it. This targets **only the
demo DB** because `DATABASE_URL` is overridden inline for this one command:

```bash
DATABASE_URL='<DEMO_DATABASE_URL>' npm run db:push
```

> ⚠️ Double-check the connection string is the **demo** DB before running any
> `db:push`. Per project rules, never run migrations against prod without approval.

### 3. Seed the demo data

```bash
DEMO_DATABASE_URL='<DEMO_DATABASE_URL>' DEMO_SEED_CONFIRM=yes tsx scripts/seed-demo.ts
```

The seed script (`scripts/seed-demo.ts`) is built to be safe:

- It **ignores `DATABASE_URL`** entirely and writes only to `DEMO_DATABASE_URL`, so a
  stale prod URL in your shell can't be the target.
- It refuses to run without `DEMO_SEED_CONFIRM=yes`.

It creates 3 staff, 6 customers, 5 jobs (one in each pipeline stage), 3 quotes, 2 leads,
2 calls, and diary entries.

**Demo login:** `demo@demo.inflowapp.co.nz` / `demo1234` (admin role).

### 4. Stand up the demo DO app

Create a second DO App Platform app from the same repo/branch. Mirror production's
config with these differences:

| Env var | Value | Why |
|---------|-------|-----|
| `DATABASE_URL` | the demo Neon connection string | isolates demo data |
| `SESSION_SECRET` | any fresh random string | required for sessions |
| `RUN_CRONS` | `false` | stops reminder/automation workers from "messaging" fake customers |
| `NODE_ENV` | `production` | keeps the dev employee-ID login selector off |
| Twilio / Resend / Gmail / Xero / GCS / Firebase keys | **leave unset or use test creds** | demo must not send real SMS/email or hit live integrations |

Point a custom domain at it (e.g. `demo.inflowapp.co.nz` or `demo.treemarkables.co.nz`).
Follow the same Cloudflare DNS posture as production: **grey-cloud (DNS-only)**, never
orange-cloud/proxied.

---

## Resetting between demos

To wipe the demo data and reseed a clean slate:

```bash
DEMO_DATABASE_URL='<DEMO_DATABASE_URL>' DEMO_SEED_CONFIRM=yes DEMO_RESET=1 tsx scripts/seed-demo.ts
```

`DEMO_RESET=1` truncates customers/jobs/quotes/leads/calls/diary (CASCADE) and removes
the `@demo.inflowapp.co.nz` staff before reseeding. It only ever touches the demo DB.

---

## Notes

- The demo and production apps run the **same code from the same branch**, so the demo
  always reflects the current product. No code fork to maintain.
- Photo uploads in the demo will try to write to whatever GCS bucket the demo app's
  `PRIVATE_OBJECT_DIR` / credentials point at. Either give the demo its own bucket or
  accept that photo upload is non-functional in the demo — the seeded jobs don't depend
  on it.
- When the Inflow multi-tenancy work lands (see `INFLOW_SAAS_PLAN.md`), an in-app
  "demo tenant" becomes possible and this separate-environment approach can be retired.
