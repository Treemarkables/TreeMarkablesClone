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
  },
};

export default config;
