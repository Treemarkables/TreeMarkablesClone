import Foundation

/// When the native shell may call `load` again.
///
/// A remote Capacitor document that is still loading must not be cancelled
/// on the short cold-open ladder. Build 1.0 (42) treated "still loading" as
/// stalled at 4 seconds, so the 4s, 10s, and 18s checks each aborted the
/// previous attempt and spent all 3 reloads on a slow connection. An opaque
/// web view with no committed page then stayed white, and `reloadCount`
/// never cleared so the next foreground did not try again.
///
/// `elapsed` is seconds since the last load attempt (the "lastAttempt" clock).
public enum WebViewBootPolicy {
    public static let maxReloads = 3
    /// Leave an in progress navigation alone until this long after the last attempt.
    /// Kept inside 15 to 20 seconds.
    public static let loadingStall: TimeInterval = 18
    /// Blank, idle, and not a recorded navigation failure.
    public static let idleBlank: TimeInterval = 2
    /// didFail, didFailProvisionalNavigation, or the content process terminated.
    public static let failureBackoff: TimeInterval = 1.5
    /// App origin document that has not reported a boot yet.
    public static let unbooted: TimeInterval = 18
}

public enum WebViewBootCountEvent {
    case attempt
    case healthyBoot
    case foreground
    case sceneActivate
}

/// `count` after a reload attempt, a healthy boot, or a return to the foreground.
public func nextReloadCount(_ count: Int, event: WebViewBootCountEvent) -> Int {
    switch event {
    case .attempt:
        return count + 1
    case .healthyBoot, .foreground, .sceneActivate:
        return 0
    }
}

/// Cancelled navigations (our own `stopLoading`, or a load we superseded) are not failures.
public func isIgnorableNavigationError(domain: String, code: Int) -> Bool {
    domain == NSURLErrorDomain && code == NSURLErrorCancelled
}

/// Pure reload gate. `surface` matches the native probe strings
/// (`blank`, `wrong-origin`, `booted`, `painting`, `empty`, `not-booted`).
public func shouldReload(
    surface: String,
    elapsed: TimeInterval,
    isLoading: Bool,
    count: Int,
    navigationFailed: Bool = false,
    foregroundRetry: Bool = false,
    sawHealthyBoot: Bool = false,
    maxReloads: Int = WebViewBootPolicy.maxReloads,
    loadingStall: TimeInterval = WebViewBootPolicy.loadingStall,
    idleBlank: TimeInterval = WebViewBootPolicy.idleBlank,
    failureBackoff: TimeInterval = WebViewBootPolicy.failureBackoff,
    unbooted: TimeInterval = WebViewBootPolicy.unbooted
) -> Bool {
    if count >= maxReloads { return false }

    switch surface {
    case "booted", "painting":
        return false
    case "empty":
        if sawHealthyBoot { return false }
        if isLoading { return elapsed >= loadingStall }
        return true
    default:
        break
    }

    // A navigation that is still in progress is not restarted until the stall
    // threshold. Failure and foreground retries apply only once loading has stopped.
    if isLoading {
        return elapsed >= loadingStall
    }

    if surface == "blank" || surface == "wrong-origin" {
        if foregroundRetry { return true }
        if navigationFailed { return elapsed >= failureBackoff }
        return elapsed >= idleBlank
    }

    if navigationFailed {
        return elapsed >= failureBackoff
    }

    return elapsed >= unbooted
}
