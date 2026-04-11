# iOS Native App Build Guide — Treemarkables

## Overview

This guide covers building the Treemarkables iOS app with:
- **Capacitor** wrapping the web app as a native iOS app
- **Twilio Voice SDK** for receiving inbound calls via CallKit
- **PushKit** so calls wake the app even when backgrounded/terminated
- **CallKit** for native iOS call UI (shows on lock screen, integrates with recent calls)

### How it works

```
Customer calls Twilio number
    ↓
Twilio hits /api/webhooks/twilio-answer
    ↓
TwiML dials <Client>treemarkables-owner</Client>
    ↓
Twilio sends VoIP push to your iPhone via PushKit
    ↓
iOS wakes the app → CallKit shows native call screen
    ↓
You answer → voice connected through Twilio
    ↓
Call recorded → Whisper transcribed → Job auto-created
    ↓
Communications page refreshes automatically
```

**`TwilioVoicePlugin.swift`** is self-contained — PushKit registration is managed
internally via a stored `PKPushRegistry` property. No changes to AppDelegate are needed.

---

## Quick Start (Automated)

A single shell script handles everything:

```bash
# On your Mac with Xcode 15+ and CocoaPods installed:
git clone <your-repo-url> treemarkables
cd treemarkables
npm install
chmod +x scripts/ios-setup.sh
./scripts/ios-setup.sh
```

The script will:
1. Build the web app
2. Create the iOS Capacitor project (`npx cap add ios`)
3. Copy `TwilioVoicePlugin.swift` and `TwilioVoicePlugin.m` into `ios/App/App/`
4. Apply `App.entitlements` with the VoIP push entitlement
5. Patch `Info.plist` with `voip`, `audio`, and `remote-notification` background modes
6. Add `pod 'TwilioVoice', '~> 6.12'` to the Podfile
7. Run `pod install`

After the script, finish the 3 manual Xcode steps below.

---

## Prerequisites

- **Mac** running macOS 14+ (Sonoma or later)
- **Xcode 15+** (free from Mac App Store)
- **Apple Developer Account** ($99/year) — needed for device testing + TestFlight
- **Node.js 20+** installed on your Mac
- **CocoaPods** installed: `sudo gem install cocoapods`

---

## Step 1 — Twilio API Key Setup (do this first)

