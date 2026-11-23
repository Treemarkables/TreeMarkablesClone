import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COOKIE_SAMESITE,
  chooseSessionCookieValue,
  listSessionCookieValues,
  preferSessionCookieHeader,
  resolveSessionCookieHeader,
  sessionIdFromCookieValue,
  signSessionId,
} from "./sessionCookie.ts";

const SECRET = "test-session-secret";

function cookieValue(sid: string): string {
  return encodeURIComponent(`s:${signSessionId(sid, SECRET)}`);
}

describe("duplicate treemarkables.sid cookies", () => {
  it("uses a first-party SameSite so the iOS webview stores the session", () => {
    assert.equal(SESSION_COOKIE_SAMESITE, "lax");
  });

  it("reads every session cookie in header order", () => {
    const header = `other=1; treemarkables.sid=first; treemarkables.sid=second`;
    assert.deepEqual(listSessionCookieValues(header), ["first", "second"]);
  });

  it("unsigns the sid express-session would load", () => {
    const raw = cookieValue("owner-session");
    assert.equal(sessionIdFromCookieValue(raw, [SECRET]), "owner-session");
    assert.equal(sessionIdFromCookieValue(raw, ["wrong"]), null);
    assert.equal(sessionIdFromCookieValue("not-signed", [SECRET]), null);
  });

  it("keeps the first cookie when that session already has an employee", async () => {
    const crew = cookieValue("crew-sid");
    const owner = cookieValue("owner-sid");
    const header = `treemarkables.sid=${crew}; treemarkables.sid=${owner}`;
    const seen: string[] = [];
    const resolved = await resolveSessionCookieHeader(header, [SECRET], async (sid) => {
      seen.push(sid);
      return sid === "crew-sid" || sid === "owner-sid";
    });
    assert.equal(resolved, header);
    assert.deepEqual(seen, ["crew-sid"]);
  });

  it("uses a later owner session when the first cookie has no employee", async () => {
    const stale = cookieValue("stale-sid");
    const owner = cookieValue("owner-sid");
    const header = `theme=dark; treemarkables.sid=${stale}; treemarkables.sid=${owner}`;
    const resolved = await resolveSessionCookieHeader(header, [SECRET], async (sid) => sid === "owner-sid");
    assert.equal(resolved, `treemarkables.sid=${owner}; theme=dark`);
    assert.equal(sessionIdFromCookieValue(listSessionCookieValues(resolved!)[0], [SECRET]), "owner-sid");
  });

  it("ignores a forged later cookie and leaves the header alone", async () => {
    const stale = cookieValue("stale-sid");
    const header = `treemarkables.sid=${stale}; treemarkables.sid=s%3Aforged.not-a-mac`;
    const resolved = await resolveSessionCookieHeader(header, [SECRET], async (sid) => sid === "owner-sid");
    assert.equal(resolved, header);
  });

  it("does not rewrite a single session cookie", async () => {
    const only = cookieValue("owner-sid");
    const header = `treemarkables.sid=${only}`;
    let lookups = 0;
    const chosen = await chooseSessionCookieValue(listSessionCookieValues(header), [SECRET], async () => {
      lookups += 1;
      return true;
    });
    assert.equal(chosen, null);
    assert.equal(lookups, 0);
  });

  it("drops the empty duplicate and keeps unrelated cookies", () => {
    const header = preferSessionCookieHeader(
      "a=1; treemarkables.sid=empty; b=2; treemarkables.sid=live",
      "live",
    );
    assert.equal(header, "treemarkables.sid=live; a=1; b=2");
  });
});
