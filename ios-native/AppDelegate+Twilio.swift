// AppDelegate+Twilio.swift
//
// Drop this file into ios/App/App/ alongside AppDelegate.swift after running `npx cap add ios`.
// It hooks PushKit VoIP push registration into the Capacitor app lifecycle.
//
// IMPORTANT: In AppDelegate.swift, add the following import at the top:
//   import PushKit
//
// No other changes to AppDelegate.swift are needed — this extension handles everything.

import UIKit
import PushKit
import Capacitor

extension AppDelegate: PKPushRegistryDelegate {

    // Called by AppDelegate.application(_:didFinishLaunchingWithOptions:)
    // Add this call inside that method:
    //   self.setupVoIPPush()
    func setupVoIPPush() {
        let pushRegistry = PKPushRegistry(queue: DispatchQueue.main)
        pushRegistry.delegate = self
        pushRegistry.desiredPushTypes = [.voIP]
    }

    // MARK: - PKPushRegistryDelegate

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        // Forward to TwilioVoicePlugin
        NotificationCenter.default.post(
            name: Notification.Name("TwilioVoIPPushCredentialsUpdated"),
            object: pushCredentials
        )
    }

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        NotificationCenter.default.post(
            name: Notification.Name("TwilioVoIPPushTokenInvalidated"),
            object: nil
        )
    }

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        // IMPORTANT: iOS 13+ requires you to report a call to CallKit here
        // even before TwilioVoiceSDK processes the payload.
        // TwilioVoicePlugin handles this via NotificationCenter.
        NotificationCenter.default.post(
            name: Notification.Name("TwilioVoIPPushReceived"),
            object: payload,
            userInfo: ["completion": completion as Any]
        )
    }
}
