// AppDelegate+Firebase.swift
//
// Firebase Cloud Messaging setup for Inflow iOS app.
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
// STEP D — Fill in webhookSecret in NativeTokenRegistration below:
//   Copy the value of HERO_WEBHOOK_SECRET from Replit Secrets and paste it in.
//
// ───────────────────────────────────────────────────────────────────────────

import UIKit
import WebKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

// ── Native token registration ──────────────────────────────────────────────
// Registers the FCM token directly with the Replit server via a webhook-secret
// authenticated endpoint — works even when the WebView is loading local assets
// (no active session required).
private enum NativeTokenRegistration {
    // MANAGED: app-shell container URL. Change via appShell.config.json +
    // `node scripts/sync-app-shell-url.mjs`, not by hand.
    static let serverURL = "https://app.treemarkables.co.nz"

    // ⚠️  FILL THIS IN — paste the value of HERO_WEBHOOK_SECRET from Replit Secrets.
    static let webhookSecret = "TreemarkablesHero2026SecureWebhook"

    // Owner's employee UUID (correct for the Inflow production database).
    static let ownerEmployeeId = "7e093425-0023-4069-ae7a-8127656116a8"

    static func registerToken(_ token: String) {
        guard webhookSecret != "REPLACE_WITH_HERO_WEBHOOK_SECRET" else {
            print("⚠️ NativeTokenRegistration: webhookSecret not set — skipping direct registration")
            return
        }
        guard let url = URL(string: "\(serverURL)/api/notifications/register-native-fcm-token") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(webhookSecret, forHTTPHeaderField: "x-webhook-secret")
        request.timeoutInterval = 15

        let body: [String: String] = [
            "token": token,
            "employeeId": ownerEmployeeId,
            "deviceInfo": "iOS Native (\(UIDevice.current.systemVersion))"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("⚠️ Native FCM registration error: \(error.localizedDescription)")
                return
            }
            if let http = response as? HTTPURLResponse {
                let responseBody = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                if http.statusCode == 200 {
                    print("✅ Native FCM token registered with server")
                } else {
                    print("⚠️ Native FCM registration failed HTTP \(http.statusCode): \(responseBody)")
                }
            }
        }.resume()
    }
}
// ──────────────────────────────────────────────────────────────────────────

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

        // 1. Register directly with the server via native HTTP (primary, most reliable)
        NativeTokenRegistration.registerToken(token)

        // 2. Bridge to WebView for the session-based path (backup — works when server.url is set)
        bridgeTokenToWebView(token)

        // 3. Post to NotificationCenter for any internal listeners
        NotificationCenter.default.post(
            name: Notification.Name("FCMTokenReceived"),
            object: nil,
            userInfo: ["token": token]
        )
    }
}

// Capacitor uses ApplicationDelegateProxy which can block Firebase's automatic
// APNs token swizzling. This extension manually forwards the APNs device token
// to Firebase Messaging so it can exchange it for an FCM token.
extension AppDelegate {

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        print("✅ APNs device token received (\(deviceToken.count) bytes) — forwarding to Firebase")
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("⚠️ APNs registration failed: \(error.localizedDescription)")
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
