import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { fileURLToPath } from "url";
import {
  createTreemarkablesMarketingMiddleware,
  isInflowAppPath,
  isTreemarkablesMarketingHost,
  resolveInflowAppOrigin,
  resolveMarketingFile,
  TREEMARKABLES_CANONICAL_ORIGIN,
} from "./treemarkablesMarketing";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "treemarkables-site");

function run(
  method: string,
  urlPath: string,
  host: string,
  origin?: string,
): Promise<{ next: boolean; status: number; headers: Record<string, string>; body: string }> {
  const mw = createTreemarkablesMarketingMiddleware({
    siteDir,
    inflowOrigin: "https://app.inflowapp.co.nz",
  });

  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const req = {
      method,
      path: urlPath.split("?")[0],
      originalUrl: urlPath,
      hostname: host,
      headers: { host, ...(origin ? { origin } : {}) },
    };
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      set(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      type() {
        return this;
      },
      redirect(code: number, location: string) {
        this.statusCode = code;
        headers.location = location;
        resolve({ next: false, status: code, headers, body: "" });
      },
      send(body: string | Buffer) {
        resolve({
          next: false,
          status: this.statusCode,
          headers,
          body: typeof body === "string" ? body : body.toString("utf8"),
        });
      },
      end() {
        resolve({ next: false, status: this.statusCode, headers, body: "" });
      },
    };
    mw(req as never, res as never, () => {
      resolve({ next: true, status: 0, headers, body: "" });
    });
  });
}

describe("treemarkables marketing host router", () => {
  it("ignores Inflow product hosts", async () => {
    for (const host of ["app.inflowapp.co.nz", "www.inflowapp.co.nz", "localhost"]) {
      const result = await run("GET", "/", host);
      assert.equal(result.next, true, host);
    }
  });

  it("recognises Treemarkables marketing hosts", () => {
    assert.equal(isTreemarkablesMarketingHost("www.treemarkables.co.nz"), true);
    assert.equal(isTreemarkablesMarketingHost("treemarkables.co.nz:443"), true);
    assert.equal(isTreemarkablesMarketingHost("app.inflowapp.co.nz"), false);
  });

  it("serves Treemarkables HTML on www home", async () => {
    const result = await run("GET", "/", "www.treemarkables.co.nz");
    assert.equal(result.next, false);
    assert.equal(result.status, 200);
    assert.match(result.headers["content-type"], /text\/html/);
    assert.match(result.body, /<title>Treemarkables \| Arborist &amp; Tree Care Gisborne<\/title>/);
    assert.match(result.body, /<h1>Arborist &amp; tree care in Gisborne<\/h1>/);
    assert.match(
      result.body,
      /Gisborne arborists for tree removal, pruning, stump grinding and hedge trimming/,
    );
    assert.match(result.body, /treemarkables-icon-black\.png/);
    assert.doesNotMatch(result.body, /Inflow/);
    assert.doesNotMatch(result.body, /manifest\.json/);
  });

  it("serves required service pages with exact SEO copy", async () => {
    const cases = [
      [
        "/tree-removal",
        "Tree Removal Gisborne | Treemarkables Arborists",
        "Tree removal in Gisborne",
        "Safe, professional tree removal in Gisborne and surrounds",
      ],
      [
        "/tree-pruning",
        "Tree Pruning Gisborne | Treemarkables Tree Care",
        "Tree pruning in Gisborne",
        "Expert tree pruning in Gisborne for healthier canopies",
      ],
      [
        "/gisborne-arborist",
        "Gisborne Arborist | Treemarkables Tree Care",
        "Gisborne arborist you can call",
        "Looking for a Gisborne arborist?",
      ],
      [
        "/stump-grinding",
        "Stump Grinding Gisborne | Treemarkables",
        "Stump grinding in Gisborne",
        "Stump grinding in Gisborne after tree removal",
      ],
      [
        "/hedge-trimming",
        "Hedge Trimming Gisborne | Treemarkables",
        "Hedge trimming in Gisborne",
        "Professional hedge trimming in Gisborne",
      ],
    ] as const;

    for (const [pathName, title, h1, meta] of cases) {
      const result = await run("GET", pathName, "www.treemarkables.co.nz");
      assert.equal(result.status, 200, pathName);
      assert.match(result.body, new RegExp(`<title>${title.replace(/[|]/g, "\\|")}</title>`), pathName);
      assert.match(result.body, new RegExp(`<h1>${h1}</h1>`), pathName);
      assert.match(result.body, new RegExp(meta), pathName);
      assert.match(result.body, /213 Stanley Road, Awapuni, Gisborne 4010/, pathName);
      assert.match(result.body, /027 216 6882/, pathName);
      assert.doesNotMatch(result.body, /Inflow/, pathName);
    }
  });

  it("redirects old app paths to the Inflow app origin", async () => {
    for (const appPath of ["/login", "/dispatch", "/diary", "/proposal/abc", "/invoice/1"]) {
      const result = await run("GET", appPath, "www.treemarkables.co.nz");
      assert.equal(result.status, 301, appPath);
      assert.equal(result.headers.location, `https://app.inflowapp.co.nz${appPath}`, appPath);
    }
  });

  it("canonicalises the apex host to www", async () => {
    const result = await run("GET", "/tree-removal", "treemarkables.co.nz");
    assert.equal(result.status, 301);
    assert.equal(result.headers.location, `${TREEMARKABLES_CANONICAL_ORIGIN}/tree-removal`);
  });

  it("never 500s sitemap or robots", async () => {
    const sitemap = await run("GET", "/sitemap.xml", "www.treemarkables.co.nz");
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers["content-type"], /xml/);
    assert.match(sitemap.body, /gisborne-arborist/);
    assert.match(sitemap.body, /www\.treemarkables\.co\.nz/);

    const robots = await run("GET", "/robots.txt", "www.treemarkables.co.nz");
    assert.equal(robots.status, 200);
    assert.match(robots.body, /Sitemap: https:\/\/www\.treemarkables\.co\.nz\/sitemap\.xml/);
  });

  it("404s the Inflow PWA manifest on the marketing host", async () => {
    const result = await run("GET", "/manifest.json", "www.treemarkables.co.nz");
    assert.equal(result.status, 404);
  });

  it("passes API and health through", async () => {
    assert.equal((await run("GET", "/health", "www.treemarkables.co.nz")).next, true);
    assert.equal((await run("POST", "/api/contact", "www.treemarkables.co.nz")).next, true);
  });

  it("classifies staff routes as Inflow app paths", () => {
    assert.equal(isInflowAppPath("/login"), true);
    assert.equal(isInflowAppPath("/dispatch"), true);
    assert.equal(isInflowAppPath("/tree-removal"), false);
    assert.equal(isInflowAppPath("/"), false);
  });

  it("does not redirect app paths back onto a treemarkables host", () => {
    assert.equal(resolveInflowAppOrigin("https://app.treemarkables.co.nz"), "https://app.inflowapp.co.nz");
    assert.equal(resolveInflowAppOrigin("https://app.inflowapp.co.nz"), "https://app.inflowapp.co.nz");
  });

  it("resolves directory indexes for marketing pages", () => {
    const resolved = resolveMarketingFile(siteDir, "/contact");
    assert.notEqual(resolved, "missing");
    if (resolved !== "missing") {
      assert.match(resolved.filePath, /contact\/index\.html$/);
    }
  });
});