1. Go to [Twilio Console → API Keys](https://console.twilio.com/us1/account/keys-credentials/api-keys)
2. Click **Create API Key** → Name: `Treemarkables iOS App`, type: **Standard**
3. Copy the **SID** (starts with `SK`) → add to Replit Secrets as `TWILIO_API_KEY`
4. Copy the **Secret** → add to Replit Secrets as `TWILIO_API_SECRET`

The app will NOT register for calls without these two secrets.

---

## Step 2 — Run the setup script

```bash
./scripts/ios-setup.sh
```

If it fails partway through, it is safe to re-run — all steps are idempotent.

---

## Step 3 — Open in Xcode

```bash
npx cap open ios
```

> Always open `App.xcworkspace` (NOT `App.xcodeproj`)

---

## Step 4 — Signing & Capabilities (3 manual steps in Xcode)

### 4a — Signing
1. Select the `App` target in the left panel
2. Go to **Signing & Capabilities** tab
3. Set your **Team** (your Apple Developer account)
4. Set **Bundle Identifier** to `com.treemarkables.app`
5. Leave **Automatically manage signing** checked

### 4b — Add capabilities
Click **+ Capability** and add these two:

**Push Notifications** ← click Add

**Background Modes** ← click Add, then check:
- `Voice over IP`
- `Audio, AirPlay, and Picture in Picture`
- `Remote notifications`

### 4c — Verify entitlements
Open `ios/App/App/App.entitlements` and confirm it contains:
```xml
<key>com.apple.developer.pushkit.unrestricted-voip</key>
<true/>
```
The setup script creates this file. If the file exists but is missing the key,
add it manually or re-run `scripts/ios-setup.sh`.

---

## Step 5 — Build and run on device

1. Connect your iPhone via USB
2. Select your device from the target dropdown in Xcode
3. Press **Run** (⌘R)
4. First run: trust the profile on iPhone → Settings → General → VPN & Device Management → [your Apple ID] → Trust

### Verify registration

After the app launches and you log in, check the Replit server logs for:
```
🔑 Twilio access token issued for identity: treemarkables-owner
```

---

## Step 6 — Test an incoming call

1. Call your Twilio number from any phone
2. Your iPhone shows the native CallKit screen (even from lock screen)
3. Answer — you should hear the caller
4. Hang up — Communications tab refreshes automatically showing the new call

---

## Step 7 — Keep the app in sync

After pulling new web code changes from Replit, run the sync helper:
```bash
./scripts/ios-sync.sh
```

Or manually:
```bash
npm run build
npx cap sync ios
```
Then rebuild in Xcode (⌘R).

---

## Step 7b — Firebase Push Notifications (FCM)

The app uses Firebase Cloud Messaging for push notifications (job alerts, quote acceptances, etc.).

### 7b-1 — GoogleService-Info.plist
1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Project Settings → Your apps → iOS app (Bundle ID: `com.treemarkables.app`)
3. If no iOS app exists, click **Add app** → iOS → enter `com.treemarkables.app`
4. Download **`GoogleService-Info.plist`**
5. In Xcode: drag `GoogleService-Info.plist` into the `App` group (tick "Copy items if needed" + add to `App` target)

### 7b-2 — Upload APNs key to Firebase
1. Go to [Apple Developer Portal → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Create a new key → tick **Apple Push Notifications service (APNs)** → download the `.p8` file
3. Note your **Key ID** and **Team ID** (shown top-right on the portal)
4. In Firebase Console → Project Settings → **Cloud Messaging** → Apple app configuration
5. Upload the `.p8` file to both **Development** and **Production** APNs auth key slots
6. Enter your Key ID and Team ID in both

### 7b-3 — Add Firebase iOS SDK in Xcode
1. In Xcode: **File → Add Package Dependencies**
2. Enter URL: `https://github.com/firebase/firebase-ios-sdk`
3. Click **Add Package**
4. Select these two libraries and add them to the **App** target:
   - `FirebaseCore`
   - `FirebaseMessaging`

### 7b-4 — Add AppDelegate+Firebase.swift
1. Copy `ios-native/AppDelegate+Firebase.swift` from this repo into Xcode
   - Drag it into the **App** group (same folder as AppDelegate.swift)
   - Tick "Copy items if needed" + target "App"
2. Open **AppDelegate.swift** in Xcode and add ONE line inside `application(_:didFinishLaunchingWithOptions:)`:

```swift
func application(_ application: UIApplication,
  didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {
    FirebaseSetup.configure(application)   // ← add this line
    return true
}
```

> That's it — Archive → TestFlight and push notifications will fire on device.

---

## Step 8 — TestFlight distribution

1. In Xcode: **Product → Archive**
2. Click **Distribute App** → **App Store Connect** → **Upload**
3. Go to [App Store Connect](https://appstoreconnect.apple.com) → TestFlight
4. Wait ~10 minutes for processing
5. Add yourself as internal tester → install via TestFlight app

---

## Environment Secrets Summary

| Secret | Where to get it | Required? |
|--------|----------------|-----------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info | Yes |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers | Yes |
| `TWILIO_API_KEY` | Twilio Console → API Keys → Create Standard | **iOS required** |
| `TWILIO_API_SECRET` | Shown once at API Key creation | **iOS required** |
| `TWILIO_CLIENT_IDENTITY` | Any string (default: `treemarkables-owner`) | Optional |
| `OWNER_PHONE_NUMBER` | Your personal NZ mobile (+64...) — Twilio calls this back to connect you to the recorded call | Required for call recording |

---

## Troubleshooting

**CallKit screen doesn't appear**
- App must be launched at least once after install before VoIP push works
- Check that VoIP background mode capability is in Xcode
- Verify `com.apple.developer.pushkit.unrestricted-voip` is in entitlements

**Token fetch fails (503)**
- Set `TWILIO_API_KEY` and `TWILIO_API_SECRET` in Replit Secrets
- Restart the deployed app after adding secrets

**Call connects but no audio**
- Ensure `Audio, AirPlay, Picture in Picture` background mode is checked in Xcode

**Build fails: TwilioVoice module not found**
- Run `pod install` inside `ios/App/`
- Open `App.xcworkspace` not `.xcodeproj`

**Setup script fails on pod install**
- Run `pod repo update` then re-run `./scripts/ios-setup.sh`
