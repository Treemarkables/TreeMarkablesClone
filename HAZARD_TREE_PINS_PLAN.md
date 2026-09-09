# Inflow — Hazard tree / GPS pin register

Plan for a persistent tree-pin register on large sites (golf courses, parks, campuses, council land). Written 2026-09-09 after a repo audit. **Status: scoped; P0 spike in this PR is dark-launched.** Do not merge until Jullian reviews. Do not run the SQL against prod from this session.

Owner ask: field staff walk a golf course, drop a GPS pin on a hazard tree, capture the minimum, then take that pin through quote → scheduled job → done — and still find the same tree next season.

---

## 1. Problem / users

### The gap today

Inflow already has **job-scoped** map pins (`tree_markers` on `JobSiteMap`). Those are a bird’s-eye overlay for *this job’s* proposal snapshot. They:

- require a job card before you can drop a pin
- cascade-delete when the job is deleted (`ON DELETE CASCADE`)
- have no risk rating, recommended work type, or lifecycle status
- cannot be found later as “all hazard trees on this golf course”

On a golf course that is the wrong shape. The *site* is the thing that persists. Jobs come and go. Crews currently hunt from prose notes (“third oak past the 7th green”).

### Users

| Who | What they need |
|---|---|
| **Arborist in the field** (iOS Capacitor + phone browser) | Stand at the tree, drop GPS, tap a risk rating, take photos, pick recommended work. Fast, one-handed, works with weak cell. |
| **Office** (desktop) | See every pin on a customer/site map, filter by risk/status, turn one pin *or* a multi-select into a quote/job, keep history. |
| **Crew on the booked job** | Open the job and see the linked pins (mini-map + list) with a Navigate button — not a paragraph of directions. |

Treemarkables is the first tenant (Gisborne Park and similar). The tables are tenant-stamped (`business_id`) so any Inflow subscriber with large sites can use it later.

---

## 2. What already exists (do not rebuild)

Investigated 2026-09-09 against `main`. Extend these; do not invent a parallel CRM/job/photo stack.

| Existing concept | Where | How pins use it |
|---|---|---|
| **Customer** | `customers` + `customer_contacts` | The client (e.g. Gisborne Park Golf Club). Pins hang off the customer, not a new “account” type. Contacts already cover “greens manager vs accounts”. |
| **Job** | `jobs` (`status`: lead / quote / scheduled / work_order / completed / …) | Work package. One job can cover one pin *or* many pins. **No change to job columns in v1.** |
| **Quote / proposal** | `quotes.jobId`, `jobs.quoteId`, `proposals` | Existing 1-job quoting. Multi-pin quoting = many pins linked to **one** job, then the existing quote/proposal builder. One-job-per-pin = one job (and its quote) per pin. |
| **Photos** | GCS via `PhotoStorageService`; diary URLs on jobs; `photos.gpsLatitude/Longitude` | P1 uploads pin photos through the same service (HEIC→JPEG already handled). Store URLs on `tree_pins.photo_urls` (same pattern as `jobs.before_photos`). Optional later: `photos.tree_pin_id`. |
| **Job site map markers** | `tree_markers` + `job_site_maps` + `JobSiteMap.tsx` (Leaflet) | **Keep as-is.** They are a job overlay / proposal snapshot, including photo-mode for council billing addresses. When a job is created from pins (P2), optionally *copy* pin coords onto `tree_markers` so the proposal Site Map button still works — do not merge the tables. |
| **GPS elsewhere** | Photos EXIF/GPS; `/api/near-me/jobs` (Nominatim + haversine); `navigator.geolocation` on Today; iOS `NSLocationWhenInUseUsageDescription` already in Info.plist; open PR #434 (crew clock-in GPS) | Reuse browser geolocation (works in Capacitor WKWebView once plist is set). Do not wait on #434. |
| **Maps UI** | `react-leaflet` already in `JobSiteMap.tsx` and `Library.tsx` | Reuse Leaflet for the site map. Crew nav = `maps.google.com/?q=lat,lng` (opens Apple Maps on iOS). |
| **Risk vocab** | `risk_assessments.overallRisk` = low / medium / high / critical | Same four ratings on the pin. Do **not** auto-create a JHA/risk-assessment row at capture — that is a job-safety document, not a tree register. |
| **Work catalogue** | `services` (name, category, price) | P0: free-text / suggested chips (Remove, Reduce, Deadwood, …). P2 may map a chip onto a service line item. |
| **Tenancy** | `business_id` + `withTenant()` + RLS `tenant_isolation` | Stamp every new table. Follow `schemaMigrations.ts` + RLS postCheck (same as supplier-invoice tables). |
| **Multer / ALS** | PR #379/#380: busboy callbacks drop tenant context | Pin photo upload (P1) must stamp `business_id` from the parent customer/pin on `ownerDb`, not rely on `withTenant()` inside multer. |

