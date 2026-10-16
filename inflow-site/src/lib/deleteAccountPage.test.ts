import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyDeleteAccountDocument } from "./deleteAccountStaticHtml.ts";
import {
  DELETE_DEVELOPER,
  DELETE_EMAIL,
  DELETE_PAGE_HEADING,
  DELETE_PAGE_URL,
  DELETE_SUBJECT,
} from "./deleteAccountCopy.ts";

const FIXTURE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="OLD" />
    <meta property="og:title" content="OLD" />
    <meta property="og:description" content="OLD" />
    <meta property="og:url" content="https://inflowapp.co.nz" />
    <meta name="twitter:title" content="OLD" />
    <meta name="twitter:description" content="OLD" />
    <link rel="canonical" href="https://inflowapp.co.nz" />
    <link rel="stylesheet" href="/assets/index-abc.css" />
    <title>OLD</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

function readRepo(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("delete account page", () => {
  it("puts the deletion steps in the HTML before JavaScript runs", () => {
    const page = applyDeleteAccountDocument(FIXTURE);
    const root = page.slice(page.indexOf('<div id="root">'), page.indexOf('<script type="module"'));
    for (const phrase of [
      DELETE_PAGE_HEADING,
      DELETE_DEVELOPER,
      DELETE_EMAIL,
      DELETE_SUBJECT,
      "You do not need to sign in",
      "does not need an Inflow login",
      "within 30 days",
      "typically 7 years",
      "New Zealand tax law",
      "purged within 30 days",
      "Profile",
      "Jobs",
      "Customers",
      "Photos",
      "Invoices",
    ]) {
      assert.ok(root.includes(phrase), phrase);
    }
    assert.ok(root.includes("<h1"));
    assert.ok(root.includes("<ol"));
    assert.ok(page.includes(`<link rel="canonical" href="${DELETE_PAGE_URL}"`));
    assert.ok(page.includes('href="/assets/index-abc.css"'));
    assert.ok(page.includes('src="/assets/index-abc.js"'));
    assert.equal(page.includes("<title>OLD</title>"), false);
  });

  it("is routed, listed, and linked from the privacy page", () => {
    const app = readRepo("src/App.tsx");
    const privacy = readRepo("src/pages/Privacy.tsx");
    const footer = readRepo("src/components/Footer.tsx");
    const sitemap = readRepo("public/sitemap.xml");
    assert.ok(app.includes('path="/delete-account"'));
    assert.ok(privacy.includes('href="/delete-account"'));
    assert.ok(footer.includes('href="/delete-account"'));
    assert.ok(sitemap.includes("https://inflowapp.co.nz/delete-account<"));
  });
});
