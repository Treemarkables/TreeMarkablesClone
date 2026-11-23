import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { prerenderDeleteAccountPlugin } from "./scripts/prerenderDeleteAccountPlugin";

export default defineConfig({
  plugins: [react(), prerenderDeleteAccountPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