**Explicit non-reuse:** `golf-site/` is a standalone marketing site for the club. It is not the pin register. Do not couple them.

---

## 3. Data model

Three new tables. Additive. No changes to `jobs`, `quotes`, `tree_markers`, or primary-key types.

```
customers 1──* customer_sites 1──* tree_pins *──* jobs/quotes
                              (via tree_pin_work_links)
```

### `customer_sites`

A named location belonging to a customer. A golf club is usually **one site**; a council or campus may have several.

| Column | Notes |
|---|---|
| `business_id` | Tenant stamp (RLS) |
| `id` | UUID |
| `customer_id` | FK → customers |
| `name` | e.g. “Gisborne Park — 18-hole” |
| `address` | Optional; defaults from customer |
| `latitude` / `longitude` | Optional map centre |
| `notes` | Internal |
| `created_at` / `updated_at` | |

P0: if a customer has no sites, creating a pin auto-inserts a default site named after the customer.

### `tree_pins`

The persistent tree. **Not** `tree_markers`.

| Column | P0 required? | Notes |
|---|---|---|
| `business_id` | yes | Tenant stamp |
| `id` | yes | UUID |
| `customer_id` | yes | Denormalised for “all pins for this client” |
| `site_id` | yes | FK → customer_sites |
| `latitude` / `longitude` | yes | WGS84, decimal(10,7) like `tree_markers` |
| `gps_accuracy` | no | Metres, from `Position.coords.accuracy` |
| `risk_rating` | yes | `low` \| `medium` \| `high` \| `critical` |
| `recommended_work_type` | yes | Text; suggested chips in the UI |
| `status` | yes | See §4; default `assessed` |
| `photo_urls` | no | `text[]`, GCS paths (empty at capture if offline) |
| `species` | no | Deferred |
| `size_notes` | no | Deferred (DBH / height free text) |
| `access_notes` | no | Deferred |
| `notes` | no | |
| `created_by` | no | employee id |
| `archived_at` | no | Soft-delete; history stays |
| `created_at` / `updated_at` | yes | |

Deleting a **job** must **not** delete the pin (`tree_pin_work_links.job_id` ON DELETE SET NULL). That is the opposite of `tree_markers`.

### `tree_pin_work_links`

Many-to-many. Enables both quoting modes without forking jobs.

| Column | Notes |
|---|---|
| `business_id` | Tenant stamp |
| `id` | UUID |
| `pin_id` | FK → tree_pins ON DELETE CASCADE |
| `job_id` | FK → jobs ON DELETE SET NULL |
| `quote_id` | FK → quotes ON DELETE SET NULL |
| `created_at` | |

A row should have at least one of `job_id` / `quote_id`. Unique `(pin_id, job_id)` and `(pin_id, quote_id)` where the right-hand side is not null.

**Quoting modes (locked):**

1. **One job per pin** — create a job (+ quote) and one link row per pin.
2. **Multi-select → one quote/job** — create **one** job, link N pins to it, use the existing quote/proposal builder (line items can be per-tree in P2).

