// swift-tools-version: 5.9
import PackageDescription

// Pure boot-reload policy, shared with the iOS app target (the Xcode project
// compiles this same file). `swift test` here does not need the iOS SDK.
let package = Package(
    name: "BootRecoveryDecision",
    products: [
        .library(name: "WebViewBootDecision", targets: ["WebViewBootDecision"]),
    ],
    targets: [
        .target(
            name: "WebViewBootDecision",
            path: "Sources/WebViewBootDecision"
        ),
        .testTarget(
            name: "WebViewBootDecisionTests",
            dependencies: ["WebViewBootDecision"],
            path: "Tests/WebViewBootDecisionTests"
        ),
    ]
)
