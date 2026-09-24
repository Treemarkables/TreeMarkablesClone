import UIKit
import WebKit

/// Recovers a dead or never-painted Capacitor WKWebView.
///
/// The TestFlight shell loads the live SPA from `server.url` in
/// capacitor.config.json (`https://app.inflowapp.co.nz`). After LaunchScreen
/// dismisses, the webview sits on `about:blank` until that remote document
/// commits. Two native bugs turned that gap into a stuck black screen:
///
/// 1. `paintShell` used to set `isOpaque = false` from `capacitorDidLoad`,
///    which runs *before* Capacitor's `willLoadWebview`. Capacitor snapshots
///    `isOpaque` there and restores the snapshot in `didFinish`. Snapshotting
///    `false` meant every successful load was restored to a non-opaque
///    webview. `didFailProvisionalNavigation` (the cold-start "network not
///    ready" failure) never restores opacity at all. A non-opaque WKWebView
///    composites as black, intermittently, until the process is killed —
///    force-quit + reopen. Probes then set `isOpaque = false` again at 6s,
///    so a paint that did succeed could go black after the fact.
/// 2. A blank document that stayed `isLoading` was left alone for 20s. Staff
///    force-quit before that.
///
/// Keep the webview **opaque**. `backgroundColor` / `underPageBackgroundColor`
/// are the shell color. Do not set `isOpaque = false` to hide the about:blank
/// flash — that is the black-screen bug.
///
/// We do **not** steal WKNavigationDelegate from Capacitor. We probe the
/// webview on a cold-start ladder and on every foreground, then call
/// `load(URLRequest)` against the configured remote URL (never `reload()` of
/// about:blank, which is a no-op).
///
/// Probe strings match `classifyBootSurface` / `shouldReloadNativeProbe` in
/// `client/src/lib/nativeBootRecovery.ts`.
final class WebViewBootRecovery {
    static let shared = WebViewBootRecovery()

    private weak var webView: WKWebView?
    private var lastLoadAt = Date()
    private var reloadCount = 0
    private var sawHealthyBoot = false
    private let maxReloads = 3
    private let shellColor = UIColor(red: 26 / 255, green: 26 / 255, blue: 26 / 255, alpha: 1)

    private let probeJS = """
    (function() {
      var host = location.hostname || '';
      var href = location.href || '';
      if (host.indexOf('app.inflowapp.co.nz') === -1 && host.indexOf('app.treemarkables.co.nz') === -1) {
        return (href === 'about:blank' || href.indexOf('about:') === 0 || host === '') ? 'blank' : 'wrong-origin';
      }
      function norm(el) {
        return ((el && (el.innerText || '')) || '').replace(/\\s+/g, ' ').trim();
      }
      function placeholder(text) {
        return text === 'Opening Inflow' || text.indexOf('Opening Inflow ') === 0;
      }
      var boot = document.getElementById('inflow-boot');
      var bootShowing = !!(boot && boot.getAttribute('data-booted') !== '1');
      var root = document.getElementById('root');
      var main = root ? root.querySelector('main') : null;
      var rootText = norm(root);
      var mainText = main ? norm(main) : null;
      var visible = mainText !== null
        ? (mainText.length > 0 && !placeholder(mainText))
        : (rootText.length > 0 && !placeholder(rootText));
      if (window.__INFLOW_BOOTED === true) {
        return (visible || bootShowing) ? 'booted' : 'empty';
      }
      var hb = window.__INFLOW_HEARTBEAT_MS || 0;
      var age = hb ? (Date.now() - hb) : 999999;
      if (bootShowing && age < 8000) return 'painting';
      return 'not-booted';
    })();
    """

    private init() {}

    func attach(webView: WKWebView?) {
        self.webView = webView
        lastLoadAt = Date()
        paintShell(webView)

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )

