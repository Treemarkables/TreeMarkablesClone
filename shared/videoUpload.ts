// Job-video uploads must not send the whole file through the app host.
//
// DigitalOcean App Platform fronts the app with Cloudflare. Two limits on that
// path drop iPhone walkthroughs (HEVC .mov, often 100MB or more):
//   - Cloudflare closes or 413s request bodies over the zone upload cap
//     (100MB on the usual plan; the edge may reset the connection instead of
//     returning a status WebKit will show).
//   - The edge stops waiting for a response after about 100 seconds (Cloudflare
//     524). App Platform's own upload cap is 600 seconds. A clip on mobile data
//     outlasts both, and the browser never gets a finished HTTP response.
// WKWebView then fires XHR onerror with status 0. The old client turned that
// into the toast "Network error during upload".
//
// The file now goes to GCS on a resumable session. The browser PUTs 8MB pieces
// straight to storage.googleapis.com when the bucket allows it. If that is
// blocked (missing bucket CORS, or WebKit hiding the 308 resume status), the
// same pieces go through the app in 1MB chunks. 1MB stays under the edge body
// cap and can still finish inside the ~100s wait on a slow phone link. The app
// only handles short JSON calls plus those chunks.

export const GCS_CHUNK_MULTIPLE = 256 * 1024;
export const DIRECT_CHUNK_BYTES = 8 * 1024 * 1024;
// 1MB is four times the 256 KiB GCS block. Smaller than the edge body cap, and
// short enough that a slow job-site upload can finish before the ~100s wait.
export const PROXY_CHUNK_BYTES = 1024 * 1024;
// videos.file_size is a Postgres integer. 2GB exactly does not fit.
export const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024 - 1;

export const VIDEO_FILE_TYPE_MESSAGE =
  "Choose a video file. iPhone clips should be .mov or .mp4.";
export const VIDEO_EMPTY_MESSAGE = "That video file is empty.";
export const VIDEO_TOO_BIG_MESSAGE =
  "That video is over 2GB. Record a shorter clip and try again.";
export const VIDEO_DROPPED_MESSAGE =
  "The connection dropped while uploading this video. Check your signal and try again — it uploads in pieces.";
export const VIDEO_INCOMPLETE_MESSAGE =
  "The video only partly uploaded. Please try again.";
export const VIDEO_EXPIRED_MESSAGE = "Upload expired. Start the upload again.";

const EXTENSION_MIME: Record<string, string> = {
  mov: "video/quicktime",
  qt: "video/quicktime",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
};

const MIME_EXTENSION: Record<string, string> = {
  "video/quicktime": "mov",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "video/mpeg": "mpeg",
};

export const VIDEO_FILENAME_EXTENSIONS = Object.keys(EXTENSION_MIME);

export function describeVideoFile(
  originalName: string,
  browserType: string,
): { mimeType: string; extension: string } | null {
  const base = (originalName || "").split(/[/\\]/).pop() || "";
  const rawExt = (base.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fromExt = EXTENSION_MIME[rawExt];
  const type = (browserType || "").toLowerCase().split(";")[0].trim();
  const fromType = type.startsWith("video/") ? type : "";
  if (!fromExt && !fromType) return null;
  // The filename is the reliable signal. WebKit often labels a .mov as
  // video/quicktime, but it also sends an empty type or application/octet-stream.
  const mimeType = fromExt || fromType;
  const extension = fromExt ? rawExt : MIME_EXTENSION[fromType] || "mp4";
  return { mimeType, extension };
}

export function safeOriginalName(name: string): string {
  const base = (name || "").split(/[/\\]/).pop() || "video";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return cleaned || "video";
}

export function parseUploadFileSize(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_VIDEO_UPLOAD_BYTES) return null;
  return n;
}

// Inclusive end index of the next resumable chunk. Every chunk except the
// last must be a multiple of 256 KiB or GCS rejects it.
export function nextChunkEnd(offset: number, fileSize: number, chunkSize: number): number {
  if (offset < 0 || offset >= fileSize) {
    throw new Error("Upload chunk is out of range.");
  }
  const remaining = fileSize - offset;
  let length = Math.min(Math.max(chunkSize, GCS_CHUNK_MULTIPLE), remaining);
  if (length < remaining) {
    length = length - (length % GCS_CHUNK_MULTIPLE);
    if (length <= 0) length = Math.min(GCS_CHUNK_MULTIPLE, remaining);
  }
  return offset + length - 1;
}

export type ChunkRange =
  | { kind: "query"; total: number }
  | { kind: "part"; start: number; end: number; total: number };

