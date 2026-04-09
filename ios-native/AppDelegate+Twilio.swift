// AppDelegate+Twilio.swift
//
// NOTE: This file is NOT needed when using TwilioVoicePlugin.swift.
// TwilioVoicePlugin handles PushKit registration internally via its stored
// voipRegistry property. No AppDelegate changes are required.
//
// This file is kept as documentation only. Do NOT add a second PKPushRegistry
// in AppDelegate — it would conflict with the plugin's own registry.
//
// The ONLY required change to AppDelegate.swift is none: Capacitor's default
// AppDelegate works out of the box. Just ensure the Xcode capabilities are set:
//
//   Signing & Capabilities → + Capability:
//     - Background Modes → Voice over IP
//                        → Audio, AirPlay, and Picture in Picture
//                        → Remote notifications
//     - Push Notifications
//
// And the entitlements must include:
//   <key>com.apple.developer.pushkit.unrestricted-voip</key>
//   <true/>
