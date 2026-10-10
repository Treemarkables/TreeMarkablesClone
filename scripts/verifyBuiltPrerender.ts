/**
 * Runs at the end of `vite build`. The prerender shell and the hashed files
 * it names are taken from this build's Vite manifest, then checked on disk.
 * Previous production hashes are copied in afterwards so a rolling deploy can
 * still serve the outgoing HTML.
 */
import fs from "fs";
import path from "path";
import {
  alignIndexHtmlWithManifest,
  assertPrerenderHtmlAssets,
  assetFileNames,
  type ManifestChunk,
} from "../server/staticAssetPolicy.ts";
import { retainPreviousBuildAssets } from "./retainPreviousBuildAssets.ts";

function isManifest(value: unknown): value is Record<string, ManifestChunk> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const DEFAULT_ORIGINS = [
  "https://www.treemarkables.co.nz",
  "https://app.inflowapp.co.nz",
];

function manifestPaths(outDir: string): string[] {
  return [path.join(outDir, ".vite", "manifest.json"), path.join(outDir, "manifest.json")];
}

export function readViteManifest(outDir: string): Record<string, ManifestChunk> {
  for (const candidate of manifestPaths(outDir)) {
    if (!fs.existsSync(candidate)) continue;
    const parsed: unknown = JSON.parse(fs.readFileSync(candidate, "utf8"));
    if (!isManifest(parsed)) {
      throw new Error(`Vite manifest at ${candidate} is not an object.`);
    }
    return parsed;
  }
  throw new Error(
    "Vite manifest was not written. The prerender cannot be checked against this build.",
  );
}

export function removeShippedManifest(outDir: string): void {
  for (const candidate of manifestPaths(outDir)) {
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
  const viteDir = path.join(outDir, ".vite");
  if (fs.existsSync(viteDir) && fs.readdirSync(viteDir).length === 0) {
    fs.rmdirSync(viteDir);
  }
}

export function alignBuiltIndexHtml(outDir: string): string {
  const indexPath = path.join(outDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`vite build did not write ${indexPath}`);
  }
  const manifest = readViteManifest(outDir);
  const aligned = alignIndexHtmlWithManifest(fs.readFileSync(indexPath, "utf8"), manifest);
  fs.writeFileSync(indexPath, aligned);
  assertPrerenderHtmlAssets(aligned, assetFileNames(outDir));
  removeShippedManifest(outDir);
  return aligned;
}

export async function verifyBuiltPrerenderAndRetain(
  outDir: string,
  options?: {
    retain?: boolean;
    origins?: string[];
    fetchImpl?: typeof fetch;
    log?: (message: string) => void;
  },
): Promise<void> {
  alignBuiltIndexHtml(outDir);
  if (options?.retain === false || process.env.ASSET_RETAIN_DISABLE === "1") return;

  const origins = options?.origins
    ?? (process.env.ASSET_RETAIN_ORIGINS
      ? process.env.ASSET_RETAIN_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean)
      : DEFAULT_ORIGINS);
  const log = options?.log ?? ((message: string) => console.log(`[prerender] ${message}`));
  try {
    const result = await retainPreviousBuildAssets({
      assetsDir: path.join(outDir, "assets"),
      origins,
      fetchImpl: options?.fetchImpl,
      log,
    });
    if (result.retained.length > 0) {
      log(`kept ${result.retained.length} hashed file(s) from the previous deploy`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`previous-asset retain failed (${message}). This build's own files were already checked.`);
  }

  const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assertPrerenderHtmlAssets(html, assetFileNames(outDir));
}
