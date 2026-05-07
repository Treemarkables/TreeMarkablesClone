// Simple photo storage service for Replit Object Storage
// Reference: javascript_object_storage integration

import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { Response } from "express";
import heicConvert from "heic-convert";
import sharp from "sharp";

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

export type PhotoLabel = "BEFORE" | "AFTER";

async function burnLabel(buffer: Buffer, label: PhotoLabel): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 1200;
  const fontSize = Math.max(24, Math.round(w / 28));
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.3);
  const letterSpacing = 2;
  const boxW = Math.round(
    label.length * fontSize * 0.72 + (label.length - 1) * letterSpacing + padX * 2,
  );
  const boxH = Math.round(fontSize + padY * 2);
  const offset = Math.round(fontSize * 0.5);
  const strokeW = Math.max(3, Math.round(fontSize / 16));
  const inset = strokeW / 2;
  const svg = `<svg width="${boxW}" height="${boxH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${inset}" y="${inset}" width="${boxW - strokeW}" height="${boxH - strokeW}" rx="${Math.round((boxH - strokeW) / 2)}" fill="#39FF14" stroke="black" stroke-width="${strokeW}"/>
    <text x="${padX}" y="${Math.round(fontSize + padY * 0.7)}" font-family="Inter, Arial, sans-serif"
          font-size="${fontSize}" font-weight="800" fill="black" letter-spacing="${letterSpacing}">${label}</text>
  </svg>`;
  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: offset, left: offset }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// Stitch two images into a vertical 9:16 BEFORE-on-top / AFTER-on-bottom JPEG
