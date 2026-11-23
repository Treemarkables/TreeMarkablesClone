/**
 * Run: node --experimental-strip-types --test server/httpErrorText.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientSafeErrorText } from "./httpErrorText.ts";

describe("diary HTTP error text", () => {
  it("returns the error message without the stack", () => {
    const error = new Error("canceling statement due to statement timeout");
    error.stack = "Error: canceling statement due to statement timeout\n    at query (/app/server/db.ts:10:5)";
    const text = clientSafeErrorText(error, "Error fetching diary entries");
    assert.equal(text, "canceling statement due to statement timeout");
    assert.equal(text.includes("db.ts"), false);
  });

  it("includes a cause message and redacts connection strings", () => {
    const cause = new Error("connect postgres://user:secret@ep.neon.tech/neondb refused");
    const error = new Error("Failed query", { cause });
    const text = clientSafeErrorText(error);
    assert.match(text, /Failed query/);
    assert.match(text, /\[redacted\]/);
    assert.equal(text.includes("secret"), false);
    assert.equal(text.includes("postgres://"), false);
  });

  it("caps the length and falls back when the error is empty", () => {
    const error = new Error("y".repeat(400));
    const text = clientSafeErrorText(error);
    assert.equal(text.length, 300);
    assert.equal(text.endsWith("…"), true);
    assert.equal(clientSafeErrorText("", "Error fetching diary entries"), "Error fetching diary entries");
  });
});
