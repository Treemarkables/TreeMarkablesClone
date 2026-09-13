import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.nz.inflowapp",
  appName: "Inflow",
  webDir: "dist/public",
  server: {
    // The native shells load the live app from its own domain.
    url: "https://app.inflowapp.co.nz",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
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
