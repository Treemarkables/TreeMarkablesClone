import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://inflow:inflow@127.0.0.1:5432/inflow_unused";

const { isOwnerPath } = await import("./tenantMiddleware.ts");

describe("public video captions owner path", () => {
  it("lets a logged-out watch page read captions.vtt", () => {
    const id = "a08555c6-3d9d-46fc-9094-3f98509d2c4e";
    assert.equal(isOwnerPath(`/api/videos/${id}/captions.vtt`), true);
    assert.equal(isOwnerPath(`/api/videos/${id}/public`), true);
    assert.equal(isOwnerPath(`/api/videos/${id}`), false);
    assert.equal(isOwnerPath(`/api/videos/${id}/captions/regenerate`), false);
  });

  it("lets the assistant job action run without a browser session", () => {
    assert.equal(isOwnerPath("/api/assistant/jobs"), true);
    assert.equal(isOwnerPath("/api/assistant/chat"), false);
  });
});
