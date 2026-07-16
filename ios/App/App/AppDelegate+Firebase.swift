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
// NOTE — Token registration is handled entirely by the web layer. The FCM token
//   is bridged into the WebView (see bridgeTokenToWebView) and the web app POSTs
//   it to /api/notifications/register-token using the logged-in employee's
//   session cookie. This is per-user, so each staff device registers against
//   whoever is actually signed in — no hardcoded owner ID.
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
    // can register it with the server. Retries for up to ~10 seconds.
    //
    // Must wait until the WebView's document is actually on the app origin:
    // on a cold launch the WKWebView exists within milliseconds while still
    // on about:blank, and an injection at that point silently lands on the
    // wrong origin — localStorage write lost, event fired with no listener —
    // while evaluateJavaScript reports success. That race meant a token
    // rotated by a reinstall was never registered with the server, so the
    // device silently stopped receiving pushes (same cold-boot race as the
    // notification deep-link; same origin-guard fix).
    func bridgeTokenToWebView(_ token: String, attempt: Int = 0) {
        guard attempt < 20 else {
            print("⚠️ FCM bridge: gave up after 20 attempts — token not delivered to web layer")
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
              if (location.origin.indexOf('app.inflowapp.co.nz') === -1 && location.origin.indexOf('app.treemarkables.co.nz') === -1) return 'wrong-origin';
              try { localStorage.setItem('__nativeFcmToken', '\(token)'); } catch(e) {}
              window.__pendingNativeFcmToken = '\(token)';
              window.dispatchEvent(new CustomEvent('nativeFcmToken', { detail: '\(token)' }));
              return 'ok';
            })();
            """
            webView.evaluateJavaScript(js) { result, error in
                if let error = error {
                    print("⚠️ FCM bridge JS error: \(error) — retrying")
                    self.bridgeTokenToWebView(token, attempt: attempt + 1)
                    return
                }
                if let status = result as? String, status == "ok" {
                    print("✅ FCM token bridged to WebView (event + localStorage)")
                } else {
                    // Document not yet on the app origin (about:blank / mid-load).
                    self.bridgeTokenToWebView(token, attempt: attempt + 1)
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

        // Register via the WebView/session path ONLY. The web app POSTs the
        // token to /api/notifications/register-token with the logged-in
        // employee's session cookie, so the token attaches to whoever is
        // actually signed in on this device — essential for multi-staff use.
        //
        // The old NativeTokenRegistration path that POSTed with a hardcoded
        // ownerEmployeeId has been removed: it caused every device to register
        // as the owner, so staff couldn't receive their own notifications.
        bridgeTokenToWebView(token)

        // Post to NotificationCenter for any internal listeners
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
        let userInfo = response.notification.request.content.userInfo
        print("📲 Push tap — userInfo keys: \(userInfo.keys.map { "\($0)" })")

        // 1. Prefer the explicit clickAction the server includes.
        // 2. Fall back to constructing a URL from the data fields, so the tap
        //    still routes somewhere meaningful if clickAction is ever missing
        //    (matches the firebase-messaging-sw.js fallback logic).
        let path = pathFromUserInfo(userInfo)
        if let path = path {
            print("📲 Push tap — navigating WebView to: \(path)")
            navigateWebView(to: path)
        } else {
            print("📲 Push tap — could not resolve a navigation target; userInfo=\(userInfo)")
        }
        completionHandler()
    }

    private func pathFromUserInfo(_ userInfo: [AnyHashable: Any]) -> String? {
        if let clickAction = userInfo["clickAction"] as? String, !clickAction.isEmpty {
            return clickAction
        }

        let type = (userInfo["type"] as? String) ?? ""
        let jobId = (userInfo["jobId"] as? String) ?? ""
        let conversationId = (userInfo["conversationId"] as? String) ?? ""

        switch type {
        case "job_assignment", "schedule_change":
            return jobId.isEmpty ? "/dispatch" : "/dispatch?job=\(jobId)"
        case "new_conversation", "conversation_reply":
            // Conversation notifications open the conversation. (The server sets
            // clickAction for these, so this fallback rarely runs — but the real
            // list route is /inbox, not the non-existent /conversations.)
            if !conversationId.isEmpty { return "/conversation/\(conversationId)" }
            return "/inbox"
        case "new_lead":
            return jobId.isEmpty ? "/inbox" : "/dispatch?job=\(jobId)&tab=diary"
        case "invoice_payment":
            return "/invoices"
        case "quote_accepted":
            return "/quotes"
        default:
            return nil
        }
    }

    private func navigateWebView(to path: String, attempt: Int = 0) {
        // Up to ~6s of retries (20 × 0.3s). A cold launch from a notification tap
        // fires this before the WebView has even loaded the app origin, so we
        // can't just deliver once — we retry until the document is actually on
        // the app origin (app.inflowapp.co.nz), otherwise the localStorage write below would
        // land on about:blank and be lost.
        guard attempt < 20 else {
            print("⚠️ Navigation: gave up delivering deep link after 20 attempts: \(path)")
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + (attempt == 0 ? 0 : 0.3)) {
            guard let webView = self.findCapacitorWebView() else {
                self.navigateWebView(to: path, attempt: attempt + 1)
                return
            }

            let escaped = path.replacingOccurrences(of: "\\", with: "\\\\")
                              .replacingOccurrences(of: "'", with: "\\'")

            // Two delivery channels, because the right one depends on app state:
            //   • Warm start (app already running): the CustomEvent reaches the
            //     mounted React listener → instant SPA navigation, no reload.
            //   • Cold start (app was killed): this script runs before React —
            //     even before index.html — so the event is lost. We instead
            //     persist the target in localStorage; the web app consumes it on
            //     mount (see App.tsx). This is the same persist-and-replay pattern
            //     the FCM-token bridge already uses.
            // We return a status so Swift can retry until the document is on the
            // app origin (localStorage is per-origin; writing at about:blank is
            // useless). The window.location.assign fallback is gated on a fully
            // loaded document so it can NEVER race the cold-boot render — that
            // race is exactly what used to dump every tap onto the dashboard.
            let js = """
            (function() {
              if (location.origin.indexOf('app.inflowapp.co.nz') === -1 && location.origin.indexOf('app.treemarkables.co.nz') === -1) return 'wrong-origin';
              var path = '\(escaped)';
              try {
                localStorage.setItem('pendingNotificationNav', JSON.stringify({ path: path, ts: Date.now() }));
              } catch (e) {}
              window.__pendingNotificationPath = path;
              var handled = false;
              var ack = function() { handled = true; };
              window.addEventListener('nativeNotificationTapAck', ack, { once: true });
              window.dispatchEvent(new CustomEvent('nativeNotificationTap', { detail: path }));
              setTimeout(function() {
                window.removeEventListener('nativeNotificationTapAck', ack);
                if (!handled && document.readyState === 'complete') {
                  try { window.location.assign(path); } catch (e) {}
                }
              }, 150);
              return 'ok';
            })();
            """

            webView.evaluateJavaScript(js) { result, error in
                if let error = error {
                    print("⚠️ Navigation JS error: \(error) — retrying")
                    self.navigateWebView(to: path, attempt: attempt + 1)
                    return
                }
                if let status = result as? String, status == "ok" {
                    print("✅ Deep link delivered to WebView: \(path)")
                } else {
                    // Document not yet on the app origin (about:blank / mid-load).
                    self.navigateWebView(to: path, attempt: attempt + 1)
                }
            }
        }
    }
}
