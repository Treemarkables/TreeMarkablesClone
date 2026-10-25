import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  buildTreemarkablesSitemapXml,
  handleTreemarkablesSitemap,
  renderTreemarkablesSitemap,
  type TreemarkablesBlogPost,
} from "./treemarkablesSitemap.ts";

const STATIC_LOCS = [
  "https://www.treemarkables.co.nz/",
  "https://www.treemarkables.co.nz/tree-removal",
  "https://www.treemarkables.co.nz/tree-pruning",
  "https://www.treemarkables.co.nz/stump-grinding",
  "https://www.treemarkables.co.nz/hedge-trimming",
  "https://www.treemarkables.co.nz/emergency-tree-removal",
  "https://www.treemarkables.co.nz/wairoa",
  "https://www.treemarkables.co.nz/east-coast",
  "https://www.treemarkables.co.nz/blog",
  "https://www.treemarkables.co.nz/summer-offer",
  "https://www.treemarkables.co.nz/contact",
  "https://www.treemarkables.co.nz/privacy-policy",
];

function blogSlugsFromIndex(): string[] {
  const source = fs.readFileSync(path.resolve("client/src/pages/Blog.tsx"), "utf8");
  return [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);
}

describe("Treemarkables sitemap", () => {
  it("lists every marketing page and the published posts on www", async () => {
    const xml = await buildTreemarkablesSitemapXml();
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    for (const loc of STATIC_LOCS) {
      assert.ok(xml.includes(`<loc>${loc}</loc>`), loc);
    }
    const slugs = blogSlugsFromIndex();
    assert.ok(slugs.length >= 2);
    for (const slug of slugs) {
      assert.ok(xml.includes(`<loc>https://www.treemarkables.co.nz/blog/${slug}</loc>`), slug);
    }
    assert.equal(xml.includes("app.treemarkables.co.nz"), false);
    assert.equal(xml.includes("inflowapp.co.nz"), false);
  });

  it("still returns the static pages when the blog query throws", async () => {
    const xml = await buildTreemarkablesSitemapXml(async () => {
      throw new Error("relation \"blog_posts\" does not exist");
    });
    for (const loc of STATIC_LOCS) {
      assert.ok(xml.includes(`<loc>${loc}</loc>`), loc);
    }
    assert.equal(xml.includes("/blog/hazardous-tree-removal"), false);
    assert.equal(xml.includes("/blog/why-regular-tree-pruning"), false);
    assert.match(xml, /<\/urlset>\s*$/);
  });

  it("ignores a blog row that would not be a safe URL", () => {
    const posts: TreemarkablesBlogPost[] = [
      { slug: "../admin", lastmod: "2026-01-01" },
      { slug: "storm-damage-gisborne", lastmod: "not-a-date" },
      { slug: "storm-damage-gisborne", lastmod: "2026-03-01" },
    ];
    const xml = renderTreemarkablesSitemap(posts);
    assert.equal(xml.includes("../admin"), false);
    assert.equal(xml.includes("<lastmod>not-a-date</lastmod>"), false);
    const matches = xml.match(/storm-damage-gisborne/g);
    assert.equal(matches?.length, 1);
    assert.ok(xml.includes("<loc>https://www.treemarkables.co.nz/blog/storm-damage-gisborne</loc>"));
  });

  it("answers 200 XML from the route handler when the blog query throws", async () => {
    let status = 0;
    const headers = new Map<string, string>();
    let body = "";
    await handleTreemarkablesSitemap(
      {
        headersSent: false,
        status: (code) => {
          status = code;
        },
        setHeader: (name, value) => {
          headers.set(name, value);
        },
        send: (payload) => {
          body = payload;
        },
      },
      async () => {
        throw new Error("blog query failed");
      },
    );
    assert.equal(status, 200);
    assert.equal(headers.get("Content-Type"), "application/xml; charset=utf-8");
    assert.ok(body.includes("<loc>https://www.treemarkables.co.nz/tree-removal</loc>"));
    assert.equal(body.includes("/blog/hazardous-tree-removal"), false);
  });

  it("matches the checked-in sitemap.xml", async () => {
    const xml = await buildTreemarkablesSitemapXml();
    const file = fs.readFileSync(path.resolve("sitemap.xml"), "utf8");
    assert.equal(file, xml);
  });
});
