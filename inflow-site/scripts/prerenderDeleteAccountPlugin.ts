import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { applyDeleteAccountDocument } from "../src/lib/deleteAccountStaticHtml";

/**
 * Writes the deletion page next to the SPA shell during `vite build`.
 * Cloudflare Pages serves that file for /delete-account before the SPA fallback,
 * so the steps are in the HTML without JavaScript.
 */
export function prerenderDeleteAccountPlugin(): Plugin {
  let outDir = "";
  return {
    name: "prerender-delete-account",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const indexPath = path.join(outDir, "index.html");
      const indexHtml = readFileSync(indexPath, "utf8");
      const page = applyDeleteAccountDocument(indexHtml);
      const nested = path.join(outDir, "delete-account");
      mkdirSync(nested, { recursive: true });
      writeFileSync(path.join(nested, "index.html"), page);
      writeFileSync(path.join(outDir, "delete-account.html"), page);
    },
  };
}
