/**
 * Vite plugin: the marketing prerender is served from dist/public/index.html,
 * so that file must name the JS and CSS this same build just emitted.
 */
import path from "path";
import type { Plugin } from "vite";
import { verifyBuiltPrerenderAndRetain } from "./verifyBuiltPrerender.ts";

export function prerenderAssetPlugin(): Plugin {
  let outDir = path.resolve(process.cwd(), "dist/public");
  return {
    name: "prerender-same-build-assets",
    apply: "build",
    config() {
      return { build: { manifest: true } };
    },
    configResolved(resolved) {
      outDir = resolved.build.outDir;
    },
    async closeBundle() {
      await verifyBuiltPrerenderAndRetain(outDir);
    },
  };
}
