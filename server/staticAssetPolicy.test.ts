import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { applyTreemarkablesDocumentHead } from "./treemarkablesDocumentBrand.ts";
import {
  alignIndexHtmlWithManifest,
  applyHtmlCacheHeaders,
  assertPrerenderHtmlAssets,
  contentTypeForAsset,
  extractAssetRefs,
  HASHED_ASSET_CACHE_CONTROL,
  hasStylesheetLink,
  HTML_CACHE_CONTROL,
  isMissingStaticAsset,
  missingAssetBody,
  writeMissingAsset,
} from "./staticAssetPolicy.ts";
import { retainedAssetAllowed, retainPreviousBuildAssets } from "../scripts/retainPreviousBuildAssets.ts";
import { verifyBuiltPrerenderAndRetain } from "../scripts/verifyBuiltPrerender.ts";

const SHELL = `<!DOCTYPE html>
<html>
  <head>
    <title>Inflow</title>
    <script type="module" crossorigin src="/assets/index-NEW111.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe("static asset rollout policy", () => {
  it("sends no-cache on HTML and a long immutable cache on hashed assets", () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };
    applyHtmlCacheHeaders(res);
    assert.match(headers["Cache-Control"], /no-cache/);
    assert.equal(headers["Cache-Control"], HTML_CACHE_CONTROL);
    assert.equal(headers["CDN-Cache-Control"], "no-store");
    assert.equal(HASHED_ASSET_CACHE_CONTROL, "public, max-age=31536000, immutable");
  });

  it("answers a missing hashed bundle with javascript, not an HTML document", () => {
    const headers: Record<string, string> = {};
    let status = 0;
    let body = "";
    writeMissingAsset(
      {
        status(code: number) {
          status = code;
          return this;
        },
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
        end(chunk: string) {
          body = chunk;
        },
      },
      "/assets/index-BUol8i-a.js",
    );
    assert.equal(status, 404);
    assert.equal(headers["Content-Type"], "application/javascript; charset=utf-8");
    assert.equal(headers["Cache-Control"], "no-store");
    assert.equal(contentTypeForAsset("/assets/index-DizO9nBc.css"), "text/css; charset=utf-8");
    assert.doesNotMatch(headers["Content-Type"], /text\/html/);
    assert.equal(body, missingAssetBody("/assets/index-BUol8i-a.js"));
    assert.doesNotMatch(body, /<!doctype|<html/i);
    assert.equal(isMissingStaticAsset("/assets/index-BUol8i-a.js"), true);
    assert.equal(isMissingStaticAsset("/tree-removal"), false);
  });

  it("inserts the manifest CSS link and refuses a shell from another build", () => {
    const manifest = {
      "index.html": {
        file: "assets/index-NEW111.js",
        isEntry: true,
        css: ["assets/index-NEW111.css"],
      },
    };
    const aligned = alignIndexHtmlWithManifest(SHELL, manifest);
    assert.equal(hasStylesheetLink(aligned), true);
    assert.match(aligned, /href="\/assets\/index-NEW111\.css"/);
    assert.match(aligned, /src="\/assets\/index-NEW111\.js"/);

    const names = new Set(["index-NEW111.js", "index-NEW111.css"]);
    assert.doesNotThrow(() => assertPrerenderHtmlAssets(aligned, names));
    assert.throws(
      () => assertPrerenderHtmlAssets(aligned, new Set(["index-NEW111.js"])),
      /index-NEW111\.css/,
    );

    const otherBuild = SHELL.replace("index-NEW111.js", "index-OLD999.js");
    assert.throws(() => alignIndexHtmlWithManifest(otherBuild, manifest), /different Vite build/);
  });

  it("keeps the stylesheet link when the marketing snapshot is injected", () => {
    const withCss = SHELL.replace(
      "</head>",
      '    <link rel="stylesheet" crossorigin href="/assets/index-NEW111.css">\n  </head>',
    );
    const branded = applyTreemarkablesDocumentHead(withCss, "/");
    assert.equal(hasStylesheetLink(branded), true);
    assert.match(branded, /id="tm-prerender"/);
    assert.match(branded, /body:has\(#tm-prerender\)\{background:#f6f5f0/);
    assert.deepEqual(extractAssetRefs(branded), [
      "/assets/index-NEW111.js",
      "/assets/index-NEW111.css",
    ]);
  });

  it("fails the build check unless every referenced file exists, then drops the manifest", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-build-"));
    const assets = path.join(dir, "assets");
    fs.mkdirSync(path.join(dir, ".vite"), { recursive: true });
    fs.mkdirSync(assets);
    fs.writeFileSync(path.join(assets, "index-NEW111.js"), "console.log('new')\n");
    fs.writeFileSync(path.join(assets, "index-NEW111.css"), "body{color:#111}\n");
    fs.writeFileSync(path.join(dir, "index.html"), SHELL);
    fs.writeFileSync(
      path.join(dir, ".vite", "manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index-NEW111.js",
          isEntry: true,
          css: ["assets/index-NEW111.css"],
        },
      }),
    );
    try {
      await verifyBuiltPrerenderAndRetain(dir, { retain: false });
      const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
      assert.equal(hasStylesheetLink(html), true);
      assert.equal(fs.existsSync(path.join(dir, ".vite", "manifest.json")), false);
      fs.rmSync(path.join(assets, "index-NEW111.css"));
      fs.mkdirSync(path.join(dir, ".vite"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, ".vite", "manifest.json"),
        JSON.stringify({
          "index.html": {
            file: "assets/index-NEW111.js",
            isEntry: true,
            css: ["assets/index-NEW111.css"],
          },
        }),
      );
      await assert.rejects(
        () => verifyBuiltPrerenderAndRetain(dir, { retain: false }),
        /index-NEW111\.css/,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("copies the previous deploy's hashed files and ignores an HTML 404 body", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-retain-"));
    const assets = path.join(dir, "assets");
    fs.mkdirSync(assets);
    fs.writeFileSync(path.join(assets, "index-NEW111.js"), "console.log('new')\n");

    const pages: Record<string, { status: number; type: string; body: string }> = {
      "https://www.example.test/": {
        status: 200,
        type: "text/html; charset=utf-8",
        body: `<!DOCTYPE html><div id="root"></div><script src="/assets/index-OLD222.js"></script><link rel="stylesheet" href="/assets/index-OLD222.css">`,
      },
      "https://www.example.test/assets/index-OLD222.js": {
        status: 200,
        type: "application/javascript",
        body: "console.log('old');\nimport './chunk-REL444.js';\nimport '/assets/chunk-OLD333.js';\n",
      },
      "https://www.example.test/assets/index-OLD222.css": {
        status: 200,
        type: "text/css",
        body: "body{background:#fff}\n",
      },
      "https://www.example.test/assets/chunk-REL444.js": {
        status: 200,
        type: "application/javascript",
        body: "console.log('rel')\n",
      },
      "https://www.example.test/assets/chunk-OLD333.js": {
        status: 200,
        type: "text/html",
        body: "<!DOCTYPE html><html><title>Asset not found</title></html>",
      },
      "https://www.example.test/assets/index-NEW111.js": {
        status: 200,
        type: "application/javascript",
        body: "console.log('should-not-overwrite')\n",
      },
    };

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const found = pages[url];
      if (!found) return new Response("nope", { status: 404, headers: { "content-type": "text/html" } });
      return new Response(found.body, {
        status: found.status,
        headers: { "content-type": found.type },
      });
    };

    try {
      assert.equal(
        retainedAssetAllowed("text/html", Buffer.from("<!DOCTYPE html><html></html>")),
        false,
      );
      const result = await retainPreviousBuildAssets({
        assetsDir: assets,
        origins: ["https://www.example.test"],
        fetchImpl,
        log() {},
      });
      assert.deepEqual(result.retained.sort(), ["chunk-REL444.js", "index-OLD222.css", "index-OLD222.js"]);
      assert.match(fs.readFileSync(path.join(assets, "index-NEW111.js"), "utf8"), /console\.log\('new'\)/);
      assert.equal(fs.existsSync(path.join(assets, "chunk-OLD333.js")), false);
      assert.match(fs.readFileSync(path.join(assets, "index-OLD222.js"), "utf8"), /old/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reloads when the entry bundle 404s even though the marketing snapshot has text", () => {
    const html = fs.readFileSync(path.resolve("client/index.html"), "utf8");
    assert.match(html, /assetMismatchReloads/);
    assert.match(html, /\/assets\//);
    assert.match(html, /__ENTRY_STARTED/);
    const main = fs.readFileSync(path.resolve("client/src/main.tsx"), "utf8");
    assert.match(main, /window\.__ENTRY_STARTED = true/);
  });
});
