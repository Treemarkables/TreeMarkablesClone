import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAssetScriptFailure, isChunkLoadErrorMessage } from "./chunkLoadError.ts";

describe("stale chunk reload", () => {
  it("recognises dynamic-import failures", () => {
    assert.equal(
      isChunkLoadErrorMessage("Failed to fetch dynamically imported module: https://app.inflowapp.co.nz/assets/Dispatch-abc.js"),
      true,
    );
    assert.equal(isChunkLoadErrorMessage("Importing a module script failed."), true);
    assert.equal(isChunkLoadErrorMessage("Load failed"), false);
  });

  it("treats a WebKit asset script error as a chunk miss and ignores a bare fetch failure", () => {
    assert.equal(
      isAssetScriptFailure("Load failed", "https://app.inflowapp.co.nz/assets/index-abc123.js"),
      true,
    );
    assert.equal(
      isAssetScriptFailure("SyntaxError: Unexpected token '<'", "/assets/index-abc123.js"),
      true,
    );
    assert.equal(isAssetScriptFailure("Load failed", ""), false);
    assert.equal(isAssetScriptFailure("Load failed", "https://app.inflowapp.co.nz/api/auth/me"), false);
  });
});
