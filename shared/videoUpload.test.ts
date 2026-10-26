/**
 * Run: node --experimental-strip-types --test shared/videoUpload.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIRECT_CHUNK_BYTES,
  GCS_CHUNK_MULTIPLE,
  PROXY_CHUNK_BYTES,
  VIDEO_DROPPED_MESSAGE,
  VIDEO_FILE_TYPE_MESSAGE,
  assertGcsSessionUri,
  bucketCorsAllowsUpload,
  describeVideoFile,
  isAllowedUploadOrigin,
  mergeVideoUploadCors,
  nextChunkEnd,
  nextOffsetFromRange,
  parseChunkRange,
  parseUploadFileSize,
  resolveUploadOrigin,
  runChunkedVideoUpload,
  videoObjectLocation,
} from "./videoUpload.ts";

describe("describeVideoFile", () => {
  it("treats an iPhone .MOV with an empty type as quicktime", () => {
    assert.deepEqual(describeVideoFile("IMG_4307.MOV", ""), {
      mimeType: "video/quicktime",
      extension: "mov",
    });
  });

  it("accepts a .mov that WebKit labels as octet-stream", () => {
    assert.deepEqual(describeVideoFile("clip.mov", "application/octet-stream"), {
      mimeType: "video/quicktime",
      extension: "mov",
    });
  });

  it("accepts a browser video type when the name has no extension", () => {
    assert.deepEqual(describeVideoFile("video", "video/mp4"), {
      mimeType: "video/mp4",
      extension: "mp4",
    });
  });

  it("rejects a document", () => {
    assert.equal(describeVideoFile("notes.pdf", "application/pdf"), null);
  });
});

describe("chunk bounds", () => {
  it("keeps proxy chunks on a 256 KiB boundary and inside the edge timeout", () => {
    assert.equal(PROXY_CHUNK_BYTES % GCS_CHUNK_MULTIPLE, 0);
    assert.equal(DIRECT_CHUNK_BYTES % GCS_CHUNK_MULTIPLE, 0);
    assert.ok(PROXY_CHUNK_BYTES <= 1024 * 1024);
    assert.ok(PROXY_CHUNK_BYTES >= GCS_CHUNK_MULTIPLE);
  });

  it("keeps a short file as one last chunk", () => {
    assert.equal(nextChunkEnd(0, 100, DIRECT_CHUNK_BYTES), 99);
  });

  it("splits on 256 KiB boundaries and lets the tail be short", () => {
    const size = DIRECT_CHUNK_BYTES + 10;
    assert.equal(nextChunkEnd(0, size, DIRECT_CHUNK_BYTES), DIRECT_CHUNK_BYTES - 1);
    assert.equal(nextChunkEnd(DIRECT_CHUNK_BYTES, size, DIRECT_CHUNK_BYTES), size - 1);
  });

  it("parses a status query and a proxy-sized part", () => {
    assert.deepEqual(parseChunkRange("bytes */100", 0, 100), {
      ok: true,
      range: { kind: "query", total: 100 },
    });
    const end = PROXY_CHUNK_BYTES - 1;
    const header = `bytes 0-${end}/5000000`;
    assert.deepEqual(parseChunkRange(header, PROXY_CHUNK_BYTES, 5000000), {
      ok: true,
      range: { kind: "part", start: 0, end, total: 5000000 },
    });
  });

  it("rejects an 8MB body on the same-origin path and a mis-sized chunk", () => {
    const tooBig = parseChunkRange(`bytes 0-${DIRECT_CHUNK_BYTES - 1}/99999999`, DIRECT_CHUNK_BYTES, 99999999);
    assert.equal(tooBig.ok, false);
    const ragged = parseChunkRange("bytes 0-100/5000000", 101, 5000000);
    assert.equal(ragged.ok, false);
  });

  it("reads the last saved byte from a GCS 308 range", () => {
    assert.equal(nextOffsetFromRange("bytes=0-8388607"), 8388608);
    assert.equal(nextOffsetFromRange(null), null);
  });

  it("caps the file at the Postgres integer limit", () => {
    assert.equal(parseUploadFileSize(0), null);
    assert.equal(parseUploadFileSize(1.5), null);
    assert.equal(parseUploadFileSize(1024), 1024);
    assert.equal(parseUploadFileSize(2 * 1024 * 1024 * 1024), null);
  });
});

