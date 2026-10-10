/**
 * Run: node --experimental-strip-types --test client/src/lib/photoAnnotationLookup.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAnnotationBatch } from "./photoAnnotationLookup.ts";

describe("applyAnnotationBatch", () => {
  it("keeps a save that landed while the lookup was in flight", () => {
    const saved = {
      annotatedUrl: "/objects/photos/annotated_abc.png?t=1",
      shapes: [{ type: "arrow" as const, id: "a" }],
    };
    const next = applyAnnotationBatch(
      { "/objects/photos/job.jpg": saved },
      ["/objects/photos/job.jpg", "/objects/photos/other.jpg"],
      {
        "/objects/photos/job.jpg": { annotatedUrl: null, shapes: [] },
        "/objects/photos/other.jpg": {
          annotatedUrl: "/objects/photos/annotated_other.png",
          shapes: [],
        },
      },
      () => ({ annotatedUrl: null, shapes: [] }),
    );
    assert.equal(next["/objects/photos/job.jpg"], saved);
    assert.equal(
      next["/objects/photos/other.jpg"].annotatedUrl,
      "/objects/photos/annotated_other.png",
    );
  });

  it("records photos with no saved annotation so the lookup does not retry", () => {
    const next = applyAnnotationBatch(
      {},
      ["/objects/photos/plain.jpg"],
      {},
      () => ({ annotatedUrl: null, shapes: [] }),
    );
    assert.deepEqual(next["/objects/photos/plain.jpg"], {
      annotatedUrl: null,
      shapes: [],
    });
  });

  it("fills a photo the server has an annotation for", () => {
    const next = applyAnnotationBatch(
      {},
      ["/objects/photos/job.jpg"],
      {
        "/objects/photos/job.jpg": {
          annotatedUrl: "/objects/photos/annotated_abc.png",
          shapes: [{ type: "circle" as const, id: "c" }],
        },
      },
      () => ({ annotatedUrl: null, shapes: [] }),
    );
    assert.equal(next["/objects/photos/job.jpg"].annotatedUrl, "/objects/photos/annotated_abc.png");
    assert.equal(next["/objects/photos/job.jpg"].shapes.length, 1);
  });
});
