// Simple photo storage service for Replit Object Storage
// Reference: javascript_object_storage integration

import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { Response } from "express";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class PhotoStorageService {
  private getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    return dir;
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
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

  async uploadPhoto(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<string> {
    const privateDir = this.getPrivateObjectDir();
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop() || 'jpg';
    const uniqueFilename = `${timestamp}_${randomUUID()}.${extension}`;
    const fullPath = `${privateDir}/photos/${uniqueFilename}`;

    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
      },
    });

    return `/objects/photos/${uniqueFilename}`;
  }

  async getPhoto(photoPath: string): Promise<{ file: any; exists: boolean }> {
    if (!photoPath.startsWith("/objects/photos/")) {
      return { file: null, exists: false };
    }

    const filename = photoPath.replace("/objects/photos/", "");
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/photos/${filename}`;

    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();

    return { file, exists };
  }

  async downloadPhoto(photoPath: string, res: Response): Promise<void> {
    const { file, exists } = await this.getPhoto(photoPath);
    
    if (!exists || !file) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    try {
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "image/jpeg",
        "Content-Length": metadata.size,
        "Cache-Control": "public, max-age=31536000",
      });

      const stream = file.createReadStream();
      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
}
