import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  apexRedirectLocation,
  createTreemarkablesApexRedirectMiddleware,
} from "./treemarkablesApexRedirect.ts";
import { applyTreemarkablesDocumentHead } from "./treemarkablesDocumentBrand.ts";

describe("treemarkables apex redirect", () => {
  it("sends the bare domain to https www and keeps the path", () => {
    assert.equal(
      apexRedirectLocation("treemarkables.co.nz", "/tree-removal"),
      "https://www.treemarkables.co.nz/tree-removal",
    );
    assert.equal(
      apexRedirectLocation("treemarkables.co.nz", "/blog/why-regular-tree-pruning-protects-your-home-gisborne?utm=ad"),
      "https://www.treemarkables.co.nz/blog/why-regular-tree-pruning-protects-your-home-gisborne?utm=ad",
    );
    assert.equal(apexRedirectLocation("treemarkables.co.nz", "/"), "https://www.treemarkables.co.nz/");
  });

  it("does not redirect www, the app host, or Inflow", () => {
    for (const host of ["www.treemarkables.co.nz", "app.treemarkables.co.nz", "app.inflowapp.co.nz", "localhost"]) {
      assert.equal(apexRedirectLocation(host, "/tree-removal"), null, host);
    }
  });

  it("301s from the apex host header and from x-forwarded-host", () => {
    const mw = createTreemarkablesApexRedirectMiddleware();
    const cases = [
      { headers: { host: "treemarkables.co.nz" }, hostname: "treemarkables.co.nz" },
      {
        headers: { host: "plankton-app.ondigitalocean.app", "x-forwarded-host": "treemarkables.co.nz" },
        hostname: "plankton-app.ondigitalocean.app",
      },
    ];
    for (const spec of cases) {
      let location = "";
      let status = 0;
      let continued = false;
      mw(
        { path: "/contact", originalUrl: "/contact", hostname: spec.hostname, headers: spec.headers } as never,
        {
          redirect(code: number, url: string) {
            status = code;
            location = url;
          },
        } as never,
        () => {
          continued = true;
        },
      );
      assert.equal(continued, false);
      assert.equal(status, 301);
      assert.equal(location, "https://www.treemarkables.co.nz/contact");
    }
  });

  it("leaves /health and www requests alone", () => {
    const mw = createTreemarkablesApexRedirectMiddleware();
    for (const spec of [
      { path: "/health", host: "treemarkables.co.nz" },
      { path: "/", host: "www.treemarkables.co.nz" },
      { path: "/dispatch", host: "app.treemarkables.co.nz" },
    ]) {
      let continued = false;
      mw(
        { path: spec.path, originalUrl: spec.path, hostname: spec.host, headers: { host: spec.host } } as never,
        { redirect() { throw new Error("should not redirect"); } } as never,
        () => {
          continued = true;
        },
      );
      assert.equal(continued, true, `${spec.host} ${spec.path}`);
    }
  });
});

describe("public marketing first byte", () => {
  const html = fs.readFileSync(path.resolve("client/index.html"), "utf8");
  const routes = [
    "/",
    "/tree-removal",
    "/tree-pruning",
    "/stump-grinding",
    "/hedge-trimming",
    "/summer-offer",
    "/blog",
    "/blog/hazardous-tree-removal-gisborne-5-signs-dangerous-tree",
    "/blog/why-regular-tree-pruning-protects-your-home-gisborne",
    "/contact",
    "/privacy-policy",
  ];

  for (const route of routes) {
    it(`includes copy and schema for ${route}`, () => {
      const branded = applyTreemarkablesDocumentHead(html, route);
      assert.match(branded, /<h1>[^<]+<\/h1>/);
      assert.match(branded, /027 216 6882/);
      assert.match(branded, /213 Stanley Road, Awapuni, Gisborne 4010/);
      assert.match(branded, /Tairāwhiti/);
      assert.match(branded, /"@type":"HomeAndConstructionBusiness"/);
      assert.match(branded, /\+64 27 216 6882/);
      assert.match(branded, /href="\/tree-removal"/);
      assert.match(branded, /Get a free quote/);
      assert.doesNotMatch(branded, /aggregateRating/);
      assert.doesNotMatch(branded, /<p class="boot-title">Opening Inflow<\/p>/);
      assert.match(branded, /src="\/src\/main\.tsx"/);
      const twice = applyTreemarkablesDocumentHead(branded, route);
      assert.equal(twice, branded);
    });
  }

  it("adds BlogPosting on the two posts only", () => {
    const post = applyTreemarkablesDocumentHead(html, "/blog/hazardous-tree-removal-gisborne-5-signs-dangerous-tree");
    assert.match(post, /"@type":"BlogPosting"/);
    assert.match(post, /5 Signs Your Tree Is a Hazard/);
    const home = applyTreemarkablesDocumentHead(html, "/");
    assert.doesNotMatch(home, /BlogPosting/);
  });
});
