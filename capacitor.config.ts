import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.nz.inflowapp",
  appName: "Inflow",
  webDir: "dist/public",
  server: {
    url: "https://app.treemarkables.co.nz",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#1a1a1a",
    scrollEnabled: false,
  },
};

export default config;