export function parseChunkRange(
  header: string,
  bodyLength: number,
  fileSize: number,
): { ok: true; range: ChunkRange } | { ok: false; message: string } {
  const value = header.trim();
  const query = /^bytes \*\/(\d+)$/.exec(value);
  if (query) {
    const total = Number(query[1]);
    if (total !== fileSize) return { ok: false, message: "Upload size does not match." };
    if (bodyLength !== 0) return { ok: false, message: "Status check must be empty." };
    return { ok: true, range: { kind: "query", total } };
  }
  const part = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value);
  if (!part) return { ok: false, message: "Upload chunk was missing its place in the file." };
  const start = Number(part[1]);
  const end = Number(part[2]);
  const total = Number(part[3]);
  if (total !== fileSize) return { ok: false, message: "Upload size does not match." };
  if (end < start || start < 0 || end >= total) {
    return { ok: false, message: "Upload chunk is out of range." };
  }
  if (start % GCS_CHUNK_MULTIPLE !== 0) {
    return { ok: false, message: "Upload chunk is misaligned." };
  }
  const length = end - start + 1;
  if (bodyLength !== length) return { ok: false, message: "Upload chunk length does not match." };
  const isLast = end === total - 1;
  if (!isLast && length % GCS_CHUNK_MULTIPLE !== 0) {
    return { ok: false, message: "Upload chunk is the wrong size." };
  }
  if (length > PROXY_CHUNK_BYTES) return { ok: false, message: "Upload chunk is too large." };
  return { ok: true, range: { kind: "part", start, end, total } };
}

// GCS 308 Resume Incomplete: "bytes=0-8388607" means that last byte is saved.
// Returns the next offset to send, or null when the header is missing.
// A 308 with no Range means nothing has been stored yet (next offset 0) —
// callers treat null as "unknown" and a follow-up status query as authoritative.
export function nextOffsetFromRange(rangeHeader: string | null | undefined): number | null {
  if (!rangeHeader) return null;
  const match = /bytes=(\d+)-(\d+)/.exec(rangeHeader);
  if (!match) return null;
  const end = Number(match[2]);
  if (!Number.isFinite(end) || end < 0) return null;
  return end + 1;
}

const ALLOWED_ORIGIN_HOSTS = new Set([
  "app.inflowapp.co.nz",
  "app.treemarkables.co.nz",
  "localhost",
  "127.0.0.1",
]);

export function isAllowedUploadOrigin(origin: string, appUrl?: string): boolean {
  if (origin === "capacitor://localhost" || origin === "ionic://localhost") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return false;
  }
  if (ALLOWED_ORIGIN_HOSTS.has(url.hostname)) return true;
  if (url.protocol === "https:" && url.hostname.endsWith(".ondigitalocean.app")) return true;
  if (appUrl) {
    try {
      if (new URL(appUrl).origin === url.origin) return true;
    } catch {
      // Ignore a bad APP_URL and keep the built-in hosts.
    }
  }
  return false;
}

export function resolveUploadOrigin(originHeader: string | undefined, appUrl: string): string {
  if (originHeader && isAllowedUploadOrigin(originHeader, appUrl)) return originHeader;
  try {
    return new URL(appUrl).origin;
  } catch {
    return "https://app.inflowapp.co.nz";
  }
}

export interface VideoBucketCorsRule {
  origin?: string[];
  method?: string[];
  responseHeader?: string[];
  maxAgeSeconds?: number;
}

const CORS_ORIGINS = [
  "https://app.inflowapp.co.nz",
  "https://app.treemarkables.co.nz",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
];

const CORS_METHODS = ["GET", "HEAD", "PUT", "POST", "OPTIONS", "DELETE"];
const CORS_RESPONSE_HEADERS = [
  "Content-Type",
  "Content-Length",
  "Content-Range",
  "Range",
  "Location",
  "ETag",
  "x-goog-resumable",
];

function hasHeader(headers: string[], name: string): boolean {
  const needle = name.toLowerCase();
  return headers.some((header) => header.toLowerCase() === needle);
}

export function bucketCorsAllowsUpload(
  rules: VideoBucketCorsRule[] | null | undefined,
  origin: string,
): boolean {
  return (rules || []).some((rule) => {
    const origins = rule.origin || [];
    const methods = (rule.method || []).map((method) => method.toUpperCase());
    const headers = rule.responseHeader || [];
    const originOk = origins.includes("*") || origins.includes(origin);
    const methodOk = methods.includes("*") || methods.includes("PUT");
    const headersOk = ["content-type", "content-range", "range"].every((name) => hasHeader(headers, name));
    return originOk && methodOk && headersOk;
  });
}

