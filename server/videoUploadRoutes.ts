// Staff video upload that does not push the file through the hosting edge in
// one request. See shared/videoUpload.ts for why the iPhone toast was
// "Network error during upload".
import express, { type NextFunction, type Request, type Response } from "express";
import type { InsertVideo, Video } from "@shared/schema";
import {
  DIRECT_CHUNK_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  PROXY_CHUNK_BYTES,
  VIDEO_DROPPED_MESSAGE,
  VIDEO_EMPTY_MESSAGE,
  VIDEO_EXPIRED_MESSAGE,
  VIDEO_FILE_TYPE_MESSAGE,
  VIDEO_INCOMPLETE_MESSAGE,
  VIDEO_TOO_BIG_MESSAGE,
  describeVideoFile,
  parseChunkRange,
  parseUploadFileSize,
  resolveUploadOrigin,
  safeOriginalName,
} from "../shared/videoUpload.ts";
import {
  newVideoObjectFilename,
  signVideoUploadToken,
  verifyVideoUploadToken,
  videoUploadSecret,
  type VideoUploadIntent,
} from "./videoUploadSession.ts";
import {
  createVideoUploadSession,
  ensureVideoBucketCors,
  putToGcsSession,
  uploadedVideoByteSize,
} from "./videoUploadGcs.ts";

interface UploadJob {
  id: string;
  businessId?: string | null;
  customerId?: string | null;
}

export interface DirectVideoUploadDeps {
  getJob: (jobId: string) => Promise<UploadJob | undefined>;
  createVideo: (businessId: string | undefined, data: InsertVideo) => Promise<Video>;
  findByFilename: (filename: string) => Promise<Video | undefined>;
  deleteObject: (objectPath: string) => Promise<void>;
  onReady: (video: Video, showToCustomer: boolean) => Promise<void>;
  canPublishKnowledge: (businessId: string | undefined) => boolean;
  appUrl: string;
}

function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

function requireStaff(req: Request, res: Response): { employeeId: string; businessId: string } | null {
  const employeeId = req.session.employeeId;
  const businessId = req.session.businessId;
  if (!employeeId || !businessId) {
    fail(res, 401, "Unauthorized");
    return null;
  }
  return { employeeId, businessId };
}

function acceptChunk(req: Request, res: Response, next: NextFunction): void {
    express.raw({ type: () => true, limit: "2mb" })(req, res, (err: unknown) => {
    if (err) {
      fail(res, 413, "Upload chunk was too large. Try again.");
      return;
    }
    next();
  });
}

function readToken(req: Request): string {
  const header = req.get("x-upload-token");
  if (typeof header === "string" && header) return header;
  if (typeof req.body?.token === "string") return req.body.token;
  return "";
}

function webOrigin(appUrl: string): string {
  try {
    return new URL(appUrl).origin;
  } catch {
    return "https://app.inflowapp.co.nz";
  }
}

function clientMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (
      err.message === VIDEO_EXPIRED_MESSAGE ||
      err.message === "Invalid upload token" ||
      err.message === "Invalid upload session"
    ) {
      return err.message === "Invalid upload session" ? "Invalid upload token" : err.message;
    }
  }
  return fallback;
}

export function registerDirectVideoUploadRoutes(app: express.Express, deps: DirectVideoUploadDeps): void {
  app.post("/api/jobs/:jobId/videos/upload-session", (req, res) => {
    void beginSession(req, res, deps, { kind: "job", jobId: req.params.jobId });
  });
  app.post("/api/videos/upload-session", (req, res) => {
    void beginSession(req, res, deps, { kind: "library" });
  });
  app.post("/api/video-uploads/chunk", acceptChunk, (req, res) => {
    void receiveChunk(req, res);
  });
  app.post("/api/jobs/:jobId/videos/complete", (req, res) => {
    void completeUpload(req, res, deps, req.params.jobId);
  });
  app.post("/api/videos/complete", (req, res) => {
    void completeUpload(req, res, deps, null);
  });
}

