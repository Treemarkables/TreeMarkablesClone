// GCS side of a job-video upload. The browser either PUTs to the resumable
// session URL itself, or the app forwards one small chunk here. The session
// URL is only created after the staff session is checked.
import https from "https";
import { objectStorageClient } from "./photoStorage";
import {
  assertGcsSessionUri,
  bucketCorsAllowsUpload,
  mergeVideoUploadCors,
  videoBucketName,
  videoObjectLocation,
  type VideoBucketCorsRule,
} from "../shared/videoUpload.ts";

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export function putToGcsSession(
  sessionUri: string,
  headers: Record<string, string>,
  body: Buffer,
): Promise<{ status: number; range: string | null }> {
  assertGcsSessionUri(sessionUri);
  const url = new URL(sessionUri);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "PUT",
        headers: { ...headers, "Content-Length": body.length },
      },
      (res) => {
        res.resume();
        const range = headerValue(res.headers.range);
        res.on("end", () => resolve({ status: res.statusCode || 0, range }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(60_000, () => req.destroy(new Error("Storage upload timed out")));
    req.end(body);
  });
}

let corsAttempt: Promise<boolean> | null = null;

function rulesFromMetadata(cors: unknown): VideoBucketCorsRule[] {
  if (!Array.isArray(cors)) return [];
  const rules: VideoBucketCorsRule[] = [];
  for (const entry of cors) {
    if (!entry || typeof entry !== "object") continue;
    const rule = entry as VideoBucketCorsRule;
    rules.push({
      origin: Array.isArray(rule.origin) ? [...rule.origin] : undefined,
      method: Array.isArray(rule.method) ? [...rule.method] : undefined,
      responseHeader: Array.isArray(rule.responseHeader) ? [...rule.responseHeader] : undefined,
      maxAgeSeconds: typeof rule.maxAgeSeconds === "number" ? rule.maxAgeSeconds : undefined,
    });
  }
  return rules;
}

async function applyVideoBucketCors(origin: string): Promise<boolean> {
  const bucketName = videoBucketName(process.env.PRIVATE_OBJECT_DIR || "");
  const bucket = objectStorageClient.bucket(bucketName);
  let existing: VideoBucketCorsRule[] = [];
  try {
    const [metadata] = await bucket.getMetadata();
    existing = rulesFromMetadata(metadata.cors);
  } catch (err) {
    console.error(
      "[VIDEO_UPLOAD] could not read bucket CORS:",
      err instanceof Error ? err.message : "unknown error",
    );
    return false;
  }
  if (bucketCorsAllowsUpload(existing, origin)) return true;
  try {
    await bucket.setCorsConfiguration(mergeVideoUploadCors(existing, [origin]));
    console.log("[VIDEO_UPLOAD] bucket CORS allows direct video upload");
    return true;
  } catch (err) {
    console.error(
      "[VIDEO_UPLOAD] could not set bucket CORS:",
      err instanceof Error ? err.message : "unknown error",
    );
    return false;
  }
}

// Best-effort. A service account that can write objects often cannot edit
// bucket CORS. Direct browser upload then fails the preflight and the client
// continues through the same-origin chunk path.
export function ensureVideoBucketCors(origin: string): Promise<boolean> {
  if (!corsAttempt) {
    corsAttempt = applyVideoBucketCors(origin).catch((err) => {
      console.error(
        "[VIDEO_UPLOAD] bucket CORS was not updated:",
        err instanceof Error ? err.message : "unknown error",
      );
      return false;
    });
  }
  return corsAttempt;
}

export async function createVideoUploadSession(args: {
  filename: string;
  mimeType: string;
  origin: string;
}): Promise<string> {
  const { bucketName, objectName } = videoObjectLocation(process.env.PRIVATE_OBJECT_DIR || "", args.filename);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  if (!args.origin.startsWith("http://") && !args.origin.startsWith("https://")) {
    throw new Error("Upload origin is not a web origin");
  }
  const [uri] = await file.createResumableUpload({
    origin: args.origin,
    metadata: { contentType: args.mimeType },
  });
  assertGcsSessionUri(uri);
  return uri;
}

export async function uploadedVideoByteSize(filename: string): Promise<number | null> {
  const { bucketName, objectName } = videoObjectLocation(process.env.PRIVATE_OBJECT_DIR || "", filename);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  return Number.isFinite(size) ? size : null;
}
