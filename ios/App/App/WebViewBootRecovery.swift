import UIKit
import WebKit

/// Recovers a dead or never-painted Capacitor WKWebView.
///
/// The TestFlight shell loads the live SPA from `server.url`
/// (`https://app.inflowapp.co.nz`). After LaunchScreen dismisses, the web
/// view sits on `about:blank` until that remote document commits.
///
/// Build 1.0 (42) made `paintShell` set `isOpaque = true` so Capacitor's
/// `willLoadWebview` snapshot was not `false` (that snapshot is the stuck
/// black screen: a non opaque web view composites black, and
/// `didFailProvisionalNavigation` never restores opacity). An opaque web
/// view with no page loaded draws white. The recovery ladder then reloaded
/// a still loading document at 4s, 10s, and 18s, cancelling each attempt
/// and spending all 3 reloads. `reloadCount` never reset, so foregrounding
/// the app did not try again.
///
/// This type keeps the web view opaque (never `isOpaque = false`) and covers
/// it with a native `#1a1a1a` placeholder until the first app page commits.
/// The placeholder is removed on that commit and on a booted or painting
/// probe, so it cannot sit on top of a loaded page. Reload policy lives in
/// `shouldReload` (`WebViewBootDecision.swift`): leave an in progress
/// navigation alone until `WebViewBootPolicy.loadingStall`, and reload
/// sooner only after a real navigation failure.
///
/// We do not replace Capacitor's navigation delegate outright. A forwarder
/// observes fail / finish / process death and passes every other message
/// through. Loads use the configured remote URL, never `reload()` of
/// `about:blank`.
///
/// Probe strings match `classifyBootSurface` in
/// `client/src/lib/nativeBootRecovery.ts`.
final class WebViewBootRecovery {
    static let shared = WebViewBootRecovery()

    private weak var webView: WKWebView?
    private var navigationObserver: BootNavigationObserver?
    private var placeholder: UIView?
    private var lastLoadAt = Date()
    private var lastLoadAttemptAt = Date.distantPast
    private var reloadCount = 0
    private var sawHealthyBoot = false
    private var navigationFailed = false
    private var didAttach = false
    private var failureGeneration = 0
    private var stallGeneration = 0
    private var returnInspectScheduled = false
    private let shellColor = UIColor(red: 26 / 255, green: 26 / 255, blue: 26 / 255, alpha: 1)
    private let shellTextColor = UIColor(red: 245 / 255, green: 245 / 255, blue: 240 / 255, alpha: 1)

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
        guard let webView else { return }
        // Opaque before Capacitor's willLoadWebview snapshots isOpaque.
        // That snapshot is restored on didFinish. False is the stuck black screen.
        paintShell(webView)
        showPlaceholder(on: webView)
        installNavigationObserver(on: webView)

