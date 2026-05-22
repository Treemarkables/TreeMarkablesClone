// Video storage service backed by Google Cloud Storage.
// Native replacement for Loom: staff upload a video, it lands in the same GCS
// bucket as photos (under a `videos/` prefix), and a `videos` DB row stores the
// metadata + object path. Playback streams back through GET /objects/videos/:filename.
//
// Reuses the GCS client + credential handling from photoStorage.ts so there's a
// single object-storage client for the process.

import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import type { StorageEngine } from "multer";
import { objectStorageClient } from "./photoStorage";

function getPrivateObjectDir(): string {
  // Trim defends against accidental whitespace from bulk env-var pastes (matches photoStorage).
  const dir = (process.env.PRIVATE_OBJECT_DIR || "").trim();
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  return dir;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}

// Multer storage engine that streams the uploaded multipart file part directly
// into a GCS object, chunk by chunk — the whole video never sits in server RAM,
// so large files don't risk OOM on a small instance. The fields returned to
// multer land on `req.file` (path = serving URL, filename, size).
class GcsVideoStorageEngine implements StorageEngine {
  _handleFile(
    _req: Request,
    file: Express.Multer.File & { stream: NodeJS.ReadableStream },
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    try {
      const privateDir = getPrivateObjectDir();
      const extension = (file.originalname.split(".").pop() || "mp4").toLowerCase();
      const uniqueFilename = `${Date.now()}_${randomUUID()}.${extension}`;
      const fullPath = `${privateDir}/videos/${uniqueFilename}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const gcsFile = objectStorageClient.bucket(bucketName).file(objectName);

      let bytes = 0;
      const writeStream = gcsFile.createWriteStream({
        resumable: false,
        metadata: { contentType: file.mimetype || "video/mp4" },
      });

      file.stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
      });
      file.stream.on("error", (err: Error) => writeStream.destroy(err));
      writeStream.on("error", (err: Error) => cb(err));
      writeStream.on("finish", () =>
        cb(null, {
          path: `/objects/videos/${uniqueFilename}`,
          filename: uniqueFilename,
          size: bytes,
        }),
      );

      file.stream.pipe(writeStream);
    } catch (err) {
      cb(err);
    }
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ): void {
    // Called by multer to clean up if a later middleware errors. file.path is
    // the serving URL we returned above.
    if (!file.path) {
      cb(null);
      return;
    }
    videoStorage.deleteVideoObject(file.path).finally(() => cb(null));
  }
}

// Factory for a multer storage engine that streams video uploads to GCS.
export function createVideoUploadEngine(): StorageEngine {
  return new GcsVideoStorageEngine();
}

export class VideoStorageService {
  private getFile(videoPath: string) {
    const filename = videoPath.replace("/objects/videos/", "");
    const privateDir = getPrivateObjectDir();
    const { bucketName, objectName } = parseObjectPath(`${privateDir}/videos/${filename}`);
    return objectStorageClient.bucket(bucketName).file(objectName);
  }

  // Stream a video to the response, honoring HTTP Range requests so the browser
  // <video> player can seek/scrub (it requests byte ranges and expects 206).
  async streamVideo(videoPath: string, req: Request, res: Response): Promise<void> {
    const file = this.getFile(videoPath);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    const totalSize = Number(metadata.size || 0);
    const contentType = metadata.contentType || "video/mp4";
    const rangeHeader = req.headers.range;

    if (rangeHeader && totalSize > 0) {
      // Parse "bytes=start-end"
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      let start = match && match[1] ? parseInt(match[1], 10) : 0;
      let end = match && match[2] ? parseInt(match[2], 10) : totalSize - 1;

      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= totalSize) end = totalSize - 1;

      if (start > end) {
        res.status(416).set("Content-Range", `bytes */${totalSize}`).end();
        return;
      }

      res.status(206).set({
        "Content-Type": contentType,
        // inline → browsers play the URL in-page instead of downloading it.
        "Content-Disposition": "inline",
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "private, max-age=31536000",
      });

      const stream = file.createReadStream({ start, end });
      stream.on("error", (err: Error) => {
        console.error("Video range stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming video" });
        else res.destroy();
      });
      stream.pipe(res);
      return;
    }

    // No range header — stream the whole file but advertise range support.
    res.status(200).set({
      "Content-Type": contentType,
      // inline → browsers play the URL in-page instead of downloading it.
      "Content-Disposition": "inline",
      "Content-Length": String(totalSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000",
    });
    const stream = file.createReadStream();
    stream.on("error", (err: Error) => {
      console.error("Video stream error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Error streaming video" });
      else res.destroy();
    });
    stream.pipe(res);
  }

  // Delete the underlying object (best-effort; used when a video row is removed).
  async deleteVideoObject(videoPath: string): Promise<void> {
    try {
      await this.getFile(videoPath).delete({ ignoreNotFound: true });
    } catch (err) {
      console.error("Failed to delete video object:", err);
    }
  }
}

export const videoStorage = new VideoStorageService();
