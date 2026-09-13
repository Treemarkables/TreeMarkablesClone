import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  applyTreemarkablesDocumentHead,
  createTreemarkablesDocumentBrandMiddleware,
  DEFAULT_TREEMARKABLES_META,
  isInflowIconPath,
  isTreemarkablesDocumentHost,
  isWebManifestPath,
  metaForPath,
  TREEMARKABLES_CANONICAL_ORIGIN,
  TREEMARKABLES_WEB_MANIFEST,
} from "./treemarkablesDocumentBrand.ts";

const INFLOW_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Inflow</title>
    <meta name="description" content="Inflow — job management for field-services teams." />
    <meta name="apple-mobile-web-app-title" content="Inflow">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/png" href="/treemarkables-icon-black.png">
    <link rel="apple-touch-icon" href="/inflow-icon-180.png?v=8">
    <link rel="apple-touch-icon" sizes="180x180" href="/inflow-icon-180.png?v=8">
    <link rel="apple-touch-icon" sizes="192x192" href="/inflow-icon-192.png?v=8">
    <link rel="apple-touch-icon" sizes="512x512" href="/inflow-icon-512.png?v=8">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

type RunResult = {
  next: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  location?: string;
};

function run(
  method: string,
  urlPath: string,
  host: string,
  sendHtml?: string,
  sendFilePath?: string,
): Promise<RunResult> {
  const mw = createTreemarkablesDocumentBrandMiddleware();
  const pathname = urlPath.split("?")[0];

  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const req = {
      method,
      path: pathname,
      originalUrl: urlPath,
      hostname: host,
      headers: { host },
    };

    let settled = false;
    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const res = {
      statusCode: 200,
      headersSent: false,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        this.headersSent = true;
      },
      type() {
        return this;
      },
      redirect(code: number, location: string) {
        this.statusCode = code;
        finish({ next: false, status: code, headers, body: "", location });
      },
      send(body: string | object) {
        const text = typeof body === "string" ? body : JSON.stringify(body);
        finish({ next: false, status: this.statusCode, headers, body: text });
        return this;
      },
      sendFile(filePath: string, cb?: (err?: Error) => void) {
        try {
          const html = fs.readFileSync(filePath, "utf8");
          this.send(html);
          if (cb) cb();
        } catch (error) {
          if (cb) cb(error instanceof Error ? error : new Error(String(error)));
        }
        return this;
      },
      end(chunk?: string | Buffer) {
        const text = Buffer.isBuffer(chunk)
          ? chunk.toString("utf8")
          : typeof chunk === "string"
            ? chunk
            : "";
        finish({ next: false, status: this.statusCode, headers, body: text });
        return this;
      },
    };

    mw(req as never, res as never, () => {
      if (sendFilePath) {
        res.sendFile(sendFilePath);
        return;
      }
      if (sendHtml !== undefined) {
        if (sendHtml.startsWith("BUFFER:")) {
          res.end(Buffer.from(sendHtml.slice("BUFFER:".length), "utf8"));
        } else {
          res.end(sendHtml);
        }
        return;
      }
      finish({ next: true, status: 0, headers, body: "" });
    });
  });
}

