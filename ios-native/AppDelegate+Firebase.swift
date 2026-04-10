// AppDelegate+Firebase.swift
//
// Firebase Cloud Messaging setup for Treemarkables iOS app.
//
// ─── SETUP INSTRUCTIONS ────────────────────────────────────────────────────
//
// STEP A — Add Firebase iOS SDK in Xcode (Swift Package Manager):
//   File → Add Package Dependencies
//   URL: https://github.com/firebase/firebase-ios-sdk
//   When prompted, add these two libraries to the "App" target:
//     • FirebaseCore
//     • FirebaseMessaging
//
// STEP B — Drag this file into the App group in Xcode
//   (tick "Copy items if needed", target "App")
//
// STEP C — Add ONE line to AppDelegate.swift
//   Open AppDelegate.swift and add this inside
//   application(_:didFinishLaunchingWithOptions:), before the return:
//
//     FirebaseSetup.configure(application)
//
//   Full method should look like:
//
//     func application(_ application: UIApplication,
//       didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
//     ) -> Bool {
//       FirebaseSetup.configure(application)   // ← add this line
//       return true
//     }
//
// ───────────────────────────────────────────────────────────────────────────

import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

enum FirebaseSetup {

    static func configure(_ application: UIApplication) {
        FirebaseApp.configure()
        print("✅ Firebase configured")

        Messaging.messaging().delegate = NotificationHandler.shared

        UNUserNotificationCenter.current().delegate = NotificationHandler.shared
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
            print(granted ? "✅ Push permission granted" : "⚠️ Push permission denied: \(error?.localizedDescription ?? "")")
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }
}

final class NotificationHandler: NSObject {
    static let shared = NotificationHandler()
    private override init() {}
}

extension NotificationHandler: MessagingDelegate {

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("✅ FCM token: \(token.prefix(30))...")
        NotificationCenter.default.post(
            name: Notification.Name("FCMTokenReceived"),
            object: nil,
            userInfo: ["token": token]
        )
    }
}

extension NotificationHandler: UNUserNotificationCenterDelegate {

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }
}
