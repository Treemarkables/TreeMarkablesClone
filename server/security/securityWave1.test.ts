import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  applyIncrement,
  createMemoryRateLimitBackend,
  resetRateLimitKey,
  setRateLimitBackendForTests,
} from "./rateLimitStore.ts";
import {
  checkLoginThrottle,
  clearLoginIdentifierThrottle,
  LOGIN_MAX_PER_IDENTIFIER,
  LOGIN_MAX_PER_IP,
} from "./loginThrottle.ts";
import { matchPublicWriteRule, PUBLIC_WRITE_RULES, publicMutatingRateLimit } from "./publicWriteRateLimit.ts";
import { buildHelmetDirectives, createHelmetMiddleware } from "./helmetConfig.ts";

function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("expected a TCP port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}

describe("applyIncrement window semantics", () => {
  it("starts a new window at count 1", () => {
    const next = applyIncrement(undefined, 1_000, 15_000);
    assert.equal(next.count, 1);
    assert.equal(next.resetAtMs, 16_000);
  });

  it("increments inside an open window without moving resetAt", () => {
    const first = applyIncrement(undefined, 1_000, 15_000);
    const second = applyIncrement(first, 2_000, 15_000);
    assert.equal(second.count, 2);
    assert.equal(second.resetAtMs, first.resetAtMs);
  });

  it("resets after the window expires", () => {
    const first = applyIncrement(undefined, 1_000, 15_000);
    const next = applyIncrement(first, first.resetAtMs, 15_000);
    assert.equal(next.count, 1);
    assert.equal(next.resetAtMs, first.resetAtMs + 15_000);
  });
});

describe("login throttle (shared store)", () => {
  beforeEach(() => {
    setRateLimitBackendForTests(createMemoryRateLimitBackend());
  });

  it("allows attempts up to the identifier cap, then 429s", async () => {
    for (let i = 0; i < LOGIN_MAX_PER_IDENTIFIER; i++) {
      const result = await checkLoginThrottle({ ip: "1.1.1.1", identifier: "crew@example.com" });
      assert.equal(result.allowed, true, `attempt ${i + 1} should be allowed`);
    }
    const blocked = await checkLoginThrottle({ ip: "1.1.1.1", identifier: "crew@example.com" });
    assert.equal(blocked.allowed, false);
  });

  it("does not lock a crew member after one typo if they then succeed", async () => {
    const first = await checkLoginThrottle({ ip: "10.0.0.8", identifier: "field@example.com" });
    assert.equal(first.allowed, true);
    await clearLoginIdentifierThrottle("field@example.com");
    for (let i = 0; i < LOGIN_MAX_PER_IDENTIFIER; i++) {
      const result = await checkLoginThrottle({ ip: "10.0.0.8", identifier: "field@example.com" });
      assert.equal(result.allowed, true);
    }
  });

  it("caps spray-across-accounts per IP independently of identifier", async () => {
    for (let i = 0; i < LOGIN_MAX_PER_IP; i++) {
      const result = await checkLoginThrottle({ ip: "9.9.9.9", identifier: `user${i}@example.com` });
      assert.equal(result.allowed, true, `ip attempt ${i + 1} should be allowed`);
    }
    const blocked = await checkLoginThrottle({ ip: "9.9.9.9", identifier: "last@example.com" });
    assert.equal(blocked.allowed, false);
  });

  it("fail-open when the store throws (field login must not hard-lock)", async () => {
    setRateLimitBackendForTests({
      async increment() {
        throw new Error("forced store failure");
      },
      async resetKey() {
        throw new Error("forced store failure");
      },
      async get() {
        throw new Error("forced store failure");
      },
    });
    const result = await checkLoginThrottle({ ip: "8.8.8.8", identifier: "owner@example.com" });
    assert.equal(result.allowed, true);
    await resetRateLimitKey("unused");
  });
});

describe("public mutating route matcher", () => {
  it("covers contact, signup, proposal-accept, and similar writes", () => {
    const hits = [
      "/api/contact",
      "/api/public/mulch-order",
      "/api/signup",
      "/api/customer-auth",
      "/api/reviews/submit",
      "/api/proposals/abc-123/accept",
      "/api/proposals/abc-123/viewed",
      "/api/proposals/abc-123/deposit-checkout",
      "/api/quotes/q-9/accept",
      "/api/invoices/inv-1/payment-checkout",
      "/api/invoices/inv-1/request-service",
    ];
    for (const path of hits) {
      assert.ok(matchPublicWriteRule(path), `expected ${path} to be rate-limited`);
    }
  });

  it("does not double-limit login, AI, or webhooks", () => {
    const skips = [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/ai/polish-description",
      "/api/webhooks/stripe",
      "/api/webhooks/twilio-voice",
      "/api/leads/extract-from-message",
      "/api/jobs/1/checklist/voice-check",
      "/health",
      "/login",
    ];
    for (const path of skips) {
      assert.equal(matchPublicWriteRule(path), undefined, `must skip ${path}`);
    }
  });

  it("keeps contact + mulch on the same named budget", () => {
    const contact = matchPublicWriteRule("/api/contact");
    const mulch = matchPublicWriteRule("/api/public/mulch-order");
    assert.equal(contact?.name, "contact-forms");
    assert.equal(mulch?.name, "contact-forms");
    assert.equal(contact?.limit, 5);
    assert.equal(contact?.windowMs, 10 * 60 * 1000);
  });

  it("lists every rule's routes for the Wave 1 report", () => {
    const listed = PUBLIC_WRITE_RULES.flatMap((r) => r.routes);
    assert.ok(listed.includes("POST /api/signup"));
    assert.ok(listed.includes("POST /api/proposals/:id/accept"));
  });
});

describe("helmet CSP (SPA-safe)", () => {
  it("keeps unsafe-inline for scripts and styles so index.html boot scripts + Radix do not blank", () => {
    const directives = buildHelmetDirectives();
    const scriptSrc = directives.scriptSrc;
    const styleSrc = directives.styleSrc;
    assert.ok(Array.isArray(scriptSrc) && scriptSrc.includes("'unsafe-inline'"));
    assert.ok(Array.isArray(scriptSrc) && scriptSrc.includes("'self'"));
    assert.ok(Array.isArray(styleSrc) && styleSrc.includes("'unsafe-inline'"));
  });

  it("denies framing and allows fonts, maps, turnstile, stripe, analytics", () => {
    const directives = buildHelmetDirectives();
    assert.deepEqual(directives.frameAncestors, ["'none'"]);
    assert.ok(Array.isArray(directives.fontSrc) && directives.fontSrc.includes("https://fonts.gstatic.com"));
    assert.ok(Array.isArray(directives.frameSrc) && directives.frameSrc.includes("https://challenges.cloudflare.com"));
    assert.ok(Array.isArray(directives.frameSrc) && directives.frameSrc.includes("https://maps.google.com"));
    assert.ok(Array.isArray(directives.connectSrc) && directives.connectSrc.includes("https:"));
    assert.ok(Array.isArray(directives.connectSrc) && directives.connectSrc.includes("wss:"));
  });

  it("does not use default-src * or object-src *", () => {
    const directives = buildHelmetDirectives();
    assert.deepEqual(directives.defaultSrc, ["'self'"]);
    assert.deepEqual(directives.objectSrc, ["'none'"]);
  });

  it("sends HSTS, CSP, X-Frame-Options, Referrer-Policy, and nosniff on GET /login", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(createHelmetMiddleware());
    app.get("/login", (_req, res) => {
      res.status(200).type("html").send("<!doctype html><html><body>login</body></html>");
    });
    const { url, close } = await listen(app);
    try {
      const res = await fetch(`${url}/login`);
      assert.equal(res.status, 200);
      const csp = res.headers.get("content-security-policy") || "";
      assert.ok(csp.includes("frame-ancestors 'none'"), csp);
      assert.ok(csp.includes("script-src"), csp);
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.ok(res.headers.get("referrer-policy"));
      // NODE_ENV is not 'development' in this test runner → HSTS on.
      const hsts = res.headers.get("strict-transport-security") || "";
      assert.ok(hsts.toLowerCase().includes("max-age="), hsts);
    } finally {
      await close();
    }
  });
});

describe("public write limiter (express-rate-limit + shared store)", () => {
  beforeEach(() => {
    setRateLimitBackendForTests(createMemoryRateLimitBackend());
  });

  it("429s the 6th contact POST from one IP and leaves login unthrottled by this limiter", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(publicMutatingRateLimit);
    app.post("/api/contact", (_req, res) => res.json({ success: true }));
    app.post("/api/auth/login", (_req, res) => res.json({ success: true }));
    const { url, close } = await listen(app);
    try {
      const headers = { "x-forwarded-for": "203.0.113.9" };
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${url}/api/contact`, { method: "POST", headers });
        assert.equal(res.status, 200, `contact ${i + 1}`);
      }
      const blocked = await fetch(`${url}/api/contact`, { method: "POST", headers });
      assert.equal(blocked.status, 429);
      const body = await blocked.json() as { success: boolean };
      assert.equal(body.success, false);

      for (let i = 0; i < 6; i++) {
        const login = await fetch(`${url}/api/auth/login`, { method: "POST", headers });
        assert.equal(login.status, 200, `login ${i + 1} must not share the contact limiter`);
      }
    } finally {
      await close();
    }
  });
});