describe("Treemarkables document branding (first-byte, host-aware)", () => {
  it("recognises only www + apex Treemarkables hosts", () => {
    assert.equal(isTreemarkablesDocumentHost("www.treemarkables.co.nz"), true);
    assert.equal(isTreemarkablesDocumentHost("treemarkables.co.nz"), true);
    assert.equal(isTreemarkablesDocumentHost("WWW.TREEMARKABLES.CO.NZ:443"), true);
    assert.equal(isTreemarkablesDocumentHost("app.treemarkables.co.nz"), false);
    assert.equal(isTreemarkablesDocumentHost("app.inflowapp.co.nz"), false);
    assert.equal(isTreemarkablesDocumentHost("www.inflowapp.co.nz"), false);
    assert.equal(isTreemarkablesDocumentHost("localhost"), false);
  });

  it("identifies Inflow icon and manifest paths", () => {
    assert.equal(isInflowIconPath("/inflow-icon-180.png"), true);
    assert.equal(isInflowIconPath("/inflow-icon-192.png?v=8"), true);
    assert.equal(isInflowIconPath("/inflow-icon-512.png"), true);
    assert.equal(isInflowIconPath("/treemarkables-logo-green-192.png"), false);
    assert.equal(isWebManifestPath("/manifest.json"), true);
    assert.equal(isWebManifestPath("/manifest.webmanifest"), true);
    assert.equal(isWebManifestPath("/api/health"), false);
  });

  it("reuses existing marketing SEO copy for known paths", () => {
    assert.equal(metaForPath("/").title, DEFAULT_TREEMARKABLES_META.title);
    assert.match(metaForPath("/tree-removal").title, /Tree Removal Gisborne/);
    assert.equal(metaForPath("/dispatch").title, DEFAULT_TREEMARKABLES_META.title);
  });

  it("rewrites Inflow index.html to Treemarkables first-byte tags", () => {
    const branded = applyTreemarkablesDocumentHead(INFLOW_HTML, "/");
    assert.match(branded, /<title>Treemarkables — Gisborne's Number 1 Arborist &amp; Tree Care<\/title>/);
    assert.match(branded, /meta name="description" content="Gisborne's trusted arborists/);
    assert.match(branded, /apple-mobile-web-app-title" content="Treemarkables"/);
    assert.match(branded, /rel="canonical" href="https:\/\/www\.treemarkables\.co\.nz\/"/);
    assert.match(branded, /property="og:title"/);
    assert.match(branded, /property="og:image" content="https:\/\/www\.treemarkables\.co\.nz\/team-photo\.jpg"/);
    assert.match(branded, /href="\/treemarkables-icon-black\.png"/);
    assert.match(branded, /href="\/treemarkables-logo-green-180\.png"/);
    assert.match(branded, /href="\/treemarkables-logo-green-192\.png"/);
    assert.match(branded, /href="\/treemarkables-logo-green-512\.png"/);
    assert.doesNotMatch(branded, /inflow-icon/);
    assert.doesNotMatch(branded, /<title>Inflow<\/title>/);
    assert.doesNotMatch(branded, /job management for field-services teams/);
    assert.match(branded, /<div id="root"><\/div>/);
  });

  it("is idempotent and path-aware", () => {
    const once = applyTreemarkablesDocumentHead(INFLOW_HTML, "/tree-removal");
    const twice = applyTreemarkablesDocumentHead(once, "/tree-removal");
    assert.equal(once, twice);
    assert.match(once, /<title>Tree Removal Gisborne/);
    assert.match(once, /canonical" href="https:\/\/www\.treemarkables\.co\.nz\/tree-removal"/);
    assert.equal((once.match(/treemarkables-document-brand/g) || []).length, 2);
  });

  it("is a no-op on Inflow and legacy app hosts", async () => {
    for (const host of ["app.inflowapp.co.nz", "www.inflowapp.co.nz", "app.treemarkables.co.nz", "localhost"]) {
      const result = await run("GET", "/", host);
      assert.equal(result.next, true, host);
      assert.equal(result.body, "");
    }
  });

  it("does not 301 app paths on www (must not reintroduce PR #516)", async () => {
    for (const urlPath of ["/", "/login", "/dispatch", "/tree-removal"]) {
      const result = await run("GET", urlPath, "www.treemarkables.co.nz");
      assert.equal(result.next, true, urlPath);
      assert.equal(result.location, undefined, urlPath);
      assert.notEqual(result.status, 301, urlPath);
    }
  });

  it("serves a Treemarkables manifest on Treemarkables hosts only", async () => {
    const tm = await run("GET", "/manifest.json", "www.treemarkables.co.nz");
    assert.equal(tm.next, false);
    assert.equal(tm.status, 200);
    const parsed = JSON.parse(tm.body) as typeof TREEMARKABLES_WEB_MANIFEST;
    assert.equal(parsed.name, "Treemarkables");
    assert.equal(parsed.short_name, "Treemarkables");
    assert.equal(parsed.start_url, "/");
    assert.ok(parsed.icons.every((icon) => icon.src.includes("treemarkables")));
    assert.equal(tm.headers["content-type"], "application/manifest+json; charset=utf-8");

    const inflow = await run("GET", "/manifest.json", "app.inflowapp.co.nz");
    assert.equal(inflow.next, true);
  });

  it("404s Inflow brand icons on Treemarkables hosts", async () => {
    const tm = await run("GET", "/inflow-icon-192.png?v=8", "www.treemarkables.co.nz");
    assert.equal(tm.next, false);
    assert.equal(tm.status, 404);
    assert.doesNotMatch(tm.body.toLowerCase(), /inflow/);

    const inflow = await run("GET", "/inflow-icon-192.png", "www.inflowapp.co.nz");
    assert.equal(inflow.next, true);
  });

  it("rewrites HTML sent via res.end on a Treemarkables host", async () => {
    const result = await run("GET", "/", "www.treemarkables.co.nz", INFLOW_HTML);
    assert.equal(result.next, false);
    assert.match(result.body, /<title>Treemarkables/);
    assert.doesNotMatch(result.body, /<title>Inflow<\/title>/);
    assert.match(result.body, /canonical/);
  });

  it("honours X-Forwarded-Host from the DigitalOcean / Cloudflare edge", async () => {
    const mw = createTreemarkablesDocumentBrandMiddleware();
    const result = await new Promise<RunResult>((resolve) => {
      const headers: Record<string, string> = {};
      const req = {
        method: "GET",
        path: "/manifest.json",
        originalUrl: "/manifest.json",
        hostname: "localhost",
        headers: { host: "localhost:5000", "x-forwarded-host": "www.treemarkables.co.nz" },
      };
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        setHeader(name: string, value: string) {
          headers[name.toLowerCase()] = value;
        },
        type() {
          return this;
        },
        send(body: string) {
          resolve({ next: false, status: this.statusCode, headers, body });
          return this;
        },
        sendFile() {
          return this;
        },
        end() {
          resolve({ next: false, status: this.statusCode, headers, body: "" });
          return this;
        },
      };
      mw(req as never, res as never, () => {
        resolve({ next: true, status: 0, headers, body: "" });
      });
    });
    assert.equal(result.next, false);
    assert.equal(JSON.parse(result.body).name, "Treemarkables");
  });

  it("rewrites the real client/index.html without touching the React mount", () => {
    const html = fs.readFileSync(path.resolve("client/index.html"), "utf8");
    const branded = applyTreemarkablesDocumentHead(html, "/");
    assert.match(branded, /<title>Treemarkables/);
    assert.match(branded, /<div id="root"><\/div>/);
    assert.match(branded, /src="\/src\/main\.tsx"/);
    assert.doesNotMatch(branded, /inflow-icon/);
    assert.doesNotMatch(branded, /<title>Inflow<\/title>/);
  });

  it("rewrites index.html sendFile on a Treemarkables host", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-brand-"));
    const indexPath = path.join(dir, "index.html");
    fs.writeFileSync(indexPath, INFLOW_HTML);
    try {
      const result = await run("GET", "/", "treemarkables.co.nz", undefined, indexPath);
      assert.match(result.body, new RegExp(TREEMARKABLES_CANONICAL_ORIGIN.replace(/[.]/g, "\\.")));
      assert.match(result.body, /Treemarkables/);
      assert.doesNotMatch(result.body, /inflow-icon/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
