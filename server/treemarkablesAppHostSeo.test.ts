import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import express from "express";
import { SESSION_COOKIE_NAME } from "./security/sessionCookie.ts";
import {
  applyAppHostNoindex,
  appHostCanonicalUrl,
  appHostMarketingRedirectLocation,
  appHostRobotsTxt,
  createTreemarkablesAppHostSeoMiddleware,
  safePathAndQuery,
} from "./treemarkablesAppHostSeo.ts";
import { createTreemarkablesApexRedirectMiddleware } from "./treemarkablesApexRedirect.ts";
import { marketingRobotsContent } from "../shared/treemarkablesMarketingPaths.ts";

const WWW = "https://www.treemarkables.co.nz";
const APP = "app.treemarkables.co.nz";

const INFLOW_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Inflow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const MARKETING_CASES: Array<{ path: string; location: string }> = [
  { path: "/tree-removal", location: `${WWW}/tree-removal` },
  { path: "/tree-pruning", location: `${WWW}/tree-pruning` },
  { path: "/stump-grinding", location: `${WWW}/stump-grinding` },
  { path: "/hedge-trimming", location: `${WWW}/hedge-trimming` },
  { path: "/summer-offer", location: `${WWW}/summer-offer` },
  { path: "/blog", location: `${WWW}/blog` },
  {
    path: "/blog/why-regular-tree-pruning-protects-your-home-gisborne?utm=ad",
    location: `${WWW}/blog/why-regular-tree-pruning-protects-your-home-gisborne?utm=ad`,
  },
  {
    path: "/stump-grinding?gclid=1&utm_source=google",
    location: `${WWW}/stump-grinding?gclid=1&utm_source=google`,
  },
  { path: "/contact/", location: `${WWW}/contact/` },
  { path: "/privacy-policy", location: `${WWW}/privacy-policy` },
  { path: "/home", location: `${WWW}/home` },
  { path: "/sitemap.xml", location: `${WWW}/sitemap.xml` },
];

const STAYS: string[] = [
  "/",
  "/?job=4208",
  "/login",
  "/dashboard",
  "/api/auth/me",
  "/dispatch",
  "/dispatch-board",
  "/proposal/42",
  "/invoice/9",
  "/invoices",
  "/portal",
  "/customer-portal",
  "/quote/1",
  "/watch/1",
  "/review/token",
  "/objects/photos/a.jpg",
  "/assets/index-abc.js",
  "/health",
  "/signup",
  "/src/main.tsx",
];

describe("app host marketing redirect", () => {
  for (const spec of MARKETING_CASES) {
    it(`301s ${spec.path} to www`, () => {
      assert.equal(
        appHostMarketingRedirectLocation({ host: APP, originalUrl: spec.path }),
        spec.location,
      );
    });
  }

  it("accepts a port and odd host header casing", () => {
    assert.equal(
      appHostMarketingRedirectLocation({
        host: "APP.TREEMARKABLES.CO.NZ:443",
        originalUrl: "/hedge-trimming",
      }),
      `${WWW}/hedge-trimming`,
    );
  });

  it("does not redirect the app entry or staff routes", () => {
    for (const originalUrl of STAYS) {
      assert.equal(
        appHostMarketingRedirectLocation({ host: APP, originalUrl }),
        null,
        originalUrl,
      );
    }
  });

  it("does not redirect www, the apex, Inflow, or localhost", () => {
    for (const host of ["www.treemarkables.co.nz", "treemarkables.co.nz", "app.inflowapp.co.nz", "localhost"]) {
      assert.equal(
        appHostMarketingRedirectLocation({ host, originalUrl: "/tree-removal" }),
        null,
        host,
      );
    }
  });

  it("does not redirect POST, and keeps a logged-in session on the app host", () => {
    assert.equal(
      appHostMarketingRedirectLocation({ host: APP, originalUrl: "/contact", method: "POST" }),
      null,
    );
    assert.equal(
      appHostMarketingRedirectLocation({
        host: APP,
        originalUrl: "/tree-removal?ref=push",
        cookie: `other=1; ${SESSION_COOKIE_NAME}=s%3Aabc.sig`,
      }),
      null,
    );
    assert.equal(
      appHostMarketingRedirectLocation({
        host: APP,
        originalUrl: "/tree-removal",
        cookie: "unrelated=1",
      }),
      `${WWW}/tree-removal`,
    );
  });

  it("refuses a protocol-relative redirect target", () => {
    assert.equal(safePathAndQuery("//evil.example/tree-removal"), null);
    assert.equal(
      appHostMarketingRedirectLocation({ host: APP, originalUrl: "//evil.example/tree-removal" }),
      null,
    );
  });

  it("leaves http www to the DigitalOcean edge", () => {
    assert.equal(
      appHostMarketingRedirectLocation({ host: "www.treemarkables.co.nz", originalUrl: "/" }),
      null,
    );
  });
});

