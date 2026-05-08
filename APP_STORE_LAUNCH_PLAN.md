# App Store launch with rebrand-first strategy

## Context

The user is converting their existing web app (currently branded "Treemarkables", a tree-services job management tool) into an iOS app via Capacitor and is currently testing it on TestFlight. They originally asked whether to push it to the App Store as-is and rebrand later.

After exploring the implications, the user decided on **Strategy C — pause App Store submission, name and rebrand the iOS shell first, then ship version 1.0 with a clean identity**. The driver: they're pivoting this app into a multi-industry field-services SaaS, separate from the Treemarkables tree-services brand. Submitting under a Treemarkables-flavoured bundle ID would create a permanent footprint that's hard to undo (the bundle ID is locked forever once an app is published). A short delay for a clean foundation is preferred over a permanent compromise.

The user has committed to deciding on the SaaS name and domains within one week. The intended outcome is a v1 App Store launch with the right brand on the iOS shell, while leaving the React UI's "Treemarkables" content references alone (they're correct for v1 — only Treemarkables staff use the app, and the data really is Treemarkables data; these references will be addressed naturally during the multi-tenancy refactor planned for Q3 2026).

The scope of this plan is the **iOS shell identity rebrand** ("light rebrand"), not a full rebrand of every "Treemarkables" string in the React codebase. Reasoning: there are 207 occurrences of "Treemarkables" in `client/src/`, almost all of which are business defaults (quote templates, marketing copy, default company info on the public site). They're correct for the v1 single-tenant deployment and become per-org settings during the multi-tenancy retrofit anyway. Doing a full rebrand now is duplicate work that gets undone later.

---

## Phase 1 — Name + domains (≤ 1 week, user-driven)

This phase is decision-making, not coding. No file changes.

### 1a. Pick a name

**Criteria:** short (1–2 syllables, ≤ 8 letters ideally), industry-neutral (no tree/arborist/trade-specific words), pronounceable, not clashing with existing tradie SaaS (Tradify, ServiceM8, Jobber, Fergus, AroFlo, simPRO, Knowify, Housecall Pro, Workiz, BuildXact, Jobtread).

### 1b. Run each candidate through the 5-check filter (~15 min per name)