// Keep unrelated bucket rules. Add the app origins and the headers a browser
// resumable PUT has to send and read.
export function mergeVideoUploadCors(
  existing: VideoBucketCorsRule[] | null | undefined,
  extraOrigins: string[],
): VideoBucketCorsRule[] {
  const origins = new Set<string>(CORS_ORIGINS);
  for (const origin of extraOrigins) {
    if (origin) origins.add(origin);
  }
  const next = (existing || []).map((rule) => ({
    ...rule,
    origin: [...(rule.origin || [])],
    method: [...(rule.method || [])],
    responseHeader: [...(rule.responseHeader || [])],
  }));
  let rule = next.find(
    (candidate) =>
      (candidate.method || []).some((method) => method.toUpperCase() === "PUT") &&
      (candidate.origin || []).some((origin) => origins.has(origin) || origin === "*"),
  );
  if (!rule) {
    rule = { origin: [], method: [], responseHeader: [], maxAgeSeconds: 3600 };
    next.push(rule);
  }
  if (!(rule.origin || []).includes("*")) {
    for (const origin of origins) {
      if (!(rule.origin || []).includes(origin)) rule.origin!.push(origin);
    }
  }
  for (const method of CORS_METHODS) {
    if (!(rule.method || []).some((current) => current.toUpperCase() === method)) {
      rule.method!.push(method);
    }
  }
  for (const header of CORS_RESPONSE_HEADERS) {
    if (!hasHeader(rule.responseHeader || [], header)) rule.responseHeader!.push(header);
  }
  rule.maxAgeSeconds = Math.max(rule.maxAgeSeconds || 0, 3600);
  return next;
}

export function videoBucketName(privateDir: string): string {
  const parts = privateDir.trim().replace(/^\//, "").split("/").filter(Boolean);
  if (!parts[0]) throw new Error("PRIVATE_OBJECT_DIR not set");
  return parts[0];
}

export function videoObjectLocation(
  privateDir: string,
  filename: string,
): { bucketName: string; objectName: string } {
  assertSafeVideoFilename(filename);
  const parts = privateDir.trim().replace(/^\//, "").split("/").filter(Boolean);
  if (!parts[0]) throw new Error("PRIVATE_OBJECT_DIR not set");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  const objectName = prefix ? `${prefix}/videos/${filename}` : `videos/${filename}`;
  return { bucketName, objectName };
}

const VIDEO_FILENAME_RE =
  /^[0-9]{10,}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mov|qt|mp4|m4v|webm|3gp|avi|mkv|mpeg|mpg)$/;

export function assertSafeVideoFilename(filename: string): void {
  if (!VIDEO_FILENAME_RE.test(filename)) {
    throw new Error("Invalid upload token");
  }
}

export function assertGcsSessionUri(uri: string): void {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("Invalid upload session");
  }
  if (url.username || url.password || url.protocol !== "https:") {
    throw new Error("Invalid upload session");
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const ok =
    (host === "storage.googleapis.com" && path.startsWith("/upload/")) ||
    (host === "www.googleapis.com" && path.startsWith("/upload/storage/"));
  if (!ok) throw new Error("Invalid upload session");
}

export interface ChunkProgress {
  loaded: number;
  total: number;
  percent: number;
  phase: "uploading" | "processing";
}

export interface ChunkResult {
  status: number;
  range: string | null;
  networkError?: boolean;
  message?: string;
}

export interface ChunkUploadOptions {
  fileSize: number;
  mimeType: string;
  uploadUrl: string;
  token: string;
  directChunkSize: number;
  proxyChunkSize: number;
  initialChannel?: "direct" | "proxy";
  read: (start: number, endExclusive: number) => Blob;
  putDirect: (
    url: string,
    headers: Record<string, string>,
    body: Blob,
    onBytes?: (loaded: number) => void,
  ) => Promise<ChunkResult>;
  putProxy: (
    headers: Record<string, string>,
    body: Blob,
    onBytes?: (loaded: number) => void,
  ) => Promise<ChunkResult>;
  queryStatus: () => Promise<ChunkResult>;
  onProgress?: (progress: ChunkProgress) => void;
  onChannel?: (channel: "direct" | "proxy") => void;
}

function report(opts: ChunkUploadOptions, loaded: number, phase: ChunkProgress["phase"]): void {
  const percent = opts.fileSize > 0 ? Math.min(100, Math.round((loaded / opts.fileSize) * 100)) : 0;
  opts.onProgress?.({ loaded, total: opts.fileSize, percent, phase });
}

async function savedOffset(opts: ChunkUploadOptions): Promise<number | null> {
  // A dropped chunk may already be stored. Ask a few times before resending
  // from the old offset — GCS rejects a range that does not continue the file.
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: ChunkResult;
    try {
      result = await opts.queryStatus();
    } catch {
      continue;
    }
    if (
      result.networkError ||
      result.status === 0 ||
      result.status === 408 ||
      result.status === 429 ||
      result.status >= 500
    ) {
      continue;
    }
    if (result.status === 200 || result.status === 201) return opts.fileSize;
    if (result.status === 308) {
      const next = nextOffsetFromRange(result.range);
      return next == null ? 0 : next;
    }
    return null;
  }
  return null;
}

