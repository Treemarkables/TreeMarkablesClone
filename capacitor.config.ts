import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.treemarkables.app",
  appName: "Treemarkables",
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
