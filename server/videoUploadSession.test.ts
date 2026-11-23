/**
 * Run: node --experimental-strip-types --test server/videoUploadSession.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VIDEO_EXPIRED_MESSAGE } from "../shared/videoUpload.ts";
import {
  newVideoObjectFilename,
  signVideoUploadToken,
  verifyVideoUploadToken,
  type VideoUploadIntent,
} from "./videoUploadSession.ts";

const SECRET = "test-secret";
const SESSION =
  "https://storage.googleapis.com/upload/storage/v1/b/treemarkables-photos/o?uploadType=resumable&upload_id=abc";

function intent(overrides: Partial<Omit<VideoUploadIntent, "exp">> = {}): Omit<VideoUploadIntent, "exp"> {
  const filename = newVideoObjectFilename("mov");
  return {
    filename,
    mimeType: "video/quicktime",
    fileSize: 120_000_000,
    originalName: "IMG_4307.MOV",
    jobId: "job-4307",
    businessId: "biz-1",
    employeeId: "emp-1",
    kind: "job",
    sessionUri: SESSION,
    origin: "https://app.inflowapp.co.nz",
    ...overrides,
  };
}

describe("video upload token", () => {
  it("round-trips a job video claim", () => {
    const body = intent();
    const token = signVideoUploadToken(body, SECRET, 1_000);
    const verified = verifyVideoUploadToken(token, SECRET, 1_000);
    assert.equal(verified.filename, body.filename);
    assert.equal(verified.fileSize, 120_000_000);
    assert.equal(verified.jobId, "job-4307");
    assert.equal(verified.sessionUri, SESSION);
    assert.equal(verified.mimeType, "video/quicktime");
  });

  it("rejects a tampered size, a wrong secret, and an expired claim", () => {
    const token = signVideoUploadToken(intent(), SECRET, 1_000);
    const [data, sig] = token.split(".");
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    parsed.fileSize = 1;
    const swapped = `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${sig}`;
    assert.throws(() => verifyVideoUploadToken(swapped, SECRET, 1_000), /Invalid upload token/);
    assert.throws(() => verifyVideoUploadToken(token, "other-secret", 1_000), /Invalid upload token/);
    assert.throws(
      () => verifyVideoUploadToken(token, SECRET, 1_000 + 13 * 60 * 60 * 1000),
      new RegExp(VIDEO_EXPIRED_MESSAGE),
    );
  });

  it("refuses to sign a session URL that is not GCS", () => {
    assert.throws(
      () =>
        signVideoUploadToken(
          intent({ sessionUri: "https://evil.example/upload/object" }),
          SECRET,
        ),
      /Invalid upload session/,
    );
  });

  it("names the object with a safe extension", () => {
    const filename = newVideoObjectFilename("MOV");
    assert.match(filename, /\.mov$/);
    const token = signVideoUploadToken(intent({ filename }), SECRET);
    assert.equal(verifyVideoUploadToken(token, SECRET).filename, filename);
  });
});
