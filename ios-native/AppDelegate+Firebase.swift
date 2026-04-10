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
import WebKit
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

    // Inject the FCM token into the Capacitor WKWebView so the web layer
    // can register it with the server. Retries for up to 5 seconds to
    // handle the case where the WebView isn't fully loaded yet on launch.
    func bridgeTokenToWebView(_ token: String, attempt: Int = 0) {
        guard attempt < 10 else {
            print("⚠️ FCM bridge: WebView not found after 10 attempts")
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + (attempt == 0 ? 0 : 0.5)) {
            guard let webView = self.findCapacitorWebView() else {
                self.bridgeTokenToWebView(token, attempt: attempt + 1)
                return
            }

            // Store in localStorage AND dispatch the event so both the
            // early-capture listener (index.html) and any mounted React
            // listener will receive it, even across page reloads.
            let js = """
            (function() {
              try { localStorage.setItem('__nativeFcmToken', '\(token)'); } catch(e) {}
              window.__pendingNativeFcmToken = '\(token)';
              window.dispatchEvent(new CustomEvent('nativeFcmToken', { detail: '\(token)' }));
            })();
            """
            webView.evaluateJavaScript(js) { _, error in
                if let error = error {
                    print("⚠️ FCM bridge JS error: \(error)")
                } else {
                    print("✅ FCM token bridged to WebView (event + localStorage)")
                }
            }
        }
    }

    // Recursively search the view hierarchy for a WKWebView
    private func findCapacitorWebView() -> WKWebView? {
        guard let windowScene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            return nil
        }
        return findWebView(in: rootVC.view)
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        for subview in view.subviews {
            if let found = findWebView(in: subview) { return found }
        }
        return nil
    }
}

extension NotificationHandler: MessagingDelegate {

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("✅ FCM token received: \(token.prefix(30))...")

        // Store for retrieval after WebView loads
        UserDefaults.standard.set(token, forKey: "pendingFcmToken")

        // Bridge immediately (and retry if WebView isn't ready yet)
        bridgeTokenToWebView(token)

        // Also post to NotificationCenter for any internal listeners
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