const MAX_ATTEMPTS_AT_OFFSET = 4;

// Sends the file on a GCS resumable session. Direct PUTs go to storage; a
// dropped direct attempt (typical when bucket CORS is missing) continues
// through putProxy at a smaller size. A later failure asks GCS how far it got
// and resumes from that byte.
export async function runChunkedVideoUpload(opts: ChunkUploadOptions): Promise<void> {
  if (!Number.isInteger(opts.fileSize) || opts.fileSize < 1) {
    throw new Error(VIDEO_EMPTY_MESSAGE);
  }
  if (opts.fileSize > MAX_VIDEO_UPLOAD_BYTES) throw new Error(VIDEO_TOO_BIG_MESSAGE);

  let offset = 0;
  let channel: "direct" | "proxy" = opts.initialChannel === "proxy" ? "proxy" : "direct";
  let attemptsAtOffset = 0;
  let steps = 0;
  const maxSteps = Math.ceil(opts.fileSize / GCS_CHUNK_MULTIPLE) + 8;

  while (offset < opts.fileSize) {
    if (++steps > maxSteps) throw new Error(VIDEO_DROPPED_MESSAGE);
    const chunkSize = channel === "direct" ? opts.directChunkSize : opts.proxyChunkSize;
    const end = nextChunkEnd(offset, opts.fileSize, chunkSize);
    const body = opts.read(offset, end + 1);
    const contentRange = `bytes ${offset}-${end}/${opts.fileSize}`;
    report(opts, offset, "uploading");

    let result: ChunkResult;
    try {
      const onBytes = (loaded: number) => report(opts, offset + loaded, "uploading");
      result =
        channel === "direct"
          ? await opts.putDirect(
              opts.uploadUrl,
              { "Content-Type": opts.mimeType, "Content-Range": contentRange },
              body,
              onBytes,
            )
          : await opts.putProxy(
              { "Content-Range": contentRange, "X-Upload-Token": opts.token },
              body,
              onBytes,
            );
    } catch (err) {
      result = {
        status: 0,
        range: null,
        networkError: true,
        message: err instanceof Error ? err.message : undefined,
      };
    }

    if (result.networkError || result.status === 0) {
      if (channel === "direct") {
        channel = "proxy";
        opts.onChannel?.("proxy");
        const queried = await savedOffset(opts);
        if (queried != null) offset = Math.min(queried, opts.fileSize);
        continue;
      }
      attemptsAtOffset += 1;
      if (attemptsAtOffset >= MAX_ATTEMPTS_AT_OFFSET) {
        throw new Error(result.message || VIDEO_DROPPED_MESSAGE);
      }
      const queried = await savedOffset(opts);
      if (queried != null && queried > offset) {
        offset = Math.min(queried, opts.fileSize);
        attemptsAtOffset = 0;
      }
      continue;
    }

    if (result.status === 200 || result.status === 201) {
      if (channel === "direct") opts.onChannel?.("direct");
      offset = opts.fileSize;
      break;
    }

    if (result.status === 308) {
      if (channel === "direct") opts.onChannel?.("direct");
      let next = nextOffsetFromRange(result.range);
      if (next == null) {
        const queried = await savedOffset(opts);
        next = queried == null ? null : queried;
      }
      if (next == null || next <= offset) {
        attemptsAtOffset += 1;
        if (attemptsAtOffset >= MAX_ATTEMPTS_AT_OFFSET) throw new Error(VIDEO_DROPPED_MESSAGE);
        continue;
      }
      offset = Math.min(next, opts.fileSize);
      attemptsAtOffset = 0;
      continue;
    }

    if (result.status === 408 || result.status === 429 || result.status >= 500) {
      attemptsAtOffset += 1;
      if (attemptsAtOffset >= MAX_ATTEMPTS_AT_OFFSET) {
        throw new Error(result.message || VIDEO_DROPPED_MESSAGE);
      }
      continue;
    }

    throw new Error(result.message || `Upload failed (${result.status})`);
  }

  report(opts, opts.fileSize, "processing");
}
