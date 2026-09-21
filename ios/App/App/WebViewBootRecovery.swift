import UIKit
import WebKit

/// Recovers a dead or never-painted Capacitor WKWebView.
///
/// The TestFlight shell loads the live SPA from `server.url` in
/// capacitor.config.json (`https://app.inflowapp.co.nz`). After LaunchScreen
/// dismisses, the webview sits on `about:blank` (white) until that remote
/// document + JS actually run. If the first load hangs, the content process
/// dies, or JS never sets `window.__INFLOW_BOOTED`, the user sees a white
/// screen until they force-quit — there was no retry in the app target.
///
/// We do **not** steal WKNavigationDelegate from Capacitor. We probe the
/// webview on a cold-start ladder and on every foreground, then call
/// `load(URLRequest)` against the configured remote URL (never `reload()` of
/// about:blank, which is a no-op).
final class WebViewBootRecovery {
    static let shared = WebViewBootRecovery()

    private weak var webView: WKWebView?
    private var lastLoadAt = Date()
    private var reloadCount = 0
    private let maxReloads = 3
    private let shellColor = UIColor(red: 26 / 255, green: 26 / 255, blue: 26 / 255, alpha: 1)

    private let probeJS = """
    (function() {
      var host = location.hostname || '';
      if (host.indexOf('app.inflowapp.co.nz') === -1 && host.indexOf('app.treemarkables.co.nz') === -1) {
        return (location.href === 'about:blank' || host === '') ? 'blank' : 'wrong-origin';
      }
      return window.__INFLOW_BOOTED === true ? 'booted' : 'not-booted';
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

        // Cold-start ladder: give the first remote navigation time, then
        // recover a hung about:blank / unbooted document without waiting
        // for the user to force-quit.
        for delay in [6.0, 12.0, 18.0, 24.0] {
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
        webView?.isOpaque = false
        webView?.backgroundColor = shellColor
        webView?.scrollView.backgroundColor = shellColor
        webView?.superview?.backgroundColor = shellColor
    }

    private func inspectAndRecover(reason: String) {
        guard let webView else { return }
        paintShell(webView)

        let href = webView.url?.absoluteString ?? ""
        let elapsed = Date().timeIntervalSince(lastLoadAt)
        let blank = href.isEmpty || href.hasPrefix("about:")

        if webView.isLoading {
            if elapsed >= 20 {
                loadApp(reason: "\(reason) load-hung \(Int(elapsed))s url=\(href)")
            }
            return
        }

        if blank || !isAppOrigin(href) {
            if elapsed >= 6 || reason.hasPrefix("foreground") {
                loadApp(reason: "\(reason) blank-or-wrong-origin url=\(href)")
            }
            return
        }

        webView.evaluateJavaScript(probeJS) { [weak self] result, error in
            guard let self else { return }
            if let error {
                self.loadApp(reason: "\(reason) js-error \(error.localizedDescription)")
                return
            }
            let status = result as? String ?? ""
            if status == "booted" { return }
            if status == "wrong-origin" || status == "blank" {
                self.loadApp(reason: "\(reason) probe=\(status)")
                return
            }
            if Date().timeIntervalSince(self.lastLoadAt) >= 15 {
                self.loadApp(reason: "\(reason) not-booted")
            }
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