1. `[name].com` available — check on Cloudflare Registrar / Namecheap / Porkbun
2. `[name].co.nz` available — check on Freeparking / 1stDomains / DNC.org.nz
3. App Store search ("[name]") — no existing close match
4. Google "[name] app" — no obvious clashes
5. IPONZ trademark search (https://app.iponz.govt.nz) — classes 9 (software) and 42 (SaaS), no live conflicting marks

If any check fails, drop and move on. Don't try to fight an existing trademark.

### 1c. Buy domains in one go (once a winner is chosen)

| Domain | Registrar | Priority |
|---|---|---|
| `[name].com` | Cloudflare Registrar | Must |
| `[name].co.nz` | Freeparking / 1stDomains (Cloudflare doesn't sell `.co.nz`) | Must |
| `[name].app` | Cloudflare Registrar (~NZD $35/yr) | Nice-to-have |

### 1d. Reserve the App Store name immediately

In App Store Connect → "My Apps" → "+ New App" → reserve the name. Holds it for 180 days even before a build is submitted. Free.

---

## Phase 2 — Light rebrand of iOS shell identity

This is the actual code work. Estimated ~2–4 hours, on the `claude` branch as usual.

Throughout this phase, `[NEWNAME]` = the chosen SaaS name (e.g., `acme`), `[BUNDLE]` = the new bundle ID (recommended: `nz.co.[userLastName].[NEWNAME]` to keep it tied to the user personally rather than to a company that may dissolve), `[NEWDOMAIN]` = the new app's API/web domain (recommended: `app.[newname].com`).

### 2a. Capacitor config

**File:** `/home/runner/workspace/capacitor.config.ts`

Change three values:
- `appId: "com.treemarkables.app"` → `appId: "[BUNDLE]"`
- `appName: "Treemarkables"` → `appName: "[NEWNAME]"`
- `server.url: "https://app.treemarkables.co.nz"` → `server.url: "https://[NEWDOMAIN]"`

The `server.url` change requires `[NEWDOMAIN]` to be live and serving the existing web app *before* this change ships, or the iOS app will fail to load. Two ways to achieve this:

- **Option 1 (cleanest):** Add `[NEWDOMAIN]` as an additional custom domain on the Replit deployment alongside `app.treemarkables.co.nz`. Both URLs serve the same app. Then update `capacitor.config.ts`. The web app at the old URL keeps working for the existing browser-based users; the iOS app loads from the new URL.
- **Option 2 (quick hack):** Skip the domain change for v1, keep `server.url` pointed at `app.treemarkables.co.nz`. The iOS app keeps loading from the legacy domain. Not recommended — locks v1 to the Treemarkables domain and means a forced app update when you eventually want to migrate.

**Recommendation:** Option 1. The DNS + Replit custom-domain setup takes 15 minutes.

### 2b. iOS native plugin code

**File:** `/home/runner/workspace/ios-native/TwilioVoicePlugin.swift`

User-visible strings on incoming calls:
- `CXProviderConfiguration(localizedName: "Treemarkables")` → `localizedName: "[NEWNAME]"`
- `"Treemarkables Customer"` (caller display name) → `"[NEWNAME] Customer"`

**File:** `/home/runner/workspace/ios-native/AppDelegate+Firebase.swift`

- Update the comment `"Treemarkables production database"` → `"[NEWNAME] production database"` (cosmetic)
- The hardcoded webhook secret string `"TreemarkablesHero2026SecureWebhook"` is a **separate security concern**, not a rebrand concern — it should be moved to an env var regardless of naming. Flag for the user but don't bundle into this rebrand.

### 2c. iOS Xcode project (regenerated)

**Note:** The repo doesn't contain an `ios/` folder at the root — only `ios-native/` (supplementary plugin code). The Xcode project is generated outside of version control by `npx cap add ios` / `npx cap sync ios`. After `capacitor.config.ts` changes, run:

```
npx cap sync ios
```

This regenerates the iOS project with the new bundle ID and app name. Then in Xcode:
- Verify `PRODUCT_BUNDLE_IDENTIFIER` matches `[BUNDLE]`
- Verify `CFBundleDisplayName` and `CFBundleName` match `[NEWNAME]`
- Set the signing team to the user's personal Apple Developer account
- Generate a new provisioning profile for `[BUNDLE]` (Xcode does this automatically)

### 2d. App icons + splash

**Existing branded assets to replace:**
- `/home/runner/workspace/client/public/treemarkables-icon-black.png` (still referenced by web app — replace with new branded icon, keep the same filename or update references)

**Missing assets currently referenced** (from `client/index.html`, will 404):
- `treemarkables-logo-green-180.png`
- `treemarkables-logo-green-192.png`
- `treemarkables-logo-green-512.png`

These should be replaced with new-brand equivalents (e.g., `[newname]-logo-180.png` etc.) and the `<link>` references in `client/index.html` updated.

**For the iOS Xcode build specifically:** Capacitor uses an `Assets.xcassets/AppIcon.appiconset` inside the generated `ios/` folder. App icons must be added there in the required sizes (1024×1024 for App Store, plus all device sizes). This is done in Xcode after `npx cap sync ios`.

### 2e. HTML head metadata

**File:** `/home/runner/workspace/client/index.html`

- `<title>` and `<meta name="description">` — update to new brand
- `<meta name="apple-mobile-web-app-title">` currently reads `"TreeJobs"` (already inconsistent) — set to `[NEWNAME]`
- `<meta property="og:site_name">` if present — update
- All `<link rel="apple-touch-icon">` and manifest icon references — update to new asset paths

### 2f. Files explicitly NOT changed in this phase

- `package.json` — `"name": "rest-express"` is a generic monorepo identifier, not user-visible, leave it (and the project rules forbid modifying `package.json` without user approval).
- The 207 "Treemarkables" references in `client/src/` (quote templates, marketing copy, `GuaranteeSection.tsx`, `SEO.tsx`, etc.) — these are content/data, not iOS shell identity. Out of scope for v1 launch.
- `shared/schema.ts` `businessSettings.businessName` default of "Treemarkables" — correct for v1 single-tenant; replaced during multi-tenancy retrofit.
- The hardcoded Twilio webhook secret in `AppDelegate+Firebase.swift` — a security issue worth fixing separately, but not part of the rebrand.

---

## Phase 3 — App Store submission

After Phase 2 is verified working in TestFlight under the new name + bundle ID:

### 3a. App Store Connect listing

- App name: reserved in Phase 1d
- Subtitle (30 char): one-line value prop
- Description, keywords, category (Business)
- Screenshots: 6.9" iPhone (iPhone 16 Pro Max) + 6.5"/6.7" iPhone, minimum
- App icon: 1024×1024 PNG, no transparency, no rounded corners
- Privacy questionnaire: be thorough — this app collects customer data, photos, GPS, contacts (via Twilio), so the answers are non-trivial
- Reviewer demo account: create a test login with realistic seeded data so the reviewer can actually use the app
- Reviewer notes: explain that the app is a field-services job management tool used by tradies; provide demo login

### 3b. Release options

- Manual release (recommended) — control the moment it goes live
- Pricing: Free
- Availability: New Zealand (start narrow; expand later)

### 3c. Submit + monitor

- Apple review: typically 24–48h
- Common rejection reasons to pre-empt: missing demo account, vague privacy answers, missing app functionality at review (the reviewer must be able to log in and exercise the main flow)

---

## Critical files

These are the files Phase 2 actually edits:

| File | Change |
|---|---|
| `/home/runner/workspace/capacitor.config.ts` | `appId`, `appName`, `server.url` |
| `/home/runner/workspace/ios-native/TwilioVoicePlugin.swift` | Caller ID strings (2 occurrences) |
| `/home/runner/workspace/ios-native/AppDelegate+Firebase.swift` | Comment string (cosmetic) |
| `/home/runner/workspace/client/index.html` | Title, meta, apple-touch-icon refs |
| `/home/runner/workspace/client/public/treemarkables-icon-black.png` | Replace asset (or add new + update refs) |
| `/home/runner/workspace/client/public/[new-logo files]` | Add new branded logo PNGs at 180/192/512 |

External (not in repo):
- DNS records at the registrar managing `[NEWNAME].com`
- Replit deployment custom domain settings (add `[NEWDOMAIN]`)
- `npx cap sync ios` regenerated `ios/` Xcode project — set bundle ID, signing team
- App Store Connect — name reservation, listing creation, build submission

---

## Verification

End-to-end test flow after Phase 2 changes:

1. **Web app at the new domain** — `curl -s -o /dev/null -w "%{http_code}\n" https://[NEWDOMAIN]` returns `200`. Open in a browser and confirm login + dashboard work.
2. **Web app at the old domain** — `https://app.treemarkables.co.nz` still works (browser users not yet migrated). Both serve the same app.
3. **Capacitor build** — `npx cap sync ios` completes without errors. Open `ios/App/App.xcworkspace` in Xcode. Verify:
   - Target → General → Bundle Identifier matches `[BUNDLE]`
   - Target → General → Display Name matches `[NEWNAME]`
   - Signing & Capabilities → team set to user's personal Apple Developer account
4. **TestFlight build** — archive in Xcode, upload to App Store Connect, distribute via TestFlight to the user's own device. Install the new build. Verify on device:
   - Home screen icon label reads `[NEWNAME]`
   - App opens without errors and loads the dashboard from `[NEWDOMAIN]`
   - Existing login still works
   - A test incoming Twilio call shows `[NEWNAME]` (not "Treemarkables") in the iOS call UI
   - Push notifications still arrive (Firebase setup unchanged)
5. **Backend smoke test** — log in, create a test job, attach a photo, mark it complete. Same flows that run today on the old build.

If all of the above pass, the app is ready for App Store submission (Phase 3).

---

## Decisions deferred to later milestones

These come up in the conversation but are explicitly NOT part of this plan:

- **Multi-tenancy refactor** — Q3 2026, separate effort. Adds `organizationId` scoping to ~30+ tables, updates every query in `server/routes.ts`. The single biggest piece of work between "internal tool" and "real SaaS."
- **Backend migration off Replit** — wait until v1 is in the App Store and stable, then evaluate based on real usage. The `[NEWDOMAIN]` setup in Phase 2a makes this a DNS change rather than an app resubmission, which is the main value.
- **Apple Developer account transfer** — when the SaaS company is incorporated, Apple supports transferring the published app to the new entity via "App Transfer." App keeps reviews and users.
- **Full UI rebrand** (the 207 `client/src/` references) — happens naturally during the multi-tenancy retrofit, when the hardcoded "Treemarkables" defaults become per-org settings.
- **Hardcoded Twilio webhook secret** in `AppDelegate+Firebase.swift` — separate security task, move to env var regardless of rebrand.