describe("app host noindex and robots", () => {
  it("marks the app shell noindex and canonicalises it to www", () => {
    const once = applyAppHostNoindex(INFLOW_HTML, appHostCanonicalUrl("/"));
    assert.match(once, /<meta name="robots" content="noindex, follow" \/>/);
    assert.match(once, /<link rel="canonical" href="https:\/\/www\.treemarkables\.co\.nz\/" \/>/);
    assert.match(once, /src="\/src\/main\.tsx"/);
    assert.equal(applyAppHostNoindex(once, appHostCanonicalUrl("/")), once);
    assert.equal(marketingRobotsContent(APP), "noindex, follow");
    assert.equal(marketingRobotsContent("www.treemarkables.co.nz"), "index, follow");
  });

  it("does not turn JSON into HTML", () => {
    const json = '{"content":"<html><body>mail</body></html>"}';
    assert.equal(applyAppHostNoindex(json, appHostCanonicalUrl("/")), json);
  });

  it("strips the Sitemap directive from app-host robots.txt", () => {
    const www = fs.readFileSync(path.resolve("robots.txt"), "utf8");
    assert.match(www, /^Sitemap:/m);
    const appRobots = appHostRobotsTxt(www);
    assert.doesNotMatch(appRobots, /^\s*sitemap\s*:/im);
    assert.match(appRobots, /Disallow: \/login/);
    assert.match(appRobots, /Disallow: \/dispatch/);
    assert.match(appRobots, /Allow: \/tree-removal/);
    assert.match(appRobots, /Allow: \/sitemap\.xml/);
    assert.match(appRobots, /does not advertise that site's sitemap/);
  });
});

describe("app host HTTP routing", () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(createTreemarkablesApexRedirectMiddleware());
    app.use(createTreemarkablesAppHostSeoMiddleware());
    app.use((req, res) => {
      if (req.path === "/robots.txt") {
        res.type("text/plain").send(fs.readFileSync(path.resolve("robots.txt"), "utf8"));
        return;
      }
      if (req.path.startsWith("/api") || req.path === "/health") {
        res.status(200).json({ ok: true, path: req.path });
        return;
      }
      res.status(200).type("html").send(INFLOW_HTML);
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
    method: string,
    urlPath: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path: urlPath,
          headers,
        },
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

  it("301s a marketing path on the app host and keeps the query", async () => {
    const res = await hit("GET", "/stump-grinding?utm=ad", { host: APP });
    assert.equal(res.status, 301);
    assert.equal(res.headers.location, `${WWW}/stump-grinding?utm=ad`);
  });

  it("301s from x-forwarded-host when the platform host is the DO app", async () => {
    const res = await hit("GET", "/contact", {
      host: "plankton-app.ondigitalocean.app",
      "x-forwarded-host": APP,
    });
    assert.equal(res.status, 301);
    assert.equal(res.headers.location, `${WWW}/contact`);
  });

  it("serves / as the app shell with noindex and a www canonical", async () => {
    const res = await hit("GET", "/", { host: APP });
    assert.equal(res.status, 200);
    assert.equal(res.headers.location, undefined);
    assert.match(String(res.headers["x-robots-tag"]), /noindex/);
    assert.match(res.body, /noindex, follow/);
    assert.match(res.body, /rel="canonical" href="https:\/\/www\.treemarkables\.co\.nz\/"/);
    assert.match(res.body, /id="root"/);
  });

  it("does not redirect a logged-in marketing load", async () => {
    const res = await hit("GET", "/blog/hazardous-tree-removal-gisborne-5-signs-dangerous-tree", {
      host: APP,
      cookie: `${SESSION_COOKIE_NAME}=abc`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.location, undefined);
    assert.match(String(res.headers["x-robots-tag"]), /noindex/);
    assert.match(res.body, /canonical" href="https:\/\/www\.treemarkables\.co\.nz\/blog\/hazardous-tree-removal-gisborne-5-signs-dangerous-tree"/);
  });

  it("leaves login, api, dispatch, proposal, invoice, portal, and assets on the app host", async () => {
    for (const urlPath of ["/login", "/dashboard", "/api/auth/me", "/dispatch", "/proposal/1", "/invoice/2", "/portal", "/assets/app.js"]) {
      const res = await hit("GET", urlPath, { host: APP });
      assert.equal(res.status, 200, urlPath);
      assert.equal(res.headers.location, undefined, urlPath);
      if (urlPath.startsWith("/api")) {
        assert.match(res.body, /"ok":true/);
        assert.doesNotMatch(res.body, /noindex/);
      }
    }
  });

  it("serves app-host robots.txt without a sitemap line", async () => {
    const res = await hit("GET", "/robots.txt", { host: APP });
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "text/plain; charset=utf-8");
    assert.doesNotMatch(res.body, /^\s*sitemap\s*:/im);
    assert.match(res.body, /Disallow: \/api\//);
  });

  it("still advertises the sitemap on www robots.txt", async () => {
    const res = await hit("GET", "/robots.txt", { host: "www.treemarkables.co.nz" });
    assert.equal(res.status, 200);
    assert.match(res.body, /^Sitemap:\s+https:\/\/www\.treemarkables\.co\.nz\/sitemap\.xml/m);
  });

  it("still 301s the apex host to www, including /", async () => {
    const res = await hit("GET", "/tree-pruning?x=1", { host: "treemarkables.co.nz" });
    assert.equal(res.status, 301);
    assert.equal(res.headers.location, `${WWW}/tree-pruning?x=1`);
    const root = await hit("GET", "/", { host: "treemarkables.co.nz" });
    assert.equal(root.status, 301);
    assert.equal(root.headers.location, `${WWW}/`);
  });

  it("does not redirect www or the Inflow app", async () => {
    for (const host of ["www.treemarkables.co.nz", "app.inflowapp.co.nz"]) {
      const res = await hit("GET", "/hedge-trimming", { host });
      assert.equal(res.status, 200, host);
      assert.equal(res.headers.location, undefined, host);
      assert.equal(res.headers["x-robots-tag"], undefined, host);
    }
  });

  it("rewrites a sendFile index.html on the app root", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "app-host-seo-"));
    const indexPath = path.join(dir, "index.html");
    fs.writeFileSync(indexPath, INFLOW_HTML);
    const app = express();
    app.use(createTreemarkablesAppHostSeoMiddleware({ robotsTxt: "User-agent: *\nSitemap: https://www.example/sitemap.xml\n" }));
    app.get("/", (_req, res) => {
      res.sendFile(indexPath);
    });
    const fileServer = http.createServer(app);
    await new Promise<void>((resolve) => fileServer.listen(0, "127.0.0.1", () => resolve()));
    const address = fileServer.address();
    const filePort = typeof address === "object" && address ? address.port : 0;
    try {
      const res = await new Promise<{ status: number; body: string; robots: string | undefined }>((resolve, reject) => {
        const req = http.request(
          { host: "127.0.0.1", port: filePort, path: "/", method: "GET", headers: { host: APP } },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk) => chunks.push(chunk as Buffer));
            response.on("end", () => {
              resolve({
                status: response.statusCode || 0,
                body: Buffer.concat(chunks).toString("utf8"),
                robots: response.headers["x-robots-tag"] as string | undefined,
              });
            });
          },
        );
        req.on("error", reject);
        req.end();
      });
      assert.equal(res.status, 200);
      assert.match(res.robots || "", /noindex/);
      assert.match(res.body, /noindex, follow/);
      assert.match(res.body, /src="\/src\/main\.tsx"/);
    } finally {
      await new Promise<void>((resolve, reject) => fileServer.close((err) => (err ? reject(err) : resolve())));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
