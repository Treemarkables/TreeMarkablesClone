/**
 * Marketing snapshot host and route gate.
 *
 * Run: npx tsx --test server/treemarkablesSnapshotRouting.test.ts
 *
 * Production mounts the SPA fallback with app.use("*"). That mount trims
 * req.path to "/", so a handler that brands with req.path injects the
 * homepage snapshot on /login, /dashboard and /dispatch and then refuses
 * to replace it. These tests hit that mount.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import path from "path";
import express from "express";
import {
  applyTreemarkablesDocumentHead,
  createTreemarkablesDocumentBrandMiddleware,
  hostFromHeaders,
  htmlForSpaRequest,
  requestDocumentPath,
} from "./treemarkablesDocumentBrand.ts";
import { HOME_PAGE, TREE_REMOVAL_PAGE } from "../shared/treemarkablesPageCopy.ts";

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Inflow</title>
    <style>
      #inflow-boot { background: #1a1a1a; color: #f5f5f0; }
      html.inflow-app #tm-prerender { display: none !important; }
    </style>
    <link rel="stylesheet" crossorigin href="/assets/index-TEST.css">
    <script type="module" crossorigin src="/assets/index-TEST.js"></script>
  </head>
  <body>
    <div id="inflow-boot" role="status">
      <p class="boot-title">Opening Inflow</p>
    </div>
    <div id="root"></div>
  </body>
</html>`;

function h1(html: string): string | null {
  const match = html.match(/<h1>([^<]*)<\/h1>/);
  return match ? match[1] : null;
}

describe("snapshot path is the browser URL, not the * mount", () => {
  it("reads originalUrl when req.path has been trimmed to /", () => {
    assert.equal(requestDocumentPath({ originalUrl: "/login?next=/", path: "/" }), "/login");
    assert.equal(requestDocumentPath({ originalUrl: "/tree-removal?utm=ad", path: "/" }), "/tree-removal");
    assert.equal(requestDocumentPath({ originalUrl: "/dashboard/", path: "/" }), "/dashboard");
    assert.equal(requestDocumentPath({ path: "/dispatch" }), "/dispatch");
    assert.equal(requestDocumentPath({ originalUrl: "//evil.example/tree-removal", path: "/" }), "/");
  });

  it("does not let a forwarded www host repaint an app host", () => {
    assert.equal(
      hostFromHeaders({ host: "app.inflowapp.co.nz", "x-forwarded-host": "www.treemarkables.co.nz" }),
      "app.inflowapp.co.nz",
    );
    assert.equal(
      hostFromHeaders({ host: "app.treemarkables.co.nz", "x-forwarded-host": "www.treemarkables.co.nz" }),
      "app.treemarkables.co.nz",
    );
    assert.equal(
      hostFromHeaders({
        host: "plankton-app.ondigitalocean.app",
        "x-forwarded-host": "www.treemarkables.co.nz, app.inflowapp.co.nz",
      }),
      "www.treemarkables.co.nz",
    );
    assert.equal(
      hostFromHeaders({ host: "www.treemarkables.co.nz", "x-forwarded-host": "app.inflowapp.co.nz" }),
      "www.treemarkables.co.nz",
    );
  });

  it("replaces a homepage snapshot when the real path is another marketing page", () => {
    const home = applyTreemarkablesDocumentHead(SHELL, "/");
    const page = applyTreemarkablesDocumentHead(home, "/tree-removal");
    assert.equal(h1(page), TREE_REMOVAL_PAGE.h1);
    assert.match(page, /id="tm-prerender"/);
    assert.equal(page.match(/id="tm-prerender"/g)?.length, 1);
    assert.doesNotMatch(page, /id="inflow-boot"/);
    const again = applyTreemarkablesDocumentHead(page, "/tree-removal");
    assert.equal(again, page);
  });

  it("drops a homepage snapshot on staff routes", () => {
    const home = applyTreemarkablesDocumentHead(SHELL, "/");
    for (const urlPath of ["/login", "/dashboard", "/dispatch"]) {
      const page = applyTreemarkablesDocumentHead(home, urlPath);
      assert.doesNotMatch(page, /id="tm-prerender"/, urlPath);
      assert.doesNotMatch(page, new RegExp(`<h1>${HOME_PAGE.h1}</h1>`), urlPath);
    }
  });
});

describe("SPA fallback through app.use('*')", () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(createTreemarkablesDocumentBrandMiddleware());
    app.use("*", (req, res) => {
      // Prove the mount really hides the browser path on req.path.
      res.setHeader("X-Test-Path", req.path);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(htmlForSpaRequest(SHELL, req));
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    port = typeof address === "object" && address ? address.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function hit(
    urlPath: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, method: "GET", path: urlPath, headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  it("keeps the marketing snapshot on www marketing routes", async () => {
    const home = await hit("/", { host: "www.treemarkables.co.nz" });
    assert.equal(home.status, 200);
    assert.equal(home.headers["x-test-path"], "/");
    assert.match(home.body, /id="tm-prerender"/);
    assert.equal(h1(home.body), HOME_PAGE.h1);
    assert.match(home.body, /027 216 6882/);
    assert.match(home.body, /26 Cochrane Street/);
    assert.doesNotMatch(home.body, /id="inflow-boot"/);
    assert.doesNotMatch(home.body, /class="inflow-app"/);
    const cssAt = home.body.indexOf('href="/assets/index-TEST.css"');
    const jsAt = home.body.indexOf('src="/assets/index-TEST.js"');
    assert.ok(cssAt !== -1 && cssAt < jsAt);

    const removal = await hit("/tree-removal?utm=ad", { host: "www.treemarkables.co.nz" });
    assert.equal(removal.headers["x-test-path"], "/");
    assert.match(removal.body, /id="tm-prerender"/);
    assert.equal(h1(removal.body), TREE_REMOVAL_PAGE.h1);
    assert.doesNotMatch(removal.body, /id="inflow-boot"/);
  });

  it("does not inject the snapshot on www staff routes", async () => {
    for (const urlPath of ["/login", "/dashboard", "/dispatch", "/signup"]) {
      const res = await hit(urlPath, { host: "www.treemarkables.co.nz" });
      assert.equal(res.status, 200, urlPath);
      assert.equal(res.headers["x-test-path"], "/", urlPath);
      assert.doesNotMatch(res.body, /id="tm-prerender"/, urlPath);
      assert.match(res.body, /id="inflow-boot"/, urlPath);
      assert.match(res.body, /Opening Inflow/, urlPath);
      assert.equal(h1(res.body), null, urlPath);
    }
  });

  it("serves the app shell on app hosts, including the iOS start URL", async () => {
    for (const host of ["app.inflowapp.co.nz", "app.treemarkables.co.nz"]) {
      for (const urlPath of ["/", "/login", "/dashboard", "/dispatch"]) {
        const res = await hit(urlPath, { host });
        assert.equal(res.status, 200, `${host} ${urlPath}`);
        assert.doesNotMatch(res.body, /id="tm-prerender"/, `${host} ${urlPath}`);
        assert.match(res.body, /id="inflow-boot"/, `${host} ${urlPath}`);
        assert.match(res.body, /class="inflow-app"/, `${host} ${urlPath}`);
        assert.match(res.body, /Opening Inflow/, `${host} ${urlPath}`);
        assert.doesNotMatch(res.body, /<h1>/, `${host} ${urlPath}`);
      }
    }
  });

  it("ignores a forwarded marketing host when Host is the app", async () => {
    const res = await hit("/", {
      host: "app.inflowapp.co.nz",
      "x-forwarded-host": "www.treemarkables.co.nz",
    });
    assert.doesNotMatch(res.body, /id="tm-prerender"/);
    assert.match(res.body, /id="inflow-boot"/);
    assert.match(res.body, /class="inflow-app"/);
    assert.doesNotMatch(res.body, /<h1>/);
  });

  it("still snapshots www when the platform host is forwarded", async () => {
    const res = await hit("/tree-removal", {
      host: "plankton-app.ondigitalocean.app",
      "x-forwarded-host": "www.treemarkables.co.nz",
    });
    assert.match(res.body, /id="tm-prerender"/);
    assert.equal(h1(res.body), TREE_REMOVAL_PAGE.h1);
    assert.doesNotMatch(res.body, /id="inflow-boot"/);
  });
});

describe("real client/index.html", () => {
  it("keeps the boot splash on app routes and the snapshot on the homepage", () => {
    const html = fs.readFileSync(path.resolve("client/index.html"), "utf8");
    const home = applyTreemarkablesDocumentHead(html, "/");
    assert.match(home, /id="tm-prerender"/);
    assert.equal(h1(home), HOME_PAGE.h1);
    assert.doesNotMatch(home, /id="inflow-boot"/);
    assert.match(home, /html\.inflow-app #tm-prerender \{ display: none !important; \}/);

    for (const urlPath of ["/login", "/dashboard", "/"]) {
      if (urlPath === "/") continue;
      const page = applyTreemarkablesDocumentHead(html, urlPath);
      assert.doesNotMatch(page, /id="tm-prerender"/, urlPath);
      assert.match(page, /id="inflow-boot"/, urlPath);
      assert.match(page, /Opening Inflow/, urlPath);
    }
  });
});
