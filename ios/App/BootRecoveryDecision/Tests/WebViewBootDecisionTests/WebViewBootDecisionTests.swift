import XCTest
@testable import WebViewBootDecision

final class WebViewBootDecisionTests: XCTestCase {
    func testStallWindowStaysBetweenFifteenAndTwentySeconds() {
        XCTAssertGreaterThanOrEqual(WebViewBootPolicy.loadingStall, 15)
        XCTAssertLessThanOrEqual(WebViewBootPolicy.loadingStall, 20)
        XCTAssertLessThan(WebViewBootPolicy.failureBackoff, 3)
        XCTAssertGreaterThan(WebViewBootPolicy.failureBackoff, 0)
        XCTAssertLessThan(WebViewBootPolicy.failureBackoff, WebViewBootPolicy.loadingStall)
    }

    func testDoesNotCancelALoadThatIsStillInProgress() {
        let stall = WebViewBootPolicy.loadingStall
        for elapsed in [2.0, 4.0, 10.0, stall - 0.1] {
            XCTAssertFalse(
                shouldReload(surface: "blank", elapsed: elapsed, isLoading: true, count: 0),
                "elapsed \(elapsed)"
            )
            XCTAssertFalse(
                shouldReload(surface: "wrong-origin", elapsed: elapsed, isLoading: true, count: 0),
                "elapsed \(elapsed)"
            )
            XCTAssertFalse(
                shouldReload(
                    surface: "blank",
                    elapsed: elapsed,
                    isLoading: true,
                    count: 0,
                    navigationFailed: true,
                    foregroundRetry: true
                ),
                "in progress load ignores failure and foreground at \(elapsed)"
            )
        }
        XCTAssertTrue(
            shouldReload(surface: "blank", elapsed: stall, isLoading: true, count: 0)
        )
    }

    func testReloadsImmediatelyAfterARealFailureOnceTheBackoffElapses() {
        let backoff = WebViewBootPolicy.failureBackoff
        XCTAssertFalse(
            shouldReload(
                surface: "blank",
                elapsed: backoff - 0.1,
                isLoading: false,
                count: 0,
                navigationFailed: true
            )
        )
        XCTAssertTrue(
            shouldReload(
                surface: "blank",
                elapsed: backoff,
                isLoading: false,
                count: 0,
                navigationFailed: true
            )
        )
        XCTAssertTrue(
            shouldReload(
                surface: "not-booted",
                elapsed: backoff,
                isLoading: false,
                count: 0,
                navigationFailed: true
            )
        )
        XCTAssertFalse(
            shouldReload(
                surface: "not-booted",
                elapsed: backoff,
                isLoading: true,
                count: 0,
                navigationFailed: true
            )
        )
    }

    func testIdleBlankUsesTheShortRetryAndForegroundRetriesAtOnce() {
        XCTAssertFalse(shouldReload(surface: "blank", elapsed: 1.9, isLoading: false, count: 0))
        XCTAssertTrue(
            shouldReload(surface: "blank", elapsed: WebViewBootPolicy.idleBlank, isLoading: false, count: 0)
        )
        XCTAssertTrue(
            shouldReload(
                surface: "blank",
                elapsed: 0,
                isLoading: false,
                count: 0,
                foregroundRetry: true
            )
        )
        XCTAssertTrue(
            shouldReload(
                surface: "wrong-origin",
                elapsed: 0.2,
                isLoading: false,
                count: 0,
                foregroundRetry: true
            )
        )
        XCTAssertFalse(
            shouldReload(
                surface: "not-booted",
                elapsed: 3,
                isLoading: false,
                count: 0,
                foregroundRetry: true
            )
        )
    }

    func testHealthySurfacesAreNeverReloaded() {
        XCTAssertFalse(
            shouldReload(
                surface: "booted",
                elapsed: 60,
                isLoading: false,
                count: 0,
                navigationFailed: true,
                foregroundRetry: true
            )
        )
        XCTAssertFalse(
            shouldReload(surface: "painting", elapsed: 60, isLoading: true, count: 0, foregroundRetry: true)
        )
    }

    func testEmptyShellReloadsOnlyBeforeTheFirstHealthyBoot() {
        XCTAssertTrue(
            shouldReload(surface: "empty", elapsed: 1, isLoading: false, count: 0, sawHealthyBoot: false)
        )
        XCTAssertFalse(
            shouldReload(surface: "empty", elapsed: 30, isLoading: false, count: 0, sawHealthyBoot: true)
        )
        XCTAssertFalse(
            shouldReload(surface: "empty", elapsed: 4, isLoading: true, count: 0, sawHealthyBoot: false)
        )
        XCTAssertTrue(
            shouldReload(
                surface: "empty",
                elapsed: WebViewBootPolicy.loadingStall,
                isLoading: true,
                count: 0,
                sawHealthyBoot: false
            )
        )
    }

    func testUnbootedDocumentWaitsForTheBootTimeout() {
        XCTAssertFalse(shouldReload(surface: "not-booted", elapsed: 10, isLoading: false, count: 0))
        XCTAssertTrue(
            shouldReload(
                surface: "not-booted",
                elapsed: WebViewBootPolicy.unbooted,
                isLoading: false,
                count: 0
            )
        )
    }

    func testExhaustedCountDoesNotReloadUntilForegroundResetsIt() {
        var count = 0
        count = nextReloadCount(count, event: .attempt)
        count = nextReloadCount(count, event: .attempt)
        count = nextReloadCount(count, event: .attempt)
        XCTAssertEqual(count, WebViewBootPolicy.maxReloads)
        XCTAssertFalse(
            shouldReload(
                surface: "blank",
                elapsed: 30,
                isLoading: false,
                count: count,
                navigationFailed: true,
                foregroundRetry: true
            )
        )

        count = nextReloadCount(count, event: .foreground)
        XCTAssertEqual(count, 0)
        XCTAssertTrue(
            shouldReload(
                surface: "blank",
                elapsed: 0.2,
                isLoading: false,
                count: count,
                foregroundRetry: true
            )
        )

        count = nextReloadCount(2, event: .healthyBoot)
        XCTAssertEqual(count, 0)
        count = nextReloadCount(3, event: .sceneActivate)
        XCTAssertEqual(count, 0)
        XCTAssertEqual(nextReloadCount(0, event: .attempt), 1)
    }

    func testCancelledNavigationIsNotAFailure() {
        XCTAssertTrue(isIgnorableNavigationError(domain: NSURLErrorDomain, code: NSURLErrorCancelled))
        XCTAssertEqual(NSURLErrorCancelled, -999)
        XCTAssertFalse(isIgnorableNavigationError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet))
        XCTAssertFalse(isIgnorableNavigationError(domain: "WebKitErrorDomain", code: NSURLErrorCancelled))
    }
}
