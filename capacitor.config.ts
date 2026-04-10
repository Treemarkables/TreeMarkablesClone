import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.treemarkables.app",
  appName: "Treemarkables",
  webDir: "dist/public",
  server: {
    // Points the native WebView at the live Replit server so all /api calls reach the backend.
    // Change to the deployed production URL (e.g. https://treemarkables.replit.app) before an
    // App Store submission.
    url: "https://b1b82713-81e2-4cd2-b004-e7f1a6680937-00-c7s3o0favocw.spock.replit.dev",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#1a1a1a",
    scheme: "treemarkables",
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
