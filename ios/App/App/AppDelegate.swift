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
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        let center = UNUserNotificationCenter.current()

        // Capacitor's bridge silently installs its CAPNotificationRouter as the
        // UNUserNotificationCenter delegate when the WebView loads — AFTER
        // FirebaseSetup registered NotificationHandler.shared during launch.
        // With no Capacitor notification plugins installed, that router swallows
        // every notification tap, so our deep-link handler never fired and taps
        // always landed on the default dispatch board. didBecomeActive runs after
        // the bridge loads (on launch and every foreground), and iOS delivers a
        // cold-launch tap response only once the app is active — so reclaiming
        // the delegate here wins both the warm and cold cases.
        if !(center.delegate is NotificationHandler) {
            print("📲 Reclaiming UNUserNotificationCenter delegate (was: \(String(describing: center.delegate)))")
            center.delegate = NotificationHandler.shared
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
