/**
 * Copy the live site's hashed /assets into this build's output.
 *
 * DigitalOcean rolls two instances. The new image can then still serve the
 * previous build's index-HASH.js while the old instance drains. Files already
 * produced by this Vite build are left untouched. A download that is HTML
 * (the old "Asset not found" page) is discarded.
 */
import fs from "fs";
import path from "path";
import { extractAssetRefs, safeAssetBasename } from "../server/staticAssetPolicy.ts";

const MAX_FILES = 250;
const MAX_BYTES = 20_000_000;
// HTML names files as /assets/index-HASH.js. The bundle then imports
// "./Home-HASH.js" relative to that folder. Both have to be kept or the
// previous page loads the entry and then dies on the first route chunk.
const BODY_REF = /(?:\/assets\/|\.\/)([A-Za-z0-9._-]+\.(?:js|css|woff2?))/g;

export interface RetainResult {
  retained: string[];
  skipped: string[];
}

function looksLikeHtmlPayload(body: Uint8Array, contentType: string | null): boolean {
  const type = (contentType || "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  const head = Buffer.from(body.subarray(0, 80)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head");
}

export function retainedAssetAllowed(contentType: string | null, body: Uint8Array): boolean {
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return false;
  return !looksLikeHtmlPayload(body, contentType);
}

function scrapeAssetRefs(text: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(BODY_REF)) {
    const name = match[1];
    if (!name || seen.has(name) || !safeAssetBasename(name)) continue;
    seen.add(name);
    refs.push(`/assets/${name}`);
  }
  return refs;
}

async function fetchUrl(url: string, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "user-agent": "treemarkables-asset-retain",
      accept: "*/*",
    },
  });
}

export async function retainPreviousBuildAssets(options: {
  assetsDir: string;
  origins: string[];
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}): Promise<RetainResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => {});
  const retained: string[] = [];
  const skipped: string[] = [];
  fs.mkdirSync(options.assetsDir, { recursive: true });

  const queue: string[] = [];
  const queued = new Set<string>();
  const enqueue = (ref: string) => {
    const name = safeAssetBasename(ref);
    if (!name || queued.has(name)) return;
    queued.add(name);
    queue.push(name);
  };

  for (const origin of options.origins) {
    const base = origin.replace(/\/+$/, "");
    let response: Response;
    try {
      response = await fetchUrl(`${base}/`, fetchImpl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`previous-asset retain skipped ${base} (${message})`);
      skipped.push(base);
      continue;
    }
    if (!response.ok) {
      skipped.push(base);
      continue;
    }
    const html = await response.text();
    if (!html.includes("/assets/") && !html.includes('id="root"')) {
      skipped.push(base);
      continue;
    }
    for (const ref of extractAssetRefs(html)) enqueue(ref);
    for (const ref of scrapeAssetRefs(html)) enqueue(ref);
  }

  let downloaded = 0;
  let cursor = 0;
  const downloadOne = async (name: string): Promise<void> => {
    const dest = path.join(options.assetsDir, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;

    let saved = false;
    for (const origin of options.origins) {
      const base = origin.replace(/\/+$/, "");
      let response: Response;
      try {
        response = await fetchUrl(`${base}/assets/${name}`, fetchImpl);
      } catch {
        continue;
      }
      if (!response.ok) continue;
      const body = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type");
      if (!retainedAssetAllowed(contentType, body)) {
        log(`previous-asset retain rejected ${name} (${contentType || "unknown type"})`);
        continue;
      }
      const partial = `${dest}.partial`;
      try {
        fs.writeFileSync(partial, body);
        fs.renameSync(partial, dest);
      } catch (error) {
        fs.rmSync(partial, { force: true });
        throw error;
      }
      retained.push(name);
      saved = true;
      downloaded += 1;
      if (name.endsWith(".js") || name.endsWith(".css")) {
        for (const ref of scrapeAssetRefs(Buffer.from(body).toString("utf8"))) enqueue(ref);
      }
      break;
    }
    if (!saved) skipped.push(name);
  };

  await new Promise<void>((resolve, reject) => {
    let active = 0;
    const pump = () => {
      while (active < 8 && downloaded < MAX_FILES && cursor < queue.length) {
        const name = queue[cursor];
        cursor += 1;
        if (!name) continue;
        active += 1;
        downloadOne(name).then(() => {
          active -= 1;
          pump();
        }, reject);
      }
      if (active === 0 && (cursor >= queue.length || downloaded >= MAX_FILES)) resolve();
    };
    pump();
  });

  return { retained, skipped };
}
