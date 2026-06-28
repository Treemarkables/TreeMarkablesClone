# Android Native App Build Guide — Inflow

## Overview

This guide covers building the Inflow **Android** app — the counterpart to
`IOS_BUILD_GUIDE.md`. Like iOS, it is a **Capacitor shell that loads the live web app**
(`https://app.treemarkables.co.nz`); the native code only adds the two things a webview
can't do:

- **FCM push notifications** (job alerts, quote acceptances, etc.)
- **Inbound Twilio Voice calls** with a native call screen via Android's **Telecom /
  ConnectionService** framework (the equivalent of iOS CallKit)

### How an inbound call works on Android

```
Customer calls the Twilio number
    ↓
Twilio hits /api/webhooks/twilio-answer
    ↓
TwiML dials <Client>treemarkables-owner</Client>
    ↓
Twilio sends an FCM DATA message to the phone   (← Android uses FCM, not PushKit)
    ↓
VoiceFirebaseMessagingService.onMessageReceived → Voice.handleMessage()
    ↓
addNewIncomingCall() → VoiceConnectionService shows the native call UI (even when locked)
    ↓
Answer → audio connected through Twilio → recorded → Whisper transcribed → job created
```

The same FCM channel carries both regular notifications and call invites —
`Voice.handleMessage()` tells them apart.

---

## App-shell URL (Inflow domain)

The URL the shell loads + the native FCM-registration server are centralized in
**`appShell.config.json`** (repo root) — the app *container*, not customer-facing links.
To move to a new domain (e.g. `app.inflowapp.co.nz`): edit `appShell.config.json`, run
`node scripts/sync-app-shell-url.mjs` (idempotent; `android-setup.sh`/`android-sync.sh`
run it for you), then rebuild. The target host must already serve the app over HTTPS via a
**grey-cloud** CNAME to the DO app — a proxied/orange-cloud record returns **525**.

## Prerequisites

- **Android Studio** (latest) with the Android SDK + **JDK 17**
- A physical Android device (calls + FCM data delivery must be tested on real hardware —
  emulators and battery-optimised devices behave differently)
- **Node.js 20+**
- A **Google Play Console** account ($25 one-time) for store distribution
- Access to the existing **Firebase project** (the same one the iOS app uses) and the
  **Twilio Console**

---

## Quick Start (Automated)

```bash
# On a machine with Android Studio + JDK 17:
cd <repo root>
npm install            # ask the owner first — adds @capacitor/android (see step 1)
npx cap add android    # (the setup script also does this if android/ is missing)
chmod +x scripts/android-setup.sh
./scripts/android-setup.sh
```

`scripts/android-setup.sh` is idempotent and:
1. Builds the web app (`npm run build`)
2. Adds/syncs the Android Capacitor platform
3. Copies the Kotlin sources from `android-native/` into `android/app/src/main/java/co/nz/inflowapp/`
4. Deletes the generated `MainActivity.java` (replaced by `MainActivity.kt`)
5. Applies the Google Services plugin + classpath
6. Adds the Firebase + Twilio Voice Gradle dependencies
7. Patches `AndroidManifest.xml` with the permissions + the two services

Then finish the manual steps below (Firebase file, Twilio credential, signing).

---

## Step 1 — Install the Capacitor Android package

`@capacitor/android` is not yet in `package.json`. **Ask before installing** (the repo
rule), then:

```bash
npm install @capacitor/android@^8.3.0
```

(The version must match the existing `@capacitor/core` major — currently `8.x`.)

---

## Step 2 — Firebase (FCM) setup

The Android app reuses the **same Firebase project** as iOS.

