/**
 * Run: node --experimental-strip-types --test server/photoAnnotationWrite.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithBusiness } from "./tenancy/tenantStore.ts";
import {
  isHiddenAnnotationConflict,
  photoAnnotationWriteValues,
} from "./photoAnnotationWrite.ts";

const input = {
  sourceUrl: "/objects/photos/job.jpg",
  annotations: [{ type: "arrow", id: "a", color: "#FF0000", strokeWidth: 4, points: [0, 0, 0.2, 0.2] }],
  annotatedUrl: "/objects/photos/annotated_abc.png",
  annotatedBy: "Jullian",
};

describe("photoAnnotationWriteValues", () => {
  it("stamps the signed-in business so RLS keeps the row", () => {
    const values = runWithBusiness("biz-treemarkables", () => photoAnnotationWriteValues(input));
    assert.equal(values.businessId, "biz-treemarkables");
    assert.equal(values.sourceUrl, input.sourceUrl);
    assert.equal(values.annotatedUrl, input.annotatedUrl);
    assert.equal(values.annotatedBy, "Jullian");
  });

  it("leaves business id off outside a request", () => {
    const values = photoAnnotationWriteValues(input);
    assert.equal(values.businessId, undefined);
  });
});

describe("isHiddenAnnotationConflict", () => {
  it("recognises a unique conflict and an RLS rejection, including on the cause", () => {
    assert.equal(isHiddenAnnotationConflict({ code: "23505", message: "duplicate key" }), true);
    const wrapped = new Error("Failed query", {
      cause: Object.assign(new Error("new row violates row-level security policy"), {
        code: "42501",
      }),
    });
    assert.equal(isHiddenAnnotationConflict(wrapped), true);
  });

  it("ignores an unrelated failure", () => {
    assert.equal(isHiddenAnnotationConflict(new Error("Source photo not found")), false);
    assert.equal(isHiddenAnnotationConflict(null), false);
  });
});