describe("upload origin and object path", () => {
  it("allows the app hosts and the capacitor shell, not a random site", () => {
    assert.equal(isAllowedUploadOrigin("https://app.inflowapp.co.nz"), true);
    assert.equal(isAllowedUploadOrigin("https://app.treemarkables.co.nz"), true);
    assert.equal(isAllowedUploadOrigin("capacitor://localhost"), true);
    assert.equal(isAllowedUploadOrigin("http://localhost:5000"), true);
    assert.equal(isAllowedUploadOrigin("https://evil.example"), false);
    assert.equal(isAllowedUploadOrigin("http://app.inflowapp.co.nz"), false);
  });

  it("falls back to the app URL when the page origin is not allowed", () => {
    assert.equal(
      resolveUploadOrigin("https://evil.example", "https://app.inflowapp.co.nz"),
      "https://app.inflowapp.co.nz",
    );
    assert.equal(
      resolveUploadOrigin("https://app.treemarkables.co.nz", "https://app.inflowapp.co.nz"),
      "https://app.treemarkables.co.nz",
    );
  });

  it("builds the private videos object path and rejects a crafted name", () => {
    assert.deepEqual(
      videoObjectLocation("/treemarkables-photos/.private", "1700000000000_123e4567-e89b-12d3-a456-426614174000.mov"),
      {
        bucketName: "treemarkables-photos",
        objectName: ".private/videos/1700000000000_123e4567-e89b-12d3-a456-426614174000.mov",
      },
    );
    assert.throws(
      () => videoObjectLocation("/treemarkables-photos/.private", "../etc/passwd"),
      /Invalid upload token/,
    );
  });

  it("only accepts GCS resumable session URLs", () => {
    assert.doesNotThrow(() =>
      assertGcsSessionUri(
        "https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadType=resumable&upload_id=abc",
      ),
    );
    assert.throws(() => assertGcsSessionUri("https://evil.example/upload/storage/v1/b/bucket/o"), /Invalid upload session/);
    assert.throws(
      () => assertGcsSessionUri("http://storage.googleapis.com/upload/storage/v1/b/bucket/o"),
      /Invalid upload session/,
    );
    assert.throws(
      () => assertGcsSessionUri("https://user:pass@storage.googleapis.com/upload/x"),
      /Invalid upload session/,
    );
  });
});

describe("bucket CORS merge", () => {
  it("keeps an unrelated rule and adds the upload methods and headers", () => {
    const merged = mergeVideoUploadCors(
      [{ origin: ["https://maps.example"], method: ["GET"], responseHeader: ["Content-Type"], maxAgeSeconds: 60 }],
      ["https://app.inflowapp.co.nz"],
    );
    assert.equal(merged[0].origin?.[0], "https://maps.example");
    assert.equal(merged[0].method?.includes("PUT"), false);
    const upload = merged[1];
    assert.equal(upload.origin?.includes("https://app.inflowapp.co.nz"), true);
    assert.equal(upload.origin?.includes("capacitor://localhost"), true);
    assert.equal(upload.method?.includes("PUT"), true);
    assert.equal(upload.responseHeader?.includes("Content-Range"), true);
    assert.equal(upload.responseHeader?.includes("Range"), true);
    assert.equal(bucketCorsAllowsUpload(merged, "https://app.inflowapp.co.nz"), true);
    assert.equal(bucketCorsAllowsUpload(merged, "https://evil.example"), false);
  });
});

