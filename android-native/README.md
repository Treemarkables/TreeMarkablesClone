# android-native — staged native sources for the Android app

This directory is the Android counterpart of `ios-native/`. The files here are **staged**
(not part of a Gradle project on their own); `scripts/android-setup.sh` copies them into
the generated `android/` Capacitor project and applies the Gradle/Manifest changes.

The app is a **remote-URL Capacitor shell** — it loads `https://app.treemarkables.co.nz`,
so there is no per-platform web bundle. The native code only provides the two features the
webview can't do itself: **push notifications** and **inbound Twilio calls**.

## What's here

| File | Purpose | iOS counterpart |
|------|---------|-----------------|
| `co/nz/inflowapp/MainActivity.kt` | Registers the plugin + PhoneAccount, requests permissions, bridges the FCM token to the webview | `AppDelegate.swift` |
| `co/nz/inflowapp/voice/TwilioVoicePlugin.kt` | Capacitor plugin — same JS contract as iOS (`register/answer/reject/hangup/mute/setSpeaker` + events) | `TwilioVoicePlugin.swift` |
| `voice/VoiceFirebaseMessagingService.kt` | One FCM entry point: registers the token with the server + routes Twilio call invites into Telecom | `AppDelegate+Firebase.swift` + PushKit handler |
| `voice/VoiceConnectionService.kt` | Self-managed Telecom service — the native call UI | CallKit `CXProvider` |
| `voice/VoiceConnection.kt` | One Telecom call; maps answer/hangup/mute onto the Twilio call | `CXProviderDelegate` |
| `voice/TwilioCallListener.kt` | Twilio `Call.Listener` → Telecom + JS events | `CallDelegate` |
| `voice/IncomingCallNotifier.kt` | Full-screen-notification fallback if Telecom refuses the call | (n/a) |
| `voice/VoiceConstants.kt` | Shared constants + event names (must match JS) | constants in the plugin |
| `*.additions` / `AndroidManifest.additions.xml` | Gradle + manifest changes the setup script applies | `Podfile.addition`, `App.entitlements` |

## Architecture notes (read before debugging)

- **One FCM channel does both jobs.** Unlike iOS (PushKit for VoIP + APNs/FCM for normal
  push are separate), Android receives Twilio call invites as FCM **data messages** through
  the same `FirebaseMessagingService`. `Voice.handleMessage()` decides if a message is a
  Twilio invite; anything else is a normal push.
- **Twilio register needs the FCM token**, not a separate VoIP token. `register({token})`
  (the access token) fetches the current FCM token and calls `Voice.register(...)`.
- **The server needs a separate Twilio push credential for Android** (an FCM credential,
  distinct from the iOS APNs one). The token endpoint picks it via the posted `platform`
  (`TWILIO_PUSH_CREDENTIAL_SID_ANDROID`). See `ANDROID_BUILD_GUIDE.md`.
- **Calls work without the webview alive.** The Telecom UI is presented by the OS from the
  FCM service, exactly like CallKit. JS events only fire once the webview/plugin is loaded
  (`VoiceCallState.listener`). This is intentional parity with iOS.
- **Must be tested on a physical device.** Telecom self-managed calls, full-screen intents,
  and FCM data-message delivery behave differently on emulators / when battery-optimised.
  (Same lesson as iOS: push could only be judged on a real device via TestFlight.)

## Known gotchas to verify on-device

- `MANAGE_OWN_CALLS` + a registered self-managed `PhoneAccount` are required or
  `addNewIncomingCall` throws `SecurityException` (we fall back to a notification).
- Android 14+ needs `FOREGROUND_SERVICE_PHONE_CALL`.
- Some OEMs (Xiaomi/Oppo/Huawei) aggressively kill background FCM — the owner may need to
  disable battery optimisation for the app for calls to ring when terminated.
