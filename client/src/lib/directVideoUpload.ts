// Job and library video uploads. The bytes go to GCS on a resumable session
// instead of one multipart POST through the app host — that path is what the
// iPhone shell reported as "Network error during upload". See shared/videoUpload.ts.
import type { UploadProgress } from "@/lib/uploadWithProgress";
import {
  DIRECT_CHUNK_BYTES,
  PROXY_CHUNK_BYTES,
  VIDEO_EMPTY_MESSAGE,
  VIDEO_FILE_TYPE_MESSAGE,
  VIDEO_TOO_BIG_MESSAGE,
  assertGcsSessionUri,
  describeVideoFile,
  parseUploadFileSize,
  runChunkedVideoUpload,
  type ChunkResult,
} from "@shared/videoUpload";

const CHANNEL_KEY = "inflowVideoUploadChannel";

interface SessionData {
  token: string;
  uploadUrl: string;
  chunkUrl: string;
  completeUrl: string;
  mimeType: string;
  fileSize: number;
  directChunkSize: number;
  proxyChunkSize: number;
}

function rememberedChannel(): "direct" | "proxy" {
  try {
    return window.sessionStorage.getItem(CHANNEL_KEY) === "proxy" ? "proxy" : "direct";
  } catch {
    return "direct";
  }
}

function rememberChannel(channel: "direct" | "proxy"): void {
  try {
    window.sessionStorage.setItem(CHANNEL_KEY, channel);
  } catch {
    // Private mode and some webviews block storage. The next video tries direct again.
  }
}

async function postJson(url: string, body: unknown): Promise<{ message?: string; data?: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server to start the upload. Check your connection and try again.");
  }
  const payload = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  if (!response.ok) throw new Error(payload.message || `Upload failed (${response.status})`);
  return payload;
}

function xhrUpload(opts: {
  url: string;
  headers: Record<string, string>;
  body: Blob;
  withCredentials: boolean;
  timeoutMs: number;
  onBytes?: (loaded: number) => void;
}): Promise<{ status: number; range: string | null; text: string; networkError: boolean }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    // Absolute https URLs are the GCS session (no cookies). App paths stay POST.
    const method = opts.url.startsWith("http") && !opts.withCredentials ? "PUT" : "POST";
    xhr.open(method, opts.url);
    xhr.withCredentials = opts.withCredentials;
    xhr.timeout = opts.timeoutMs;
    for (const [key, value] of Object.entries(opts.headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onBytes?.(event.loaded);
    };
    const finish = (networkError: boolean) => {
      resolve({
        status: xhr.status,
        range: networkError ? null : xhr.getResponseHeader("Range"),
        text: networkError ? "" : xhr.responseText || "",
        networkError: networkError || xhr.status === 0,
      });
    };
    xhr.onload = () => finish(false);
    xhr.onerror = () => finish(true);
    xhr.ontimeout = () => finish(true);
    xhr.onabort = () => finish(true);
    xhr.send(opts.body);
  });
}

function directPut(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onBytes?: (loaded: number) => void,
): Promise<ChunkResult> {
  return xhrUpload({ url, headers, body, withCredentials: false, timeoutMs: 120_000, onBytes }).then((result) => ({
    status: result.status,
    range: result.range,
    networkError: result.networkError,
  }));
}

async function proxyPut(
  chunkUrl: string,
  token: string,
  headers: Record<string, string>,
  body: Blob,
  onBytes?: (loaded: number) => void,
): Promise<ChunkResult> {
  const result = await xhrUpload({
    url: chunkUrl,
    headers: { ...headers, "X-Upload-Token": token, "Content-Type": "application/octet-stream" },
    body,
    withCredentials: true,
    timeoutMs: 90_000,
    onBytes,
  });
  if (result.networkError) {
    return { status: 0, range: null, networkError: true };
  }
  let payload: { message?: string; data?: { gcsStatus?: number; range?: string | null } } = {};
  try {
    payload = JSON.parse(result.text) as typeof payload;
  } catch {
    payload = {};
  }
  if (result.status < 200 || result.status >= 300) {
    return {
      status: result.status,
      range: null,
      networkError: false,
      message: payload.message || `Upload failed (${result.status})`,
    };
  }
  const gcsStatus = payload.data?.gcsStatus ?? 0;
  return {
    status: gcsStatus,
    range: payload.data?.range ?? null,
    networkError: gcsStatus === 0,
    message: payload.message,
  };
}