describe("runChunkedVideoUpload", () => {
  const fileSize = PROXY_CHUNK_BYTES + 100;

  function harness(overrides: {
    direct?: (start: number) => { status: number; range: string | null; networkError?: boolean; message?: string };
    proxy?: (start: number, length: number) => { status: number; range: string | null; message?: string };
    query?: () => { status: number; range: string | null };
    initialChannel?: "direct" | "proxy";
  }) {
    const calls = { direct: 0, proxy: 0, query: 0 };
    const channels: string[] = [];
    const promise = runChunkedVideoUpload({
      fileSize,
      mimeType: "video/quicktime",
      uploadUrl: "https://storage.googleapis.com/upload/storage/v1/b/b/o?upload_id=1",
      token: "token",
      directChunkSize: PROXY_CHUNK_BYTES,
      proxyChunkSize: PROXY_CHUNK_BYTES,
      initialChannel: overrides.initialChannel,
      read: (start, end) => new Blob([new Uint8Array(end - start)]),
      putDirect: async (_url, headers) => {
        calls.direct += 1;
        const start = Number(/^bytes (\d+)-/.exec(headers["Content-Range"] || "")?.[1]);
        return overrides.direct?.(start) ?? { status: 500, range: null };
      },
      putProxy: async (headers, body) => {
        calls.proxy += 1;
        const start = Number(/^bytes (\d+)-/.exec(headers["Content-Range"] || "")?.[1]);
        return overrides.proxy?.(start, body.size) ?? { status: 500, range: null };
      },
      queryStatus: async () => {
        calls.query += 1;
        return overrides.query?.() ?? { status: 308, range: null };
      },
      onChannel: (channel) => channels.push(channel),
    });
    return { promise, calls, channels };
  }

  it("uploads directly when storage accepts the pieces", async () => {
    const { promise, calls } = harness({
      direct: (start) =>
        start === 0
          ? { status: 308, range: `bytes=0-${PROXY_CHUNK_BYTES - 1}` }
          : { status: 200, range: null },
    });
    await promise;
    assert.equal(calls.direct, 2);
    assert.equal(calls.proxy, 0);
  });

  it("asks storage how far it got when a 308 has no Range", async () => {
    const { promise, calls } = harness({
      direct: (start) =>
        start === 0 ? { status: 308, range: null } : { status: 200, range: null },
      query: () => ({ status: 308, range: `bytes=0-${PROXY_CHUNK_BYTES - 1}` }),
    });
    await promise;
    assert.equal(calls.direct, 2);
    assert.equal(calls.query, 1);
    assert.equal(calls.proxy, 0);
  });

  it("falls back to same-origin chunks when the direct request never connects", async () => {
    const { promise, calls, channels } = harness({
      direct: () => ({ status: 0, range: null, networkError: true }),
      query: () => ({ status: 308, range: null }),
      proxy: (start, length) =>
        start === 0
          ? { status: 308, range: `bytes=0-${length - 1}` }
          : { status: 200, range: null },
    });
    await promise;
    assert.equal(calls.direct, 1);
    assert.equal(calls.proxy, 2);
    assert.deepEqual(channels, ["proxy"]);
  });

  it("surfaces a storage rejection instead of retrying it as a network error", async () => {
    const { promise, calls } = harness({
      direct: () => ({ status: 403, range: null, message: "Storage rejected the upload." }),
    });
    await assert.rejects(promise, /Storage rejected the upload/);
    assert.equal(calls.direct, 1);
    assert.equal(calls.proxy, 0);
  });

  it("stops after repeated dropped proxy chunks", async () => {
    const { promise } = harness({
      initialChannel: "proxy",
      proxy: () => ({ status: 0, range: null, networkError: true }),
      query: () => ({ status: 0, range: null, networkError: true }),
    });
    await assert.rejects(promise, new RegExp(VIDEO_DROPPED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("rejects a file the server would not accept", async () => {
    await assert.rejects(
      runChunkedVideoUpload({
        fileSize: 0,
        mimeType: "video/mp4",
        uploadUrl: "https://storage.googleapis.com/upload/x",
        token: "t",
        directChunkSize: PROXY_CHUNK_BYTES,
        proxyChunkSize: PROXY_CHUNK_BYTES,
        read: () => new Blob(),
        putDirect: async () => ({ status: 200, range: null }),
        putProxy: async () => ({ status: 200, range: null }),
        queryStatus: async () => ({ status: 200, range: null }),
      }),
      /empty/,
    );
  });
});

describe("video file message", () => {
  it("names the formats staff actually pick on an iPhone", () => {
    assert.match(VIDEO_FILE_TYPE_MESSAGE, /\.mov/);
  });
});
