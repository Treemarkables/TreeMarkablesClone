import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  LIVE_APP_SIGNUP_URL,
  continueToSignup,
  resolveAppSignupUrl,
  signupHref,
} from "./signupLink.ts";

describe("signup handoff", () => {
  it("points at the live app signup that creates a tenant", () => {
    assert.equal(LIVE_APP_SIGNUP_URL, "https://app.inflowapp.co.nz/signup");
  });

  it("builds a prefilled https signup URL and never a mailto", () => {
    const href = signupHref(LIVE_APP_SIGNUP_URL, {
      businessName: "Sustainable Scapes Limited",
      firstName: "Nigel",
      lastName: "Abercrombie",
      email: "nigel@sustainablescapes.co.nz",
      plan: "freemium",
    });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, "https://app.inflowapp.co.nz/signup");
    assert.equal(url.searchParams.get("businessName"), "Sustainable Scapes Limited");
    assert.equal(url.searchParams.get("email"), "nigel@sustainablescapes.co.nz");
    assert.equal(url.searchParams.get("plan"), "freemium");
    assert.equal(href.startsWith("mailto:"), false);
  });

  it("drops unknown plans and blank fields", () => {
    const href = signupHref(LIVE_APP_SIGNUP_URL, { plan: "owner", email: "  " });
    assert.equal(href, "https://app.inflowapp.co.nz/signup");
  });

  it("refuses mailto and other non-http bases", () => {
    assert.equal(signupHref("mailto:hello@inflowapp.co.nz"), null);
    assert.equal(signupHref("javascript:alert(1)"), null);
    const blocked = continueToSignup({
      signupUrl: "mailto:hello@inflowapp.co.nz",
      firstName: "Nigel",
      lastName: "Abercrombie",
      businessName: "Sustainable Scapes Limited",
      email: "nigel@sustainablescapes.co.nz",
    });
    assert.equal(blocked.ok, false);
  });

  it("ignores a bad override and keeps the live signup URL", () => {
    assert.equal(resolveAppSignupUrl(undefined), LIVE_APP_SIGNUP_URL);
    assert.equal(resolveAppSignupUrl(""), LIVE_APP_SIGNUP_URL);
    assert.equal(resolveAppSignupUrl("mailto:hello@inflowapp.co.nz"), LIVE_APP_SIGNUP_URL);
    assert.equal(
      resolveAppSignupUrl("https://staging.example.com/signup"),
      "https://staging.example.com/signup",
    );
  });

  it("does not navigate the request-access form to mailto", () => {
    const formSrc = readFileSync(
      fileURLToPath(new URL("../components/RequestAccessForm.tsx", import.meta.url)),
      "utf8",
    );
    assert.doesNotMatch(formSrc, /location(?:\.href)?\s*=\s*[^;\n]*mailto:/);
    assert.doesNotMatch(formSrc, /VITE_REQUEST_ACCESS_ENDPOINT/);
    assert.match(formSrc, /continueToSignup/);
    assert.match(formSrc, /mailto:\$\{BRAND\.contactEmail\}/);
  });
});