async function beginSession(
  req: Request,
  res: Response,
  deps: DirectVideoUploadDeps,
  scope: { kind: "job"; jobId: string } | { kind: "library" },
): Promise<void> {
  try {
    const staff = requireStaff(req, res);
    if (!staff) return;

    const originalName = safeOriginalName(typeof req.body?.originalName === "string" ? req.body.originalName : "");
    const described = describeVideoFile(
      originalName,
      typeof req.body?.mimeType === "string" ? req.body.mimeType : "",
    );
    if (!described) {
      fail(res, 400, VIDEO_FILE_TYPE_MESSAGE);
      return;
    }
    const fileSize = parseUploadFileSize(req.body?.fileSize);
    if (fileSize == null) {
      const n = typeof req.body?.fileSize === "number" ? req.body.fileSize : Number(req.body?.fileSize);
      if (n === 0) fail(res, 400, VIDEO_EMPTY_MESSAGE);
      else if (Number.isFinite(n) && n > MAX_VIDEO_UPLOAD_BYTES) fail(res, 413, VIDEO_TOO_BIG_MESSAGE);
      else fail(res, 400, "Could not read the video size.");
      return;
    }

    const videoKind = scope.kind === "library" && req.body?.kind === "knowledge" ? "knowledge" : "job";
    if (videoKind === "knowledge" && !deps.canPublishKnowledge(staff.businessId)) {
      fail(res, 403, "Not authorized to publish knowledge videos.");
      return;
    }

    let jobId: string | null = null;
    let businessId = staff.businessId;
    if (scope.kind === "job") {
      const job = await deps.getJob(scope.jobId);
      if (!job || (job.businessId && job.businessId !== staff.businessId)) {
        fail(res, 404, "Job not found");
        return;
      }
      jobId = job.id;
      businessId = job.businessId || staff.businessId;
    }

    const requestedOrigin = resolveUploadOrigin(req.get("origin"), deps.appUrl);
    const origin = requestedOrigin.startsWith("http://") || requestedOrigin.startsWith("https://")
      ? requestedOrigin
      : webOrigin(deps.appUrl);
    const filename = newVideoObjectFilename(described.extension);
    // CORS is what lets the phone PUT straight at GCS. Failure here is not fatal.
    await ensureVideoBucketCors(origin);
    const sessionUri = await createVideoUploadSession({
      filename,
      mimeType: described.mimeType,
      origin,
    });
    const token = signVideoUploadToken(
      {
        filename,
        mimeType: described.mimeType,
        fileSize,
        originalName,
        jobId,
        businessId,
        employeeId: staff.employeeId,
        kind: videoKind,
        sessionUri,
        origin,
      },
      videoUploadSecret(),
    );
    console.log(`[VIDEO_UPLOAD] session ${filename} ${fileSize} bytes ${described.mimeType}`);
    const completeUrl = jobId ? `/api/jobs/${jobId}/videos/complete` : "/api/videos/complete";
    res.json({
      success: true,
      data: {
        token,
        uploadUrl: sessionUri,
        chunkUrl: "/api/video-uploads/chunk",
        completeUrl,
        mimeType: described.mimeType,
        fileSize,
        directChunkSize: DIRECT_CHUNK_BYTES,
        proxyChunkSize: PROXY_CHUNK_BYTES,
      },
    });
  } catch (err) {
    console.error("[VIDEO_UPLOAD] session failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) fail(res, 500, "Could not start the video upload. Try again.");
  }
}

async function receiveChunk(req: Request, res: Response): Promise<void> {
  try {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const token = req.get("x-upload-token") || "";
    if (!token) {
      fail(res, 400, "Invalid upload token");
      return;
    }
    let intent: VideoUploadIntent;
    try {
      intent = verifyVideoUploadToken(token, videoUploadSecret());
    } catch (err) {
      fail(res, 400, clientMessage(err, "Invalid upload token"));
      return;
    }
    if (intent.employeeId !== staff.employeeId || intent.businessId !== staff.businessId) {
      fail(res, 403, "Unauthorized");
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const parsed = parseChunkRange(req.get("content-range") || "", body.length, intent.fileSize);
    if (!parsed.ok) {
      fail(res, 400, parsed.message);
      return;
    }
    const headers: Record<string, string> = {
      Origin: intent.origin,
      "Content-Range": req.get("content-range") || "",
    };
    if (parsed.range.kind === "part") headers["Content-Type"] = intent.mimeType;
    let result: { status: number; range: string | null };
    try {
      result = await putToGcsSession(intent.sessionUri, headers, body);
    } catch (err) {
      console.error(
        `[VIDEO_UPLOAD] chunk ${intent.filename} forward failed:`,
        err instanceof Error ? err.message : err,
      );
      fail(res, 502, VIDEO_DROPPED_MESSAGE);
      return;
    }
    if (result.status === 200 || result.status === 201 || result.status === 308) {
      res.json({
        success: true,
        data: {
          gcsStatus: result.status,
          range: result.range,
          done: result.status === 200 || result.status === 201,
        },
      });
      return;
    }
    console.error(`[VIDEO_UPLOAD] chunk ${intent.filename} storage status ${result.status}`);
    const retryable = result.status === 408 || result.status === 429 || result.status >= 500 || result.status === 0;
    fail(res, retryable ? 502 : 400, retryable ? VIDEO_DROPPED_MESSAGE : "Storage rejected the upload chunk. Try again.");
  } catch (err) {
    console.error("[VIDEO_UPLOAD] chunk failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) fail(res, 500, "Could not upload that piece of the video. Try again.");
  }
}

async function completeUpload(
  req: Request,
  res: Response,
  deps: DirectVideoUploadDeps,
  jobIdFromRoute: string | null,
): Promise<void> {
  try {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const token = readToken(req);
    let intent: VideoUploadIntent;
    try {
      intent = verifyVideoUploadToken(token, videoUploadSecret());
    } catch (err) {
      fail(res, 400, clientMessage(err, "Invalid upload token"));
      return;
    }
    if (intent.employeeId !== staff.employeeId || intent.businessId !== staff.businessId) {
      fail(res, 403, "Unauthorized");
      return;
    }
    if (jobIdFromRoute) {
      if (intent.jobId !== jobIdFromRoute) {
        fail(res, 403, "Unauthorized");
        return;
      }
    } else if (intent.jobId) {
      fail(res, 400, "Invalid upload token");
      return;
    }
    if (intent.kind === "knowledge" && !deps.canPublishKnowledge(staff.businessId)) {
      fail(res, 403, "Not authorized to publish knowledge videos.");
      return;
    }

    const existing = await deps.findByFilename(intent.filename);
    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const size = await uploadedVideoByteSize(intent.filename);
    if (size !== intent.fileSize) {
      if (size != null) {
        await deps.deleteObject(`/objects/videos/${intent.filename}`);
      }
      fail(res, 409, VIDEO_INCOMPLETE_MESSAGE);
      return;
    }

    const showToCustomer = req.body?.showToCustomer === undefined
      ? true
      : req.body.showToCustomer === true || req.body.showToCustomer === "true";
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";

    let customerId: string | null = null;
    if (intent.jobId) {
      const job = await deps.getJob(intent.jobId);
      if (!job || (job.businessId && job.businessId !== staff.businessId)) {
        fail(res, 404, "Job not found");
        return;
      }
      customerId = job.customerId ?? null;
    }

    let video: Video;
    try {
      video = await deps.createVideo(intent.businessId, {
        kind: intent.kind,
        jobId: intent.jobId,
        customerId,
        url: `/objects/videos/${intent.filename}`,
        filename: intent.filename,
        originalName: intent.originalName,
        mimeType: intent.mimeType,
        fileSize: intent.fileSize,
        title: title || null,
        showToCustomer,
        processingStatus: "ready",
      });
    } catch (err) {
      console.error("[VIDEO_UPLOAD] saving the video row failed:", err instanceof Error ? err.message : err);
      await deps.deleteObject(`/objects/videos/${intent.filename}`);
      fail(res, 500, "The video uploaded, but it could not be saved on the job. Try again.");
      return;
    }

    try {
      await deps.onReady(video, showToCustomer);
    } catch (err) {
      console.error("[VIDEO_UPLOAD] post-upload task failed:", err instanceof Error ? err.message : err);
    }
    console.log(`[VIDEO_UPLOAD] complete ${intent.filename} ${intent.fileSize} bytes`);
    res.json({ success: true, data: video });
  } catch (err) {
    console.error("[VIDEO_UPLOAD] complete failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) fail(res, 500, "Could not finish the video upload. Try again.");
  }
}
