// Upload a single file via multipart/form-data with real progress events.
//
// fetch() can't report upload progress (no ReadableStream upload in browsers),
// so large video uploads looked frozen — the button said "Uploading…" with no
// way to tell a slow-but-working upload from a stuck one. XMLHttpRequest still
// exposes upload.onprogress, so we use it here.
//
// Progress phases the caller can render:
//   - bytes climbing 0 → 100%   ("Uploading 42%")
//   - bytes at 100%, awaiting response  (phase flips to "processing" — GCS is
//     finalizing the object + the row is being written)

export interface UploadProgress {
  loaded: number;
  total: number;
  // 0–100 while bytes are in flight; -1 when the browser can't compute a total.
  percent: number;
  // "uploading" until all bytes are sent; "processing" once they are and we're
  // waiting on the server to finalize and respond.
  phase: "uploading" | "processing";
}

export interface UploadOptions {
  url: string;
  file: File;
  // Multipart field name for the file part. Defaults to "video".
  fileField?: string;
  // Text fields sent BEFORE the file part — the streaming server engine needs
  // them parsed before the file body arrives.
  fields?: Record<string, string>;
  onProgress?: (p: UploadProgress) => void;
}

export function uploadFileWithProgress<T = any>(opts: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [k, v] of Object.entries(opts.fields || {})) form.append(k, v);
    form.append(opts.fileField || "video", opts.file);

    xhr.open("POST", opts.url, true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (!opts.onProgress) return;
      const total = e.lengthComputable ? e.total : 0;
      const percent = total > 0 ? Math.round((e.loaded / total) * 100) : -1;
      const done = total > 0 && e.loaded >= total;
      opts.onProgress({
        loaded: e.loaded,
        total,
        percent,
        phase: done ? "processing" : "uploading",
      });
    };

    // All bytes handed to the OS — server is now finalizing. Flip to processing
    // even if the last onprogress didn't land exactly on total.
    xhr.upload.onload = () => {
      opts.onProgress?.({ loaded: 1, total: 1, percent: 100, phase: "processing" });
    };

    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response (e.g. an HTML proxy error page) — fall through.
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        reject(new Error(body?.message || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(form);
  });
}