// sized for mobile Facebook feed posts. Each photo cover-fits its half, a thin
// neon-green band divides them, and a black branding strip with "TREEMARKABLES
// • GISBORNE TREE CARE" sits at the foot. HEIC/HEIF inputs become JPEG first.
export async function composeBeforeAfter(
  beforeInput: { buffer: Buffer; mimeType: string; filename: string },
  afterInput: { buffer: Buffer; mimeType: string; filename: string },
): Promise<Buffer> {
  const toJpegBuffer = async (input: { buffer: Buffer; mimeType: string; filename: string }) => {
    const ext = input.filename.split(".").pop()?.toLowerCase() || "";
    const isHeic =
      ext === "heic" ||
      ext === "heif" ||
      input.mimeType === "image/heic" ||
      input.mimeType === "image/heif";
    if (!isHeic) return input.buffer;
    const jpeg = await heicConvert({ buffer: input.buffer, format: "JPEG", quality: 0.85 });
    return Buffer.from(jpeg);
  };

  const [beforeJpeg, afterJpeg] = await Promise.all([toJpegBuffer(beforeInput), toJpegBuffer(afterInput)]);

  const targetW = 1080;
  const targetH = 1920;
  const dividerH = 8;
  const footerH = 90;
  const halfH = Math.floor((targetH - dividerH - footerH) / 2);

  // Resize first, then burn the labels onto the cropped halves — burning before
  // the cover-fit resize means the label corner gets cropped away whenever the
  // source aspect ratio doesn't match the half's aspect ratio.
  const [topResized, bottomResized] = await Promise.all([
    sharp(beforeJpeg)
      .resize({ width: targetW, height: halfH, fit: "cover", position: "centre" })
      .toBuffer(),
    sharp(afterJpeg)
      .resize({ width: targetW, height: halfH, fit: "cover", position: "centre" })
      .toBuffer(),
  ]);
  const [topBuf, bottomBuf] = await Promise.all([
    burnLabel(topResized, "BEFORE"),
    burnLabel(bottomResized, "AFTER"),
  ]);

  const footerFontSize = 34;
  const footerSvg = `<svg width="${targetW}" height="${footerH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${targetW}" height="${footerH}" fill="black"/>
    <text x="${targetW / 2}" y="${Math.round(footerH / 2 + footerFontSize / 3)}" font-family="Inter, Arial, sans-serif"
          font-size="${footerFontSize}" font-weight="700" letter-spacing="4" fill="#39FF14" text-anchor="middle">TREEMARKABLES &#8226; GISBORNE TREE CARE</text>
  </svg>`;
  const footerBuf = await sharp(Buffer.from(footerSvg)).png().toBuffer();

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 3,
      background: { r: 0x39, g: 0xff, b: 0x14 },
    },
  })
    .composite([
      { input: topBuf, left: 0, top: 0 },
      { input: bottomBuf, left: 0, top: halfH + dividerH },
      { input: footerBuf, left: 0, top: halfH * 2 + dividerH },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

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

  async uploadPhoto(fileBuffer: Buffer, originalFilename: string, mimeType: string, opts?: { label?: PhotoLabel }): Promise<{ url: string; thumbnailUrl: string }> {
    const privateDir = this.getPrivateObjectDir();
    const timestamp = Date.now();
    let extension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
    let processedBuffer = fileBuffer;
    let finalMimeType = mimeType;

    // Convert HEIC/HEIF to JPEG during upload for universal compatibility
    if (extension === 'heic' || extension === 'heif' || mimeType === 'image/heic' || mimeType === 'image/heif') {
      console.log(`🔄 Converting HEIC to JPEG during upload: ${originalFilename}`);
      try {
        const jpegBuffer = await heicConvert({
          buffer: fileBuffer,
          format: 'JPEG',
          quality: 0.8
        });

        processedBuffer = Buffer.from(jpegBuffer);
        extension = 'jpg';
        finalMimeType = 'image/jpeg';
        console.log(`✅ Converted HEIC to JPEG: ${originalFilename} → .jpg`);
      } catch (conversionError) {
        console.error(`❌ HEIC conversion failed for ${originalFilename}, using original:`, conversionError);
        // Keep original if conversion fails
      }
    }

    // Burn Before/After label after HEIC conversion so it lands in both the saved
    // original and the thumbnail (which is generated from processedBuffer below).
    if (opts?.label) {
      try {
        processedBuffer = await burnLabel(processedBuffer, opts.label);
        extension = 'jpg';
        finalMimeType = 'image/jpeg';
        console.log(`🏷️  Burned ${opts.label} label onto ${originalFilename}`);
      } catch (labelError) {
        console.error(`❌ Label burn failed for ${originalFilename}, uploading without label:`, labelError);
      }
    }

    const uniqueFilename = `${timestamp}_${randomUUID()}.${extension}`;
    const bucket = objectStorageClient.bucket(this.parseObjectPath(privateDir).bucketName);

    // Upload original/full-size image
    const fullPath = `${privateDir}/photos/${uniqueFilename}`;
    const fullFile = bucket.file(this.parseObjectPath(fullPath).objectName);
    
    await fullFile.save(processedBuffer, {
      metadata: {
        contentType: finalMimeType,
      },
    });

    // Generate and upload thumbnail (600px wide WebP, quality 45 for mobile performance with good visual quality)
    const thumbnailFilename = `thumb_${uniqueFilename.replace(/\.(jpg|jpeg|png)$/i, '.webp')}`;
    const thumbnailPath = `${privateDir}/photos/${thumbnailFilename}`;
    const thumbnailFile = bucket.file(this.parseObjectPath(thumbnailPath).objectName);
    
    try {
      const thumbnailBuffer = await sharp(processedBuffer)
        .resize(600, 600, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ quality: 45 })
        .toBuffer();
      
      await thumbnailFile.save(thumbnailBuffer, {
        metadata: {
          contentType: 'image/webp',
        },
      });
      
      console.log(`✅ Generated thumbnail: ${thumbnailFilename} (${(thumbnailBuffer.length / 1024).toFixed(0)}KB)`);
      
      return {
        url: `/objects/photos/${uniqueFilename}`,
        thumbnailUrl: `/objects/photos/${thumbnailFilename}`
      };
    } catch (thumbnailError) {
      console.error(`❌ Thumbnail generation failed for ${originalFilename}, using original:`, thumbnailError);
      // Fallback to original if thumbnail fails
      return {
        url: `/objects/photos/${uniqueFilename}`,
        thumbnailUrl: `/objects/photos/${uniqueFilename}`
      };
    }
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

  async downloadPhotoBuffer(photoPath: string): Promise<{ buffer: Buffer; contentType: string; exists: boolean } | null> {
    const { file, exists } = await this.getPhoto(photoPath);
    
    if (!exists || !file) {
      return null;
    }

    try {
      const [metadata] = await file.getMetadata();
      const [fileBuffer] = await file.download();
      
      return {
        buffer: fileBuffer,
        contentType: metadata.contentType || 'application/octet-stream',
        exists: true
      };
    } catch (error) {
      console.error('Error downloading photo buffer:', error);
      return null;
    }
  }

  async downloadPhoto(photoPath: string, res: Response): Promise<void> {
    const filename = photoPath.replace("/objects/photos/", "");
    const isThumbnailRequest = filename.startsWith('thumb_');
    
    // If thumbnail requested but doesn't exist, generate it from original
    if (isThumbnailRequest) {
      const { file: thumbFile, exists: thumbExists } = await this.getPhoto(photoPath);
      
      if (!thumbExists) {
        // Generate thumbnail from original - try all common extensions
        // API generates thumbnails as: /objects/photos/name.ext → /objects/photos/thumb_name.webp
        // Reverse: thumb_name.webp → name → try name.jpg, name.jpeg, etc.
        // Preserves multi-dot filenames: thumb_tree.photo.final.webp → tree.photo.final → tree.photo.final.jpg
        const baseFilename = filename.replace(/^thumb_/, '').replace(/\.[^.]+$/i, '');
        const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.JPG', '.JPEG', '.PNG', '.WEBP', '.HEIC', '.HEIF'];
        
        let originalFile = null;
        let originalExists = false;
        let foundOriginalPath = '';
        
        for (const ext of possibleExtensions) {
          const originalPath = `/objects/photos/${baseFilename}${ext}`;
          const result = await this.getPhoto(originalPath);
          if (result.exists) {
            originalFile = result.file;
            originalExists = true;
            foundOriginalPath = originalPath;
            break;
          }
        }
        
        if (originalExists && originalFile) {
          try {
            const [originalBuffer] = await originalFile.download();
            
            // Generate thumbnail (600px, quality 45 for mobile performance with good visual quality)
            const thumbnailBuffer = await sharp(originalBuffer)
              .resize(600, 600, { 
                fit: 'inside',
                withoutEnlargement: true 
              })
              .webp({ quality: 45 })
              .toBuffer();
            
            // Save thumbnail for future requests
            const privateDir = this.getPrivateObjectDir();
            const { bucketName } = this.parseObjectPath(privateDir);
            const bucket = objectStorageClient.bucket(bucketName);
            const thumbObjectName = this.parseObjectPath(`${privateDir}/photos/${filename}`).objectName;
            const thumbFileRef = bucket.file(thumbObjectName);
            
            await thumbFileRef.save(thumbnailBuffer, {
              metadata: { contentType: 'image/webp' }
            });
            
            console.log(`✅ Generated on-the-fly thumbnail: ${filename} from ${foundOriginalPath} (${(thumbnailBuffer.length / 1024).toFixed(0)}KB)`);
            
            // Serve the generated thumbnail
            res.set({
              "Content-Type": "image/webp",
              "Content-Length": thumbnailBuffer.length.toString(),
              "Cache-Control": "public, max-age=31536000",
            });
            res.send(thumbnailBuffer);
            return;
          } catch (thumbError) {
            console.error(`❌ Thumbnail generation failed for ${filename}:`, thumbError);
            // Fall back to serving original if thumbnail generation fails
            console.log(`📸 Falling back to original: ${foundOriginalPath}`);
            return this.downloadPhoto(foundOriginalPath, res);
          }
        } else {
          // No original found with any extension - fall back to trying without thumbnail prefix
          console.log(`⚠️ No original found for thumbnail ${filename}, attempting to serve as-is`);
          // This will likely 404, but preserves existing behavior
        }
      }
    }
    
    const { file, exists } = await this.getPhoto(photoPath);
    
    if (!exists || !file) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    try {
      const [metadata] = await file.getMetadata();
      const isHeic = photoPath.toLowerCase().endsWith('.heic') || 
                     photoPath.toLowerCase().endsWith('.heif') ||
                     metadata.contentType === 'image/heic' || 
                     metadata.contentType === 'image/heif';

      // If HEIC, convert to JPEG on-the-fly
      if (isHeic) {
        console.log('🔄 Converting HEIC to JPEG on-the-fly:', photoPath);
        
        // Download the file to buffer
        const [fileBuffer] = await file.download();
        
        try {
          // Convert HEIC to JPEG
          const jpegBuffer = await heicConvert({
            buffer: fileBuffer,
            format: 'JPEG',
            quality: 0.9
          });

          // Optimize with sharp
          const optimizedBuffer = await sharp(Buffer.from(jpegBuffer))
            .jpeg({ quality: 90, progressive: true })
            .toBuffer();

          res.set({
            "Content-Type": "image/jpeg",
            "Content-Length": optimizedBuffer.length.toString(),
            "Cache-Control": "public, max-age=31536000",
          });

          res.send(optimizedBuffer);
          console.log('✅ HEIC converted and served as JPEG');
        } catch (conversionError) {
          console.error('❌ HEIC conversion failed:', conversionError);
          // Fall back to serving original file
          res.set({
            "Content-Type": metadata.contentType || "image/jpeg",
            "Content-Length": metadata.size,
            "Cache-Control": "public, max-age=31536000",
          });
          const stream = file.createReadStream();
          stream.pipe(res);
        }
      } else {
        // Serve non-HEIC files normally
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
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async regenerateAllThumbnails(): Promise<{ total: number; regenerated: number; errors: string[] }> {
    const privateDir = this.getPrivateObjectDir();
    const { bucketName } = this.parseObjectPath(privateDir);
    const bucket = objectStorageClient.bucket(bucketName);
    
    const [files] = await bucket.getFiles({ prefix: this.parseObjectPath(`${privateDir}/photos/`).objectName });
    
    const originalFiles = files.filter(file => 
      !file.name.includes('thumb_') && 
      (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png') || file.name.endsWith('.webp'))
    );
    
    let regenerated = 0;
    const errors: string[] = [];
    
    console.log(`🔄 Starting thumbnail regeneration for ${originalFiles.length} photos...`);
    
    for (const file of originalFiles) {
      try {
        const [fileBuffer] = await file.download();
        const filename = file.name.split('/').pop() || '';
        const thumbnailFilename = `thumb_${filename.replace(/\.(jpg|jpeg|png)$/i, '.webp')}`;
        
        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(600, 600, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .webp({ quality: 45 })
          .toBuffer();
        
        const thumbnailFile = bucket.file(this.parseObjectPath(`${privateDir}/photos/${thumbnailFilename}`).objectName);
        await thumbnailFile.save(thumbnailBuffer, {
          metadata: { contentType: 'image/webp' }
        });
        
        regenerated++;
        console.log(`✅ Regenerated: ${thumbnailFilename} (${(thumbnailBuffer.length / 1024).toFixed(0)}KB)`);
      } catch (error) {
        const errorMsg = `Failed to regenerate thumbnail for ${file.name}: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
    
    console.log(`🎉 Thumbnail regeneration complete: ${regenerated}/${originalFiles.length} successful`);
    
    return {
      total: originalFiles.length,
      regenerated,
      errors
    };
  }
}