function canPutDirect(url: string): boolean {
  try {
    assertGcsSessionUri(url);
    return true;
  } catch {
    return false;
  }
}

function readSession(payload: { data?: unknown }): SessionData {
  const data = payload.data;
  if (!data || typeof data !== "object") throw new Error("Could not start the video upload. Try again.");
  const row = data as Partial<SessionData>;
  if (
    typeof row.token !== "string" ||
    typeof row.uploadUrl !== "string" ||
    typeof row.chunkUrl !== "string" ||
    typeof row.completeUrl !== "string" ||
    typeof row.mimeType !== "string" ||
    typeof row.fileSize !== "number"
  ) {
    throw new Error("Could not start the video upload. Try again.");
  }
  return {
    token: row.token,
    uploadUrl: row.uploadUrl,
    chunkUrl: row.chunkUrl,
    completeUrl: row.completeUrl,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    directChunkSize: typeof row.directChunkSize === "number" ? row.directChunkSize : DIRECT_CHUNK_BYTES,
    proxyChunkSize: typeof row.proxyChunkSize === "number" ? row.proxyChunkSize : PROXY_CHUNK_BYTES,
  };
}

async function uploadViaSession(opts: {
  file: File;
  sessionUrl: string;
  completeBody: { title?: string; showToCustomer?: boolean };
  onProgress?: (progress: UploadProgress) => void;
}): Promise<{ success: boolean; data?: { id?: string } }> {
  const described = describeVideoFile(opts.file.name || "", opts.file.type || "");
  if (!described) throw new Error(VIDEO_FILE_TYPE_MESSAGE);
  const fileSize = parseUploadFileSize(opts.file.size);
  if (fileSize == null) {
    throw new Error(opts.file.size === 0 ? VIDEO_EMPTY_MESSAGE : VIDEO_TOO_BIG_MESSAGE);
  }

  const session = readSession(
    await postJson(opts.sessionUrl, {
      originalName: opts.file.name || `video.${described.extension}`,
      mimeType: described.mimeType,
      fileSize,
    }),
  );

  const directOk = canPutDirect(session.uploadUrl);
  await runChunkedVideoUpload({
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    uploadUrl: session.uploadUrl,
    token: session.token,
    directChunkSize: session.directChunkSize,
    proxyChunkSize: session.proxyChunkSize,
    // A non-GCS URL is never PUT from the phone. The signed token still names
    // the real session, and the same-origin chunk path uses that.
    initialChannel: directOk ? rememberedChannel() : "proxy",
    read: (start, end) => opts.file.slice(start, end),
    putDirect: (url, headers, body, onBytes) => directPut(url, headers, body, onBytes),
    putProxy: (headers, body, onBytes) => proxyPut(session.chunkUrl, session.token, headers, body, onBytes),
    queryStatus: () =>
      proxyPut(
        session.chunkUrl,
        session.token,
        { "Content-Range": `bytes */${session.fileSize}` },
        new Blob(),
      ),
    onProgress: opts.onProgress,
    onChannel: rememberChannel,
  });

  const completed = await postJson(session.completeUrl, {
    token: session.token,
    title: opts.completeBody.title || "",
    showToCustomer: opts.completeBody.showToCustomer,
  });
  return completed as { success: boolean; data?: { id?: string } };
}

export function uploadJobVideo(opts: {
  jobId: string;
  file: File;
  title?: string;
  showToCustomer: boolean;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<{ success: boolean; data?: { id?: string } }> {
  return uploadViaSession({
    file: opts.file,
    sessionUrl: `/api/jobs/${opts.jobId}/videos/upload-session`,
    completeBody: { title: opts.title, showToCustomer: opts.showToCustomer },
    onProgress: opts.onProgress,
  });
}

export function uploadLibraryVideo(opts: {
  file: File;
  title?: string;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<{ success: boolean; data?: { id?: string } }> {
  return uploadViaSession({
    file: opts.file,
    sessionUrl: "/api/videos/upload-session",
    completeBody: { title: opts.title, showToCustomer: true },
    onProgress: opts.onProgress,
  });
}