No new quote engine.

---

## 4. Status machine

Pin status is stored on the pin (so “monitor” works with no job). Linked jobs may *suggest* a status; they do not own it until P2 sync is switched on.

```
                 ┌──────────┐
                 │  monitor │ ← optional “watch, don’t quote yet”
                 └────┬─────┘
                      │ assess / quote
                      ▼
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────┐
│ assessed │ →  │  quoted  │ →  │ scheduled │ →  │ done │
└──────────┘    └──────────┘    └───────────┘    └──┬───┘
     │                │                              │
     └─ urgent ───────┴─ skip quote, book direct     └─ reassess / monitor next season
```

| Pin status | Meaning | Typical Inflow job status |
|---|---|---|
| `assessed` | Captured at the tree; not yet quoted | (no job) |
| `quoted` | On a draft/sent quote or proposal | `lead`, `quote` |
| `scheduled` | Booked or work order | `scheduled`, `work_order` |
| `done` | Work finished | `completed` |
| `monitor` | No work this round; keep on the map | (no job) |

Helpers live in `shared/treePins.ts` (`nextTreePinStatuses`, `pinStatusFromJobStatus`).

---

## 5. API sketch

All routes session-gated. All writes `withTenant()`. Dark unless `HAZARD_TREE_PINS=true` (404 + `wip: true`).

| Method | Path | Phase |
|---|---|---|
| GET | `/api/hazard-pins/enabled` | P0 (always on; `{ enabled }`) |
| GET | `/api/customers/:id/sites` | P0 |
| POST | `/api/customers/:id/sites` | P0 |
| GET | `/api/customers/:id/tree-pins` | P0 |
| POST | `/api/customers/:id/tree-pins` | P0 (GPS + risk + work type; photos optional) |
| GET | `/api/hazard-pins/:id` | P0 |
| PATCH | `/api/hazard-pins/:id` | P1 (not in this PR) |
| POST | `/api/hazard-pins/:id/photos` | P1 photos (this PR — multer + explicit tenant stamp) |
| POST | `/api/hazard-pins/quote` | P2 body `{ pinIds, mode: "per-pin" \| "combined" }` → existing job+quote create |
| GET | `/api/jobs/:id/tree-pins` | P3 (linked pins for the job card) |

P0 spike implements the enabled flag, sites list/create, pins list/create, and get-by-id.

---

## 6. UX sketch

### Field (mobile) — P1 target, P0 stub page at `/hazard-pins`

1. Open **Hazard trees** (crew-accessible; not admin-only).
2. Pick customer (typeahead) → site (default site if only one).
3. **Drop pin** — `navigator.geolocation.getCurrentPosition` (high accuracy).
4. Minimum form: risk rating (4 tappable chips) → photos (camera, this PR) → recommended work (chips). Submit.
5. Optional later: species / size / access behind “More”.
6. Offline: queue the JSON + photo blobs in IndexedDB; flush when online. P1 risk, not in this PR.

NZ English: “Hazard trees”, “Risk rating”, “Recommended work”, “Navigate to pin”, “Assessed / Quoted / Scheduled / Done / Monitor”.

### Office (desktop) — P2

- Customer record (or this page) shows a Leaflet map of the site + filter chips (risk, status).
- Multi-select pins → **Create quote** (combined) or **Quote each**.
- History: previous jobs/quotes listed on the pin drawer.

### Crew on the job — P3

- Job card section **Trees on this job**: mini Leaflet (or list on small screens) + **Navigate** per pin (`treePinMapsUrl`).
- Do not replace `JobSiteMap`; that remains the proposal overlay.

Sidebar **Hazard trees** is crew-accessible (not admin-only) and shown only when `HAZARD_TREE_PINS=true` via `/api/hazard-pins/enabled`.

---

## 7. Phased delivery

### P0 — this PR (spike)

Prove the model without a UI redesign.