        guard !didAttach else { return }
        didAttach = true
        lastLoadAt = Date()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(sceneDidActivate),
            name: UIScene.didActivateNotification,
            object: nil
        )

        for delay in [2.0, 4.0, 10.0, 18.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.inspectAndRecover(reason: "cold-start+\(Int(delay))s")
            }
        }
    }

    @objc private func appDidBecomeActive() {
        noteAppReturned(reason: "foreground", event: .foreground)
    }

    @objc private func sceneDidActivate() {
        noteAppReturned(reason: "scene activation", event: .sceneActivate)
    }

    /// Foreground and scene activation can both fire for one return.
    /// Count resets either way. One inspect is enough.
    private func noteAppReturned(reason: String, event: WebViewBootCountEvent) {
        resetReloadCount(reason: reason, event: event, alwaysLog: true)
        guard !returnInspectScheduled else { return }
        returnInspectScheduled = true
        // Brief delay so a healthy in progress boot is not interrupted the
        // moment LaunchScreen hands off. A blank page that has stopped
        // loading is retried. A page that is still loading is left alone
        // until the stall threshold.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
            guard let self else { return }
            self.returnInspectScheduled = false
            self.inspectAndRecover(reason: "foreground")
        }
    }

    fileprivate func handleNavigationFailure(_ error: Error, kind: String) {
        let nsError = error as NSError
        if isIgnorableNavigationError(domain: nsError.domain, code: nsError.code) {
            return
        }
        navigationFailed = true
        scheduleFailureInspect(reason: "\(kind) \(nsError.domain) \(nsError.code)")
    }

    fileprivate func handleContentProcessTerminated() {
        // Capacitor reloads the current URL itself. Restart the attempt clock
        // so that reload is not cancelled as if it were the stalled first load.
        navigationFailed = true
        lastLoadAt = Date()
        scheduleFailureInspect(reason: "web content process terminated")
        scheduleStallCheck()
    }

    /// Called after Capacitor's own `didFinish`, which restores the opacity snapshot.
    fileprivate func handleNavigationFinished() {
        guard let webView else { return }
        let href = webView.url?.absoluteString ?? ""
        guard isAppOrigin(href) else { return }
        // Drop the cover now that the app document has committed. Leave
        // lastLoadAt on the load attempt so an unbooted page still has to
        // wait out the stall window before another reload.
        navigationFailed = false
        failureGeneration += 1
        paintShell(webView)
        hidePlaceholder(reason: "page loaded")
    }

    private func scheduleFailureInspect(reason: String) {
        failureGeneration += 1
        let generation = failureGeneration
        print("WebViewBootRecovery navigation failed: \(reason)")
        DispatchQueue.main.asyncAfter(deadline: .now() + WebViewBootPolicy.failureBackoff) { [weak self] in
            guard let self, generation == self.failureGeneration else { return }
            self.inspectAndRecover(reason: "navigation failure")
        }
    }

    private func scheduleStallCheck() {
        stallGeneration += 1
        let generation = stallGeneration
        DispatchQueue.main.asyncAfter(deadline: .now() + WebViewBootPolicy.loadingStall) { [weak self] in
            guard let self, generation == self.stallGeneration else { return }
            self.inspectAndRecover(reason: "stall")
        }
    }

    private func paintShell(_ webView: WKWebView?) {
        guard let webView else { return }
        // Never set isOpaque = false. Capacitor snapshots the value in
        // willLoadWebview and restores it on didFinish. A false snapshot
        // is the stuck black screen. Re-assert true so a provisional
        // navigation failure (Capacitor does not restore opacity there)
        // cannot leave the web view non opaque after the placeholder is gone.
        webView.isOpaque = true
        webView.backgroundColor = shellColor
        webView.scrollView.backgroundColor = shellColor
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = shellColor
        }
        webView.superview?.backgroundColor = shellColor
        if let cover = placeholder {
            cover.frame = webView.bounds
            cover.backgroundColor = shellColor
            webView.bringSubviewToFront(cover)
        }
    }

    private func showPlaceholder(on webView: WKWebView) {
        if let cover = placeholder {
            if cover.superview !== webView {
                cover.removeFromSuperview()
                webView.addSubview(cover)
            }
            cover.frame = webView.bounds
            webView.bringSubviewToFront(cover)
            return
        }
        let cover = UIView(frame: webView.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = shellColor
        cover.isUserInteractionEnabled = false

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "Opening Inflow"
        title.textColor = shellTextColor
        title.font = .systemFont(ofSize: 20, weight: .semibold)
        title.textAlignment = .center
        cover.addSubview(title)
        NSLayoutConstraint.activate([
            title.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: cover.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: cover.trailingAnchor, constant: -24),
        ])

        webView.addSubview(cover)
        webView.bringSubviewToFront(cover)
        placeholder = cover
        print("WebViewBootRecovery placeholder shown")
        DispatchQueue.main.async { [weak self, weak webView] in
            guard let self, let webView, let cover = self.placeholder, cover.superview === webView else { return }
            cover.frame = webView.bounds
            webView.bringSubviewToFront(cover)
        }
    }

    private func hidePlaceholder(reason: String) {
        guard let cover = placeholder else { return }
        cover.removeFromSuperview()
        placeholder = nil
        print("WebViewBootRecovery placeholder removed (\(reason))")
    }

    private func installNavigationObserver(on webView: WKWebView) {
        if let current = webView.navigationDelegate as? BootNavigationObserver {
            current.recovery = self
            navigationObserver = current
            return
        }
        let observer = BootNavigationObserver()
        observer.forward = webView.navigationDelegate
        observer.recovery = self
        navigationObserver = observer
        webView.navigationDelegate = observer
    }

    private func inspectAndRecover(reason: String) {
        guard let webView else { return }
        paintShell(webView)
        installNavigationObserver(on: webView)

        let href = webView.url?.absoluteString ?? ""
        let elapsed = Date().timeIntervalSince(lastLoadAt)
        let loading = webView.isLoading
        let blank = href.isEmpty || href.hasPrefix("about:")
        let foreground = reason.hasPrefix("foreground")

        if blank || !isAppOrigin(href) {
            let surface = blank ? "blank" : "wrong-origin"
            if decideReload(
                surface: surface,
                elapsed: elapsed,
                isLoading: loading,
                foregroundRetry: foreground
            ) {
                loadApp(reason: "\(reason) \(surface) url=\(href)")
            }
            return
        }

        webView.evaluateJavaScript(probeJS) { [weak self] result, error in
            guard let self, let webView = self.webView else { return }
            let elapsedNow = Date().timeIntervalSince(self.lastLoadAt)
            if let error {
                if self.decideReload(
                    surface: "blank",
                    elapsed: elapsedNow,
                    isLoading: webView.isLoading,
                    navigationFailed: true,
                    foregroundRetry: false
                ) {
                    self.loadApp(reason: "\(reason) js-error \(error.localizedDescription)")
                }
                return
            }
            let status = result as? String ?? "not-booted"
            if status == "booted" || status == "painting" {
                if status == "booted" {
                    self.sawHealthyBoot = true
                }
                self.navigationFailed = false
                self.failureGeneration += 1
                self.paintShell(webView)
                self.hidePlaceholder(reason: status)
                self.resetReloadCount(reason: "page loaded", event: .healthyBoot, alwaysLog: false)
                return
            }
            if self.decideReload(
                surface: status,
                elapsed: elapsedNow,
                isLoading: webView.isLoading,
                foregroundRetry: false
            ) {
                self.loadApp(reason: "\(reason) probe=\(status)")
            }
        }
    }

    private func decideReload(
        surface: String,
        elapsed: TimeInterval,
        isLoading: Bool,
        navigationFailed: Bool? = nil,
        foregroundRetry: Bool
    ) -> Bool {
        shouldReload(
            surface: surface,
            elapsed: elapsed,
            isLoading: isLoading,
            count: reloadCount,
            navigationFailed: navigationFailed ?? self.navigationFailed,
            foregroundRetry: foregroundRetry,
            sawHealthyBoot: sawHealthyBoot
        )
    }

    private func isAppOrigin(_ href: String) -> Bool {
        guard let url = URL(string: href), let host = url.host else { return false }
        return host.contains("app.inflowapp.co.nz") || host.contains("app.treemarkables.co.nz")
    }

    private func resetReloadCount(reason: String, event: WebViewBootCountEvent, alwaysLog: Bool) {
        let previous = reloadCount
        reloadCount = nextReloadCount(previous, event: event)
        guard alwaysLog || previous != reloadCount else { return }
        print("🔁 WebViewBootRecovery reloadCount reset (\(reason)) was #\(previous)")
    }

    private func loadApp(reason: String) {
        guard reloadCount < WebViewBootPolicy.maxReloads else {
            print("⚠️ WebViewBootRecovery: gave up after \(WebViewBootPolicy.maxReloads) reloads (\(reason))")
            return
        }
        guard let webView else { return }
        // Two probes can decide to reload before either load starts.
        if Date().timeIntervalSince(lastLoadAttemptAt) < 0.35 {
            return
        }
        let url = remoteAppURL()
        reloadCount = nextReloadCount(reloadCount, event: .attempt)
        lastLoadAt = Date()
        lastLoadAttemptAt = lastLoadAt
        navigationFailed = false
        failureGeneration += 1
        print("🔁 WebViewBootRecovery reload #\(reloadCount): \(reason) → \(url.absoluteString)")
        showPlaceholder(on: webView)
        paintShell(webView)
        webView.stopLoading()
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45)
        webView.load(request)
        scheduleStallCheck()
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
        // Cold start recovery used to load the origin with no path, wiping a
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

/// Forwards WKNavigationDelegate to Capacitor and reports boot failures.
/// The web view's delegate is weak, so `WebViewBootRecovery` retains this.
final class BootNavigationObserver: NSObject, WKNavigationDelegate {
    weak var forward: WKNavigationDelegate?
    weak var recovery: WebViewBootRecovery?

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        recovery?.handleNavigationFailure(error, kind: "didFail")
        forward?.webView?(webView, didFail: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        recovery?.handleNavigationFailure(error, kind: "didFailProvisionalNavigation")
        forward?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        forward?.webView?(webView, didFinish: navigation)
        recovery?.handleNavigationFinished()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        recovery?.handleContentProcessTerminated()
        forward?.webViewWebContentProcessDidTerminate?(webView)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        guard let target = forward as AnyObject?, target !== self else { return false }
        return target.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        guard let target = forward as AnyObject?, target !== self, target.responds(to: aSelector) else {
            return super.forwardingTarget(for: aSelector)
        }
        return target
    }
}