        // Cold-start ladder. A blank webview that is still "loading" at 4s
        // has not committed a document (radio not up / provisional failure).
        // The old 6s/20s ladder was longer than staff wait before force-quit.
        for delay in [2.0, 4.0, 10.0, 18.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.inspectAndRecover(reason: "cold-start+\(Int(delay))s")
            }
        }
    }

    @objc private func appDidBecomeActive() {
        // Brief delay so a healthy in-flight boot is not interrupted the
        // moment the LaunchScreen hands off. Frozen restored webviews still
        // fail the probe and get a fresh load.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
            self?.inspectAndRecover(reason: "foreground")
        }
    }

    private func paintShell(_ webView: WKWebView?) {
        guard let webView else { return }
        // Opaque. See the type comment — `isOpaque = false` is the stuck
        // black screen. Re-assert on every probe so a provisional navigation
        // failure (Capacitor never restores opacity) cannot leave it false,
        // and so a later probe cannot undo a successful restore.
        webView.isOpaque = true
        webView.backgroundColor = shellColor
        webView.scrollView.backgroundColor = shellColor
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = shellColor
        }
        webView.superview?.backgroundColor = shellColor
    }

    private func inspectAndRecover(reason: String) {
        guard let webView else { return }
        paintShell(webView)

        let href = webView.url?.absoluteString ?? ""
        let elapsed = Date().timeIntervalSince(lastLoadAt)
        let loading = webView.isLoading
        let blank = href.isEmpty || href.hasPrefix("about:")
        let foreground = reason.hasPrefix("foreground")

        if blank || !isAppOrigin(href) {
            let probe = blank ? "blank" : "wrong-origin"
            if shouldReload(probe: probe, elapsed: elapsed, isLoading: loading, force: foreground && !loading) {
                loadApp(reason: "\(reason) \(probe) url=\(href)")
            }
            return
        }

        webView.evaluateJavaScript(probeJS) { [weak self] result, error in
            guard let self, let webView = self.webView else { return }
            if let error {
                self.loadApp(reason: "\(reason) js-error \(error.localizedDescription)")
                return
            }
            let status = result as? String ?? "not-booted"
            if status == "booted" {
                self.sawHealthyBoot = true
                return
            }
            let elapsedNow = Date().timeIntervalSince(self.lastLoadAt)
            if self.shouldReload(
                probe: status,
                elapsed: elapsedNow,
                isLoading: webView.isLoading,
                force: false
            ) {
                self.loadApp(reason: "\(reason) probe=\(status)")
            }
        }
    }

    /// Same thresholds as `shouldReloadNativeProbe` in nativeBootRecovery.ts.
    private func shouldReload(probe: String, elapsed: TimeInterval, isLoading: Bool, force: Bool) -> Bool {
        switch probe {
        case "booted", "painting":
            return false
        case "empty":
            return !sawHealthyBoot
        case "blank", "wrong-origin":
            if force && !isLoading { return true }
            if isLoading { return elapsed >= 4 }
            return elapsed >= 2
        default:
            if isLoading && elapsed < 4 { return false }
            return elapsed >= 18
        }
    }

    private func isAppOrigin(_ href: String) -> Bool {
        guard let url = URL(string: href), let host = url.host else { return false }
        return host.contains("app.inflowapp.co.nz") || host.contains("app.treemarkables.co.nz")
    }

    private func loadApp(reason: String) {
        guard reloadCount < maxReloads else {
            print("⚠️ WebViewBootRecovery: gave up after \(maxReloads) reloads (\(reason))")
            return
        }
        guard let webView else { return }
        let url = remoteAppURL()
        reloadCount += 1
        lastLoadAt = Date()
        print("🔁 WebViewBootRecovery reload #\(reloadCount): \(reason) → \(url.absoluteString)")
        webView.stopLoading()
        paintShell(webView)
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45)
        webView.load(request)
    }

    private func remoteAppURL() -> URL {
        let base: URL = {
            if let file = Bundle.main.url(forResource: "capacitor.config", withExtension: "json"),
               let data = try? Data(contentsOf: file),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let server = json["server"] as? [String: Any],
               let remote = server["url"] as? String,
               let parsed = URL(string: remote) {
                return parsed
            }
            return URL(string: "https://app.inflowapp.co.nz")!
        }()
        // Cold-start recovery used to load the origin with no path, wiping a
        // notification tap that had already been injected as /dispatch?job=.
        if let path = NotificationDeepLinkStore.current() {
            let trimmed = base.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let suffix = path.hasPrefix("/") ? path : "/" + path
            if let withPath = URL(string: trimmed + suffix) {
                return withPath
            }
        }
        return base
    }
}
