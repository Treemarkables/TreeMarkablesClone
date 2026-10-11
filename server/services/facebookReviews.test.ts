/**
 * Run: npx tsx --test server/services/facebookReviews.test.ts
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  DEFAULT_FACEBOOK_GRAPH_VERSION,
  facebookErrorInfo,
  facebookGraphUrl,
  facebookGraphVersion,
  redactFacebookSecrets,
} from "../config/facebookGraph.ts";
import {
  checkFacebookConnection,
  FACEBOOK_REVIEWS_TTL_MS,
  forgetFacebookReviewsMemory,
  loadFacebookPageReviews,
} from "./reviewsService.ts";

const TOKEN = "page-token-not-standard-xyz";
const PAGE_ID = "106756807493773";

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    FACEBOOK_PAGE_ACCESS_TOKEN: TOKEN,
    FACEBOOK_PAGE_ID: PAGE_ID,
    ...extra,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cacheFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fb-reviews-"));
  return path.join(dir, "facebook-reviews.json");
}

const sampleReview = {
  reviewer: { name: "Aroha K." },
  rating: 5,
  review_text: "Careful removal and a tidy site.",
  created_time: "2026-09-01T00:00:00+0000",
};

describe("Facebook Graph version", { concurrency: false }, () => {
  it("defaults to v23.0 and accepts an override with or without the v prefix", () => {
    assert.equal(facebookGraphVersion({}), DEFAULT_FACEBOOK_GRAPH_VERSION);
    assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "v24.0" }), "v24.0");
    assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: " 24.0 " }), "v24.0");
    assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "not a version" }), "v23.0");
    assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "v18.0/../" }), "v23.0");
    assert.match(facebookGraphUrl("123/ratings?limit=10"), /https:\/\/graph\.facebook\.com\/v23\.0\/123\/ratings\?limit=10/);
    assert.match(
      facebookGraphUrl("123/ratings", { FACEBOOK_GRAPH_VERSION: "v24.0" }),
      /\/v24\.0\/123\/ratings$/,
    );
  });

  it("says token expired only for code 190 and redacts the token", () => {
    const unknownPath = facebookErrorInfo({
      message: "(#2500) Unknown path components: /v18.0/106756807493773/ratings",
      type: "OAuthException",
      code: 2500,
      fbtrace_id: "trace-2500",
    }, TOKEN);
    assert.equal(unknownPath.code, 2500);
    assert.equal(unknownPath.tokenExpired, false);
    assert.equal(unknownPath.message.includes("token expired"), false);
    assert.match(unknownPath.message, /Unknown path components/);

    const otherOauth = facebookErrorInfo({
      message: "(#200) Provide valid app ID",
      type: "OAuthException",
      code: 200,
    });
    assert.equal(otherOauth.tokenExpired, false);
    assert.equal(otherOauth.message.includes("token expired"), false);

    const expired = facebookErrorInfo({
      message: `Error validating access token ${TOKEN}`,
      type: "OAuthException",
      code: 190,
    }, TOKEN);
    assert.equal(expired.tokenExpired, true);
    assert.match(expired.message, /token expired/i);
    assert.equal(expired.message.includes(TOKEN), false);
    assert.equal(expired.code, 190);

    const leaked = redactFacebookSecrets(
      `fetch failed https://graph.facebook.com/v23.0/1/ratings?access_token=${TOKEN}&fields=name`,
      TOKEN,
    );
    assert.equal(leaked.includes(TOKEN), false);
    assert.match(leaked, /access_token=\[redacted\]/);
  });

  it("does not hard-code a Graph version outside the shared helper", () => {
    const files = [
      "server/routes.ts",
      "server/services/reviewsService.ts",
      "server/services/metaMarketingService.ts",
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.equal(/graph\.facebook\.com\/v\d+/.test(text), false, file);
      assert.equal(text.includes("Replit Secrets"), false, file);
    }
    const routes = fs.readFileSync(path.join(process.cwd(), "server/routes.ts"), "utf8");
    const registrations = routes.match(/app\.get\(\s*['"]\/api\/reviews\/facebook['"]/g) ?? [];
    assert.equal(registrations.length, 1);
    assert.match(routes, /facebookGraphUrl\(/);
    assert.match(
      fs.readFileSync(path.join(process.cwd(), "server/services/metaMarketingService.ts"), "utf8"),
      /facebookGraphUrl\(/,
    );
  });
});

describe("Facebook reviews cache", { concurrency: false }, () => {
  let logs: string[];
  let errorSpy: typeof console.error;
  let logSpy: typeof console.log;

  beforeEach(() => {
    logs = [];
    errorSpy = console.error;
    logSpy = console.log;
    console.error = (...args: unknown[]) => {
      logs.push(args.map((part) => String(part)).join(" "));
    };
    console.log = (...args: unknown[]) => {
      logs.push(args.map((part) => String(part)).join(" "));
    };
  });

  afterEach(() => {
    console.error = errorSpy;
    console.log = logSpy;
  });

  it("stores a good response and serves it when Facebook later fails", async () => {
    const file = cacheFile();
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      const url = String(input);
      assert.match(url, /\/v23\.0\//);
      assert.match(url, /\/ratings\?/);
      if (calls === 1) {
        return jsonResponse({ data: [sampleReview] });
      }
      return jsonResponse({
        error: {
          message: `(#2500) Unknown path components: /v18.0/${PAGE_ID}/ratings token ${TOKEN}`,
          type: "OAuthException",
          code: 2500,
          fbtrace_id: "trace-2500",
        },
      }, 400);
    };

    const first = await loadFacebookPageReviews({
      fetchImpl,
      env: env(),
      cacheFile: file,
      now: 1_000,
      ttlMs: FACEBOOK_REVIEWS_TTL_MS,
    });
    assert.equal(first.success, true);
    assert.equal(first.cached, false);
    assert.equal(first.reviews.length, 1);
    assert.equal(first.reviews[0]?.name, "Aroha K.");
    assert.equal(first.reviews[0]?.comment, "Careful removal and a tidy site.");
    assert.equal(fs.existsSync(file), true);

    forgetFacebookReviewsMemory(file);
    const second = await loadFacebookPageReviews({
      fetchImpl,
      env: env(),
      cacheFile: file,
      now: 1_000 + FACEBOOK_REVIEWS_TTL_MS + 1,
      ttlMs: FACEBOOK_REVIEWS_TTL_MS,
    });
    assert.equal(calls, 2);
    assert.equal(second.success, true);
    assert.equal(second.cached, true);
    assert.equal(second.reviews.length, 1);
    assert.equal(second.reviews[0]?.name, "Aroha K.");
    assert.equal(second.code, 2500);
    assert.match(second.message ?? "", /Unknown path components/);
    assert.equal((second.message ?? "").toLowerCase().includes("token expired"), false);
    assert.equal(JSON.stringify(second).includes(TOKEN), false);
    assert.equal(logs.join("\n").includes(TOKEN), false);
    assert.match(logs.join("\n"), /code=2500/);
  });

  it("uses the on-disk copy within the fresh window without calling Facebook", async () => {
    const file = cacheFile();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({ data: [sampleReview] });
    };
    await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 5_000 });
    forgetFacebookReviewsMemory(file);
    const again = await loadFacebookPageReviews({
      fetchImpl,
      env: env(),
      cacheFile: file,
      now: 5_000 + 1_000,
    });
    assert.equal(calls, 1);
    assert.equal(again.cached, true);
    assert.equal(again.reviews.length, 1);
  });

  it("does not replace the last good copy with an empty success", async () => {
    const file = cacheFile();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ data: [sampleReview] });
      if (calls === 2) return jsonResponse({ data: [] });
      return jsonResponse({
        error: { message: "Temporary failure", type: "OAuthException", code: 1 },
      }, 500);
    };
    await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 1, ttlMs: 0 });
    const empty = await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 2, ttlMs: 0 });
    assert.equal(empty.reviews.length, 0);
    const failed = await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 3, ttlMs: 0 });
    assert.equal(failed.cached, true);
    assert.equal(failed.reviews.length, 1);
    assert.equal(failed.code, 1);
    assert.equal((failed.message ?? "").includes("token expired"), false);
  });

  it("reports code 190 as token expired and still serves the saved reviews", async () => {
    const file = cacheFile();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ data: [sampleReview] });
      return jsonResponse({
        error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190 },
      }, 400);
    };
    await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 1, ttlMs: 0 });
    const failed = await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 2, ttlMs: 0 });
    assert.equal(failed.cached, true);
    assert.equal(failed.reviews.length, 1);
    assert.equal(failed.code, 190);
    assert.match(failed.message ?? "", /token expired/i);
    assert.equal(JSON.stringify(failed).includes(TOKEN), false);
  });

  it("returns Facebook's message when nothing has been cached yet", async () => {
    const file = cacheFile();
    const fetchImpl: typeof fetch = async () => jsonResponse({
      error: { message: "(#2500) Unknown path components: /v18.0/page/ratings", type: "OAuthException", code: 2500 },
    }, 400);
    const result = await loadFacebookPageReviews({ fetchImpl, env: env(), cacheFile: file, now: 1 });
    assert.equal(result.success, false);
    assert.deepEqual(result.reviews, []);
    assert.equal(result.code, 2500);
    assert.match(result.message ?? "", /Unknown path components/);
    assert.equal((result.message ?? "").toLowerCase().includes("token expired"), false);
  });

  it("names DigitalOcean when credentials are missing and does not call the token expired", async () => {
    const file = cacheFile();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({ data: [] });
    };
    const missing = await loadFacebookPageReviews({
      fetchImpl,
      env: {},
      cacheFile: file,
    });
    assert.equal(calls, 0);
    assert.match(missing.message ?? "", /DigitalOcean/);
    assert.equal((missing.message ?? "").toLowerCase().includes("replit"), false);
    assert.equal((missing.message ?? "").toLowerCase().includes("token expired"), false);
  });
});

describe("Facebook connection status", { concurrency: false }, () => {
  it("returns Facebook's code for a retired version and token expired only for 190", async () => {
    const retired = await checkFacebookConnection({
      env: env(),
      fetchImpl: async (input) => {
        const url = String(input);
        assert.match(url, /\/v23\.0\//);
        assert.equal(url.includes("fields=name"), true);
        return jsonResponse({
          error: { message: "(#2500) Unknown path components: /v18.0/page", type: "OAuthException", code: 2500 },
        }, 400);
      },
    });
    assert.equal(retired.connected, false);
    assert.equal(retired.code, 2500);
    assert.equal((retired.message ?? "").toLowerCase().includes("token expired"), false);
    assert.equal(JSON.stringify(retired).includes(TOKEN), false);

    const expired = await checkFacebookConnection({
      env: env(),
      fetchImpl: async () => jsonResponse({
        error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190 },
      }, 400),
    });
    assert.equal(expired.connected, false);
    assert.equal(expired.code, 190);
    assert.match(expired.message ?? "", /token expired/i);

    const ok = await checkFacebookConnection({
      env: env({ FACEBOOK_GRAPH_VERSION: "v24.0" }),
      fetchImpl: async (input) => {
        assert.match(String(input), /\/v24\.0\//);
        return jsonResponse({ name: "Treemarkables", id: PAGE_ID });
      },
    });
    assert.deepEqual(ok, { connected: true, pageName: "Treemarkables", pageId: PAGE_ID });
  });
});
