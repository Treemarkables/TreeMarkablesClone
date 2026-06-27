# Inflow — Tenant onboarding (concierge)

How to spin up a new customer (tenant) by hand, until self-serve signup + Stripe (Phase 4) exist.
No billing needed — invoice the customer directly; this just creates their account.

## The tool: `scripts/create-tenant.mts`

Creates a `business` + its `business_settings` + a first **admin** employee (bcrypt login), all
stamped with the new tenant's `business_id`. Validated on Dev: the new tenant logs in, sees an empty,
fully-isolated workspace (0 customers, only its own business/settings row).

```bash
# Point DATABASE_URL at the target branch. DEV connection string to rehearse;
# PROD (Neon → production branch → Connection string) to onboard a real customer.
DATABASE_URL="postgres://…prod…" npx tsx scripts/create-tenant.mts \
  --name "Acme Trees Ltd" \
  --email admin@acme.co.nz \
  --password "TempPass1234" \
  --first Jane --last Doe \
  [--position Owner]
```

Output prints the new business id + admin login. The admin logs in at
`https://app.treemarkables.co.nz` with that email + password (tell them to change it).

Guards: refuses duplicate email (login is by email — must be globally unique) or duplicate slug.

## After creating the tenant

1. Their admin logs in → lands in an empty workspace, RLS-isolated from Treemarkables and everyone else.
2. They add staff (Staff page → defaults Admin/Crew roles), set up `Settings`, and start using it.
3. Import existing data via the CSV/ServiceM8 import endpoints (data gets stamped *their* tenant
   automatically, thanks to the write-path + RLS).

## ⚠ Prerequisites / follow-ups before a real prod tenant

- **Deploy the `getBusinessSettings` fix** (this branch) — it removed the hardcoded `id: 'default'`
  that would have crashed the 2nd tenant on a primary-key clash. The fix must be live on prod before a
  second tenant's app calls `getBusinessSettings()`. (Ships with the next deploy.)
- **Customer-portal `businessId`** — the customer-portal login does NOT yet set `session.businessId`
  (only the employee login does), so portal requests bypass RLS. Fine while Treemarkables is the only
  tenant, but **must be fixed before a second tenant has portal users** (mirror the businessId-on-session
  line into the portal login). Tracked in `INFLOW_SAAS_PLAN.md`.
- **RBAC (Phase 3)** — new tenants get the hardcoded `admin`/`crew` roles for now; custom per-staff
  permissions come with Phase 3.

## Not needed yet
Self-serve signup, Stripe billing — build those once you have validated demand. This concierge path
gets your first hand-sold customer live without them.
