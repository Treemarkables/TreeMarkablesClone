import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.nz.inflowapp",
  appName: "Inflow",
  webDir: "dist/public",
  server: {
    // Shared across iOS + Android — both shells load the live web app.
    url: "https://app.treemarkables.co.nz",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#1a1a1a",
    scrollEnabled: false,
  },
  android: {
    backgroundColor: "#1a1a1a",
    // The web app is served over HTTPS from the remote URL; never allow cleartext.
    allowMixedContent: false,
  },
};

export default config;
