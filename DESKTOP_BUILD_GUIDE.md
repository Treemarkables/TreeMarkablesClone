# Desktop App Build Guide — Inflow (Electron)

## Overview

The desktop app is a lightweight **Electron** shell that loads the live web app
(`https://app.treemarkables.co.nz`) in a dedicated, branded window — the same
remote-URL approach as the iOS/Android Capacitor shells. It lives in `electron/` with its
**own `package.json`** (the root `package.json` is untouched).

> **Why Electron, not Capacitor?** Capacitor has no official desktop platform. The web app
> already loads from a remote URL, so a desktop "app" is just a managed browser window —
> Electron does this cleanly with native menus, single-instance handling, and standard
> packaging/auto-update.

### What desktop does and doesn't do

| Feature | Desktop |
|---------|---------|
| Full web app (dispatch, jobs, quotes, invoices, photos) | ✅ Works |
| Camera / microphone (photos, WebRTC) | ✅ Works (permissions auto-granted) |
| Native menus, single instance, external links → browser | ✅ |
| **Twilio inbound calls** | ❌ No — Twilio's call SDK is mobile-only (iOS/Android). |
| **FCM push notifications** | ❌ No mobile-FCM. Web/desktop notifications work only if/when the web app ships a service-worker web-push flow. |

The desktop app is for **working at a desk** (the full web UI in a window); calls and push
stay on the phone apps.

---

## Prerequisites

- **Node.js 20+**
- For macOS distribution: a Mac with **Xcode command-line tools** + an Apple Developer
  account (for code signing + notarization)
- For Windows distribution: Windows (or a CI runner); optionally a code-signing cert

---

## Run locally

```bash
cd electron
npm install        # installs electron + electron-builder into electron/ only
npm start
```

A window opens onto `app.treemarkables.co.nz`. Edit `electron/main.js` and restart to
iterate.

---

## Icons

Place icons in `electron/assets/` before packaging (`icon.icns`, `icon.ico`, `icon.png`) —
see `electron/assets/README.md`. Reuse the iOS AppIcon artwork.

---

## Package installers

```bash
cd electron
npm run dist:mac     # → release/Inflow-<ver>.dmg  (+ .zip)
npm run dist:win     # → release/Inflow Setup <ver>.exe  (NSIS)
npm run dist:all     # both (mac must be built on macOS)
```

Output lands in `electron/release/`. Build config is the `build` block in
`electron/package.json` (appId `co.nz.inflowapp.desktop`).

---

## macOS code signing + notarization

Unsigned macOS apps are blocked by Gatekeeper. To distribute:

1. In Apple Developer, create a **Developer ID Application** certificate; install it in your
   login keychain.
2. Create an **app-specific password** for notarization (appleid.apple.com).
3. Export these before `npm run dist:mac`:
   ```bash
   export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
   export APPLE_ID="you@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="TEAMID"
   ```
   electron-builder signs with the hardened runtime (`entitlements.mac.plist` is already
   set) and notarizes automatically when these are present.

> Distributing to the **Mac App Store** instead would require a different provisioning
> path (MAS target + sandbox); the `dmg`/`zip` direct-download flow above is simpler and
> recommended for an internal business tool.

---

## Windows code signing (optional)

Provide a cert to electron-builder via `CSC_LINK` (path/URL to `.pfx`) + `CSC_KEY_PASSWORD`
before `npm run dist:win`. Without a cert the installer still works but shows a SmartScreen
warning on first run.

---

## Auto-update (optional, later)

electron-builder supports `electron-updater` against a static feed (e.g. an S3/GCS bucket
or GitHub Releases). Not wired up in v1 — add `electron-updater` + a `publish` block in
`electron/package.json` when you want silent updates. Because the UI is loaded remotely,
most "updates" ship automatically via the web app; you only need desktop auto-update for
changes to `main.js`/the shell itself.

---

## Changing the app-shell URL (Inflow domain)

The URL all shells load is centralized in **`appShell.config.json`** (repo root). It is the
app *container* only — not customer-facing links. To move iOS/Android/Electron to a new
domain (e.g. `app.inflowapp.co.nz`):

```bash
# 1. edit appShell.config.json → "host" + "url"
node scripts/sync-app-shell-url.mjs   # stamps all shell files (idempotent, reversible)
# 2. rebuild: electron `npm start`/`dist`, Android `cap sync`, iOS Xcode
```

⚠️ The target domain must already serve the app over HTTPS (added as a custom domain on
the DO app, DNS as a **grey-cloud** CNAME to the DO app — mirroring `app.treemarkables.co.nz`).
A proxied/orange-cloud record double-proxies through DO's own Cloudflare edge and returns
**525** (broken TLS). Don't flip the shells until the new host returns 200.

## Notes

- `contextIsolation` is **on** and Node integration is **off** — the page is treated as an
  untrusted website (it is one). The only exposed bridge is a read-only `window.inflowDesktop`
  marker (`electron/preload.js`).
- Off-origin links and OAuth popups open in the user's real browser.
- The shell pins to `https://app.treemarkables.co.nz` — never point it at a non-HTTPS or
  non-production origin for a release build.
