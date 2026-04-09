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

The `TwilioVoicePlugin` is self-contained — it handles PushKit registration
internally. No AppDelegate changes are needed.

---

## Prerequisites

- **Mac** running macOS 14+ (Sonoma or later)
- **Xcode 15+** (free from Mac App Store)
- **Apple Developer Account** ($99/year) — needed for device testing + TestFlight
- **Node.js 20+** installed on your Mac
- **CocoaPods** installed: `sudo gem install cocoapods`

---

## Step 1 — Twilio API Key Setup

Before building, create a Twilio API Key:

1. Go to [Twilio Console → API Keys](https://console.twilio.com/us1/account/keys-credentials/api-keys)
2. Click **Create API Key**
3. Name it `Treemarkables iOS App`, type: **Standard**
4. Copy the **SID** (starts with `SK`) → add to Replit Secrets as `TWILIO_API_KEY`
5. Copy the **Secret** → add to Replit Secrets as `TWILIO_API_SECRET`

The app will NOT register for calls without these secrets.

---

## Step 2 — Clone and prepare

On your Mac:

```bash
git clone <your-replit-repo-url> treemarkables
cd treemarkables
npm install
```

Build the web app first (Capacitor packages it into the native app):

```bash
npm run build
```

---

## Step 3 — Add iOS platform

```bash
npx cap add ios
```

This creates the `ios/` folder with a full Xcode project.

---

## Step 4 — Copy Twilio Voice plugin

Copy the pre-built native plugin into the Xcode project:

```bash
cp ios-native/TwilioVoicePlugin.swift ios/App/App/
cp ios-native/TwilioVoicePlugin.m ios/App/App/
```

> **Note:** Do NOT copy `AppDelegate+Twilio.swift` — it is documentation only.
> The plugin manages PushKit registration internally. No AppDelegate changes needed.

---

## Step 5 — Add Twilio Voice SDK via CocoaPods

Edit `ios/App/Podfile`. Find the `target 'App' do` section and add:

```ruby
target 'App' do
  capacitor_pods
  # Add this line:
  pod 'TwilioVoice', '~> 6.12'
end
```

Then install:

```bash
cd ios/App
pod install
cd ../..
```

> **Important:** After `pod install`, always open `App.xcworkspace` (NOT `App.xcodeproj`)

---

## Step 6 — Open in Xcode and configure

```bash
npx cap open ios
```

This opens `ios/App/App.xcworkspace` in Xcode.

### 6a — Signing

1. Select the `App` target
2. Go to **Signing & Capabilities** tab
3. Set your **Team** (your Apple Developer account)
4. Set **Bundle Identifier** to `com.treemarkables.app`
5. Let Xcode automatically manage provisioning

### 6b — Add capabilities

Still in **Signing & Capabilities**, click **+ Capability** and add:
- **Background Modes** → check:
  - `Voice over IP`
  - `Audio, AirPlay, and Picture in Picture`
  - `Remote notifications`
- **Push Notifications**

### 6c — Verify entitlements

Xcode will create `App.entitlements` automatically. Verify it contains:

```xml
<key>com.apple.developer.pushkit.unrestricted-voip</key>
<true/>
```

If it doesn't, add it manually.

---

## Step 7 — Build and run on device

1. Connect your iPhone via USB
2. Select your device from the target dropdown in Xcode
3. Press **Run** (⌘R)
4. First time: trust the developer profile on your iPhone:
   - Settings → General → VPN & Device Management → [your Apple ID] → Trust

### Verify the plugin registers

After the app launches and you log in, watch the Replit server logs for:

```
🔑 Twilio access token issued for identity: treemarkables-owner
```

And in the Xcode console:

```
[TwilioVoice] Registered — device token: abc12345...
```

---

## Step 8 — Test an incoming call

1. Call your Twilio number from any phone
2. Your iPhone shows the native CallKit screen (even from lock screen)
3. Answer it — you should hear the caller
4. Hang up — check the Communications tab; the call log refreshes automatically

---

## Step 9 — Keep web builds up to date

After making changes to the web app:

```bash
npm run build
npx cap sync ios
```

Then rebuild in Xcode.

---

## Step 10 — Distribute via TestFlight

### Archive the build

1. In Xcode: **Product → Archive**
2. The Organizer window opens automatically

### Upload to App Store Connect

1. Click **Distribute App** → **App Store Connect** → **Upload**
2. Follow the prompts (leave all defaults)

### Create TestFlight build

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Your app → **TestFlight** tab
3. Wait for processing (~10 minutes)
4. Add yourself as an internal tester
5. You'll receive an email invite → install via TestFlight app

---

## Environment Secrets Summary

| Secret | Where to get it | Required? |
|--------|----------------|-----------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info | Yes |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers | Yes |
| `TWILIO_API_KEY` | Twilio Console → API Keys → Create Standard | **New — required for iOS** |
| `TWILIO_API_SECRET` | Twilio Console → API Keys (shown once at creation) | **New — required for iOS** |
| `TWILIO_CLIENT_IDENTITY` | Set to any string (default: `treemarkables-owner`) | Optional |
| `HERO_PHONE_NUMBER` | Your real NZ mobile number (+64...) | Optional (fallback while transitioning) |

---

## Troubleshooting

**CallKit screen doesn't appear**
- Make sure the app has been launched at least once after install
- Check that VoIP background mode capability is added in Xcode
- Verify `com.apple.developer.pushkit.unrestricted-voip` is in the entitlements file

**Token fetch fails (503)**
- Set `TWILIO_API_KEY` and `TWILIO_API_SECRET` in Replit Secrets
- Restart the deployed app after adding secrets

**Call connects but no audio**
- Make sure `Audio, AirPlay, Picture in Picture` background mode is enabled in Xcode
- The `provider(_:didActivate:)` CallKit delegate routes audio through Twilio

**Build fails: TwilioVoice module not found**
- Run `pod install` inside `ios/App/`
- Always open `App.xcworkspace` (not `.xcodeproj`)

**Podfile issue: 'TwilioVoice' not found**
- Check you're on CocoaPods 1.11+: `pod --version`
- Try: `pod repo update` then `pod install` again

**[TwilioVoice] Registration error / no delegate callbacks**
- Ensure `register()` was called from JS with a valid token
- Token endpoint returns 503 if API Key secrets are not set
- Token endpoint returns 401 if not logged in — log in first