- Design doc (this file) + WORK_REGISTRY claim.
- Types in `shared/schema.ts` + helpers in `shared/treePins.ts`.
- Idempotent SQL in `migrations/manual/20260909_hazard_tree_pins.sql` **and** `server/schemaMigrations.ts` (repo convention). **Not run against prod in this session.** Merging to `main` *will* create three empty tables on next deploy — wait for owner OK.
- Storage + stub routes behind `HAZARD_TREE_PINS` (default **off**).
- Empty/WIP page at `/hazard-pins`. Sidebar **Hazard trees** shows only when the flag is on. When the flag is on, list + drop-pin form for a customer.

### P1 — field capture

- **Photos (this PR):** Camera via existing `PhotoCaptureModal` → `PhotoStorageService` with multer tenant stamp (`POST /api/hazard-pins/:id/photos`). URLs stored on `tree_pins.photo_urls`. Still dark unless `HAZARD_TREE_PINS=true`.
- Leaflet site map on `/hazard-pins`.
- IndexedDB offline queue.
- Update iOS `NSLocationWhenInUseUsageDescription` to mention dropping tree pins (needs a TestFlight).
- Optional: customer picker from Clients (avoid colliding with open PR #499).

### P2 — quote / job linking

- `POST /api/hazard-pins/quote` wrapping existing job+quote create.
- Both modes. Pin status updates when the job moves (using `pinStatusFromJobStatus`).
- Optional copy onto `tree_markers` for the proposal Site Map.

### P3 — crew nav on the job

- Job card mini-map/list + Navigate.
- `GET /api/jobs/:id/tree-pins`.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Offline GPS** | `getCurrentPosition` fails in a valley / under canopy. Allow “use last known” + manual map-drop (P1 Leaflet). Queue posts. |
| **Photo upload** | Same class bug as site-map images (multer drops ALS). Stamp from parent pin. HEIC already converted in `photoStorage.ts`. |
| **Multi-tenant** | Every table has `business_id` + RLS + `withTenant()`. List endpoints filter by customer ownership in-session. Never accept client-supplied `businessId`. |
| **iOS Capacitor** | Geolocation works in WKWebView if Info.plist has When-In-Use (already present for “Near me”). Photo capture uses existing camera / file input. Do not add `@capacitor/geolocation` (new npm dep needs owner approval). |
| **Confusing with `tree_markers`** | Different tables, different APIs (`/tree-markers` vs `/tree-pins`). Comments in schema. Job overlay stays. |
| **schemaMigrations on merge** | Empty tables appear on deploy. APIs stay 404 until `HAZARD_TREE_PINS=true` is set on DO. No job/quote behaviour changes. |
| **Open PR #434** (crew GPS clock-in) | Related GPS work; different tables. No file overlap expected with this spike. |
| **Open PR #499** (Clients pagination) | Do not edit `Clients.tsx` in this spike. |

---

## 9. Non-goals for v1

- Public customer-facing pin map / golf-club portal.
- Coupling to `golf-site/` marketing.
- Species identification AI.
- Full QTRA / TRAQ scoring (four-level risk only).
- Replacing JHA / near-miss / `risk_assessments`.
- Replacing `JobSiteMap` / proposal site-map snapshots.
- Changing job or quote primary keys, numbering, or statuses.
- Treemarkables www marketing / host-split work.
- New npm packages.
- Running `npm run db:push` / drizzle-kit / any prod SQL from this PR.

---

## 10. P0 recommended next step (after this PR)

On a **dev** Neon branch only (not prod): confirm `schemaMigrations` creates the three tables + RLS, set `HAZARD_TREE_PINS=true`, open `/hazard-pins`, pick a test customer, drop a pin with GPS + risk + work type + photos, `GET /api/customers/:id/tree-pins` returns it with `photoUrls`. Then P1 remainder is map + offline queue; P2 is quote/job linking.

Owner enablement (later, when wanted): DO env `HAZARD_TREE_PINS=true` after merge. Until then the feature is invisible.
