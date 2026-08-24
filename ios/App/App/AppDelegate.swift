import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseSetup.configure(application)
        // Stand up Twilio VoIP push handling at the very start of launch. An
        // incoming call can cold-launch a killed/locked app via VoIP push, and
        // iOS delivers that push during launch — before the Capacitor webview
        // (and thus the plugin's load()) is ready. Setting up the PKPushRegistry
        // here guarantees a live delegate to catch the push and ring CallKit.
        TwilioVoicePlugin.shared.startVoIP()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Reclaim BEFORE didBecomeActive: when a backgrounded app is woken by a
        // notification tap, iOS can deliver the tap response between foregrounding
        // and didBecomeActive. If Capacitor's router re-stole the delegate during
        // the previous foreground session, that tap would be swallowed.
        reclaimNotificationDelegate()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        let center = UNUserNotificationCenter.current()

        // Capacitor's bridge silently installs its CAPNotificationRouter as the
        // UNUserNotificationCenter delegate when the WebView loads — AFTER
        // FirebaseSetup registered NotificationHandler.shared during launch.
        // With no Capacitor notification plugins installed, that router swallows
        // every notification tap, so our deep-link handler never fired and taps
        // always landed on the default dispatch board.
        //
        // A SINGLE reclaim in didBecomeActive is a race: Capacitor installs its
        // router when the WebView bridge finishes loading, which can land just
        // AFTER this method runs on a cold boot — re-stealing the delegate right
        // before iOS delivers the tap response, so the deep link is swallowed and
        // the app falls through to the default dispatch board. Whether we win was
        // luck of the boot timing, which is why a previously-working build can
        // "suddenly" start dropping taps after a reinstall or a slower launch.
        //
        // Reclaim immediately AND re-assert over the next ~30s so a late bridge
        // load can't hold the delegate through the window when iOS delivers the
        // tap. The old burst stopped at 3s, but on a slow cold boot (remote
        // index.html over cellular) the bridge loads AFTER that and re-stole the
        // delegate for the rest of the session — swallowing every subsequent tap.
        // reclaimNotificationDelegate() is idempotent (no-op when we already
        // own it), so the repeats are cheap and safe.
        reclaimNotificationDelegate()
        for delay in [0.3, 0.8, 1.5, 3.0, 5.0, 8.0, 12.0, 20.0, 30.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.reclaimNotificationDelegate()
            }
        }

        // Server pushes hardcode aps.badge=1 and nothing ever decrements it, so the
        // home-screen badge sticks after the user opens the app. Clear it (and any
        // lingering delivered notifications) every time we come to the foreground.
        if #available(iOS 16.0, *) {
            center.setBadgeCount(0)
        } else {
            application.applicationIconBadgeNumber = 0
        }
        center.removeAllDeliveredNotifications()
    }

    /// Make NotificationHandler.shared the UNUserNotificationCenter delegate
    /// unless it already is. Idempotent so it can be called repeatedly to defend
    /// against Capacitor's CAPNotificationRouter re-stealing the delegate after a
    /// late WebView bridge load. Logs only when it actually had to reclaim, so a
    /// swallowed-tap regression is visible in the device console.
    private func reclaimNotificationDelegate() {
        let center = UNUserNotificationCenter.current()
        if !(center.delegate is NotificationHandler) {
            print("📲 Reclaiming UNUserNotificationCenter delegate (was: \(String(describing: center.delegate)))")
            center.delegate = NotificationHandler.shared
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
