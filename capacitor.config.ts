import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.nz.inflowapp",
  appName: "Inflow",
  webDir: "dist/public",
  server: {
    // Live remote SPA — this is NOT an offline bundled app. Cold start paints
    // about:blank until this URL loads. WebViewBootRecovery.swift re-loads
    // this same URL if the first navigation hangs or the content process dies.
    url: "https://app.inflowapp.co.nz",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    // Shell color behind the remote document. The WKWebView must stay opaque:
    // WebViewBootRecovery.paintShell used to set isOpaque = false in
    // capacitorDidLoad, which runs before Capacitor snapshots isOpaque.
    // That false snapshot is what cold starts restored, and a non-opaque
    // webview composites as a stuck black screen. Do not "fix" a white
    // about:blank flash by setting isOpaque = false.
    backgroundColor: "#1a1a1a",
    scrollEnabled: false,
    // Push taps are handled natively by NotificationHandler (AppDelegate+Firebase.swift),
    // not by a Capacitor notification plugin. Left at its default (true), Capacitor's
    // CAPNotificationRouter installs itself as the UNUserNotificationCenter delegate when
    // the bridge loads and, with no plugin registered, swallows every tap — the app then
    // opens on the bare dispatch board. The delegate "reclaim" timers in AppDelegate.swift
    // only race that steal; this stops it happening at all. Needs `npx cap copy ios` +
    // an Xcode rebuild to take effect (ships in the copied capacitor.config.json).
    handleApplicationNotifications: false,
  },
};

export default config;