1. [Firebase Console](https://console.firebase.google.com) → the project → **Project
   Settings → Your apps → Add app → Android**
2. Package name: **`co.nz.inflowapp`**
3. Download **`google-services.json`**
4. Place it at **`android/app/google-services.json`**
   (see `android-native/google-services.json.PLACEHOLDER`)

No server change is needed for normal push — the server already sends Android-targeted
FCM messages (`android.priority: 'high'`, notification+data) via Firebase Admin
(`server/services/firebaseMessagingService.ts`). The Android device registers its FCM
token through the same endpoint iOS uses: `POST /api/notifications/register-native-fcm-token`
(authenticated by `x-webhook-secret`), implemented in `VoiceFirebaseMessagingService`.

### Native registration secret (keep it out of git)

The webhook secret for that endpoint is **not** hardcoded in the Kotlin (unlike the older
iOS file). It is injected into `BuildConfig` at build time from a gitignored file:

```bash
cp android-native/secrets.properties.example android-native/secrets.properties
# then edit android-native/secrets.properties:
#   INFLOW_WEBHOOK_SECRET=<value of HERO_WEBHOOK_SECRET>
#   INFLOW_OWNER_EMPLOYEE_ID=<the owner's employee UUID>
```

`android-native/secrets.properties` is gitignored. If it's missing/empty, native FCM
registration is skipped (logged), and push won't bind for the owner. `scripts/android-setup.sh`
wires the `buildConfigField` lines into `android/app/build.gradle` automatically.

---

## Step 3 — Twilio Android Push Credential (for calls)

iOS calls use an **APNs** push credential; Android needs a separate **FCM** push
credential registered in Twilio.

1. In the **Firebase Console** → Project Settings → **Cloud Messaging**, get the FCM
   server credentials. Twilio needs the **service account / server key** for this project.
2. [Twilio Console → Voice → Push Credentials](https://console.twilio.com/) →
   **Create new Credential** → type **FCM** → paste the FCM server key/secret.
3. Copy the new Credential **SID** (`CR...`).
4. Add it to **Digital Ocean App Platform** env as:
   ```
   TWILIO_PUSH_CREDENTIAL_SID_ANDROID=CRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   The token endpoint (`/api/twilio/token`) now reads the posted `platform` and returns
   this Android credential SID for Android clients, the existing
   `TWILIO_PUSH_CREDENTIAL_SID` for iOS. (The web hook already posts the platform — see
   `client/src/hooks/useTwilioVoice.ts`.)

The Twilio **API Key/Secret** (`TWILIO_API_KEY`, `TWILIO_API_SECRET`) and the TwiML app
SID are shared with iOS — already set if iOS calls work.

---

## Step 4 — Confirm `minSdkVersion`

Twilio Voice 6.x requires **API 24+**. In `android/app/build.gradle`:

```gradle
android {
  defaultConfig {
    minSdkVersion 24
  }
}
```

---

## Step 5 — Open & run on a device

```bash
npx cap open android
```

- Connect a device with USB debugging on → Run.
- On first launch, grant **microphone** and **notifications** permissions (requested by
  `MainActivity`).
- Verify FCM registration in the server logs (DO dashboard):
  `FCM token registered with server` and, after login, the Twilio token line:
  `🔑 Twilio access token issued for identity: treemarkables-owner (platform: android, …)`.

---

## Step 6 — Test an incoming call

1. Call the Twilio number from any phone.
2. The device shows the **native incoming-call screen** (even when locked).
3. Answer — audio connects through Twilio.
4. Hang up — the Communications tab updates with the new call/recording.

If the call doesn't ring when the app is **terminated**, disable battery optimisation for
the app (OEM-specific; common on Xiaomi/Oppo/Samsung).

---

## Step 7 — Keep in sync after web changes

```bash
./scripts/android-sync.sh
```

(Builds the web app, `cap sync android`, and re-copies the Kotlin sources.)

---

## Step 8 — Signing & Play Store

1. **Create an upload keystore** (once):
   ```bash
   keytool -genkey -v -keystore inflow-upload.keystore \
     -alias inflow -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store it safely — losing it blocks future updates (unless using Play App Signing).
2. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**,
   select the keystore.
3. [Google Play Console](https://play.google.com/console) → create the app → upload the
   `.aab` to **Internal testing** first.
4. Complete the store listing, data-safety form, and content rating, then promote to
   production.

> Use **Play App Signing** (recommended) so Google manages the app signing key and your
> keystore is only the *upload* key.

---

## Environment Secrets Summary (Android-specific)

| Secret | Where | Required? |
|--------|-------|-----------|
| `TWILIO_PUSH_CREDENTIAL_SID_ANDROID` | Twilio Console → Voice → Push Credentials (FCM) | **Android calls** |
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | Twilio Console → API Keys | Yes (shared w/ iOS) |
| `TWILIO_TWIML_APP_SID` | Twilio Console → TwiML Apps | Optional (outgoing) |
| `HERO_WEBHOOK_SECRET` | DO env (already set) | Yes (FCM token registration) |

`google-services.json` lives in the repo at `android/app/` (gitignore it if it contains a
restricted key; the standard `google-services.json` is safe to commit but keep parity with
how iOS handles `GoogleService-Info.plist`).

---

## Troubleshooting

**No native call screen appears**
- Confirm `MANAGE_OWN_CALLS` permission + the self-managed `PhoneAccount` is registered
  (logcat: `addNewIncomingCall failed` → falls back to a notification).
- The app must have been launched once after install.
- Check `TWILIO_PUSH_CREDENTIAL_SID_ANDROID` is set and the access token shows
  `push: enabled` for `platform: android` in the server logs.

**Push works but calls don't (or vice-versa)**
- Both ride the one FCM channel. If neither works, `google-services.json` is missing/wrong
  package. If push works but calls don't, the Twilio FCM credential is the issue.

**Calls don't ring when the app is killed**
- OEM battery optimisation — exclude the app. This is the Android equivalent of the iOS
  "launched at least once" caveat.

**Build fails: `com.google.gms.google-services` not found**
- The project-level classpath wasn't applied — re-run `scripts/android-setup.sh` or add
  `classpath 'com.google.gms:google-services:4.4.2'` manually (see
  `android-native/project-build.gradle.additions`).
