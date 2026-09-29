/**
 * Run: node --experimental-strip-types --test server/emailPhotoAttachments.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPhotoEmailParts } from "./emailPhotoAttachments.ts";

function jpeg(bytes: number): Buffer {
  return Buffer.alloc(bytes, 1);
}

describe("job-card email photo parts", () => {
  it("attaches each photo as a file and an inline cid copy, never a data URI", () => {
    const built = buildPhotoEmailParts({
      photos: [
        { sourceUrl: "/objects/photos/a.jpg", jpeg: jpeg(100) },
        { sourceUrl: "/objects/photos/b.jpeg", jpeg: jpeg(80) },
      ],
      embedInline: true,
    });

    assert.deepEqual(built.sentUrls, ["/objects/photos/a.jpg", "/objects/photos/b.jpeg"]);
    assert.equal(built.skipped, 0);
    assert.equal(built.inlineHtml.includes("data:"), false);
    assert.equal(built.inlineHtml.includes("cid:job-photo-0"), true);
    assert.equal(built.inlineHtml.includes("cid:job-photo-1"), true);

    const files = built.attachments.filter((a) => a.disposition === "attachment");
    const inlines = built.attachments.filter((a) => a.disposition === "inline");
    assert.equal(files.length, 2);
    assert.equal(inlines.length, 2);
    assert.deepEqual(
      files.map((a) => a.filename),
      ["Job-photo-1.jpg", "Job-photo-2.jpg"],
    );
    assert.equal(files.every((a) => a.content_id == null), true);
    assert.deepEqual(
      inlines.map((a) => a.content_id),
      ["job-photo-0", "job-photo-1"],
    );
    assert.equal(files[0].type, "image/jpeg");
    assert.equal(files[0].content, inlines[0].content);
  });

  it("sends file attachments only when inline CID images are disabled", () => {
    const built = buildPhotoEmailParts({
      photos: [{ sourceUrl: "/objects/photos/a.jpg", jpeg: jpeg(40) }],
      embedInline: false,
    });
    assert.equal(built.inlineHtml, "");
    assert.equal(built.attachments.length, 1);
    assert.equal(built.attachments[0].disposition, "attachment");
    assert.equal(built.attachments[0].content_id, undefined);
    assert.deepEqual(built.sentUrls, ["/objects/photos/a.jpg"]);
  });

  it("drops photos that would blow the size budget and still sends the ones that fit", () => {
    const built = buildPhotoEmailParts({
      photos: [
        { sourceUrl: "/objects/photos/small.jpg", jpeg: jpeg(50) },
        { sourceUrl: "/objects/photos/huge.jpg", jpeg: jpeg(500) },
      ],
      embedInline: true,
      byteBudget: 120,
    });
    // 50 (file) + 50 (inline) = 100, the 500-byte photo does not fit.
    assert.deepEqual(built.sentUrls, ["/objects/photos/small.jpg"]);
    assert.equal(built.skipped, 1);
    assert.equal(built.attachments.length, 2);
  });

  it("keeps the file attachment when the inline duplicate would exceed the budget", () => {
    const built = buildPhotoEmailParts({
      photos: [{ sourceUrl: "/objects/photos/a.jpg", jpeg: jpeg(80) }],
      embedInline: true,
      byteBudget: 100,
    });
    assert.deepEqual(built.sentUrls, ["/objects/photos/a.jpg"]);
    assert.equal(built.inlineHtml, "");
    assert.equal(built.attachments.length, 1);
    assert.equal(built.attachments[0].disposition, "attachment");
  });
});
