// Photo storage service backed by Google Cloud Storage.
// Two credential paths, picked at startup based on env:
//   1. GOOGLE_APPLICATION_CREDENTIALS_JSON set → direct service-account auth (used on DO)
//   2. otherwise → Replit Object Storage sidecar at 127.0.0.1:1106 (used on Replit)
// The Replit fallback is removed in Phase 5 of the DO migration once Replit is gone.

import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { Response } from "express";
import heicConvert from "heic-convert";
import sharp from "sharp";
import { contrastRatio, readableOn } from "./emailTemplates";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function createObjectStorageClient(): Storage {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credsJson) {
    const credentials = JSON.parse(credsJson);
    console.log(`📦 GCS client: direct service-account credentials (project: ${credentials.project_id})`);
    return new Storage({
      credentials,
      projectId: credentials.project_id,
    });
  }
  console.log(`📦 GCS client: Replit Object Storage sidecar at ${REPLIT_SIDECAR_ENDPOINT}`);
  return new Storage({
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
}

export const objectStorageClient = createObjectStorageClient();

export type PhotoLabel = "BEFORE" | "AFTER";

async function burnLabel(
  buffer: Buffer,
  label: PhotoLabel,
  opts?: { topInset?: number; accentColor?: string },
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 1200;
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
  const badgeFill = opts?.accentColor || "#39FF14";
  const badgeText = readableOn(badgeFill);
  const svg = `<svg width="${boxW}" height="${boxH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${inset}" y="${inset}" width="${boxW - strokeW}" height="${boxH - strokeW}" rx="${Math.round((boxH - strokeW) / 2)}" fill="${badgeFill}" stroke="black" stroke-width="${strokeW}"/>
    <text x="${padX}" y="${Math.round(fontSize + padY * 0.7)}" font-family="Inter, Arial, sans-serif"
          font-size="${fontSize}" font-weight="800" fill="${badgeText}" letter-spacing="${letterSpacing}">${label}</text>
  </svg>`;
  // Keep the badge clear of the left edge so it isn't clipped by FB ad / Reels
  // safe zones — ~4% of frame width sits inside the recommended margin.
  const left = Math.max(offset, Math.round(w * 0.04));
  const top = Math.min(Math.max(offset, opts?.topInset ?? offset), Math.max(offset, h - boxH - offset));
  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top, left }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// Branding burned into the before/after composite. All optional: colours fall
// back to the default black/neon palette (matching business_settings column
// defaults), and a blank footerText drops the branding strip entirely so an
// unbranded tenant shows nothing rather than another business's identity.
export interface BeforeAfterBranding {
  footerText?: string;   // wordmark strip at the foot, e.g. "TREEMARKABLES • GISBORNE TREE CARE"
  accentColor?: string;  // divider band + BEFORE/AFTER badge fill
  headerColor?: string;  // footer strip background
}

const escapeXml = (s: string): string =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );

// Stitch two images into a vertical 9:16 BEFORE-on-top / AFTER-on-bottom JPEG
// sized for mobile Facebook feed posts. Each photo cover-fits its half, a thin
// accent-coloured band divides them, and the tenant's wordmark strip sits at
// the foot. HEIC/HEIF inputs become JPEG first.
export async function composeBeforeAfter(
  beforeInput: { buffer: Buffer; mimeType: string; filename: string },
  afterInput: { buffer: Buffer; mimeType: string; filename: string },
  branding?: BeforeAfterBranding,
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

  const accent = branding?.accentColor || "#39FF14";
  const footerBg = branding?.headerColor || "#0b0b0b";
  const footerText = (branding?.footerText || "").trim();

  const targetW = 1080;
  const targetH = 1920;
  const dividerH = 8;
  const footerH = footerText ? 90 : 0;
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
  // The BEFORE half sits at the very top of the 9:16 frame, which Facebook /
  // Instagram Reels covers with the iOS status bar + Reels header overlay
  // (~12% of frame height). Push BEFORE down into the safe zone, and mirror
  // the same top inset on AFTER so both badges sit at the same vertical
  // position inside their respective halves.
  const labelTopInset = Math.round(targetH * 0.12);
  const [topBuf, bottomBuf] = await Promise.all([
    burnLabel(topResized, "BEFORE", { topInset: labelTopInset, accentColor: accent }),
    burnLabel(bottomResized, "AFTER", { topInset: labelTopInset, accentColor: accent }),
  ]);

  const composites: sharp.OverlayOptions[] = [
    { input: topBuf, left: 0, top: 0 },
    { input: bottomBuf, left: 0, top: halfH + dividerH },
  ];

  if (footerText) {
    // Wordmark in the accent when it stands out against the strip; if a tenant
    // sets header ≈ accent, fall back to readable mono so the name never vanishes.
    const footerTextColor =
      contrastRatio(accent, footerBg) >= 2.5 ? accent : readableOn(footerBg);
    // Shrink the wordmark for long names so it never overflows the strip
    // (~0.62em average glyph width + the 4px letter-spacing per character).
    const footerFontSize = Math.max(
      18,
      Math.min(34, Math.floor(((targetW - 64) / footerText.length - 4) / 0.62)),
    );
    const footerSvg = `<svg width="${targetW}" height="${footerH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${targetW}" height="${footerH}" fill="${footerBg}"/>
    <text x="${targetW / 2}" y="${Math.round(footerH / 2 + footerFontSize / 3)}" font-family="Inter, Arial, sans-serif"
          font-size="${footerFontSize}" font-weight="700" letter-spacing="4" fill="${footerTextColor}" text-anchor="middle">${escapeXml(footerText)}</text>
  </svg>`;
    const footerBuf = await sharp(Buffer.from(footerSvg)).png().toBuffer();
    composites.push({ input: footerBuf, left: 0, top: halfH * 2 + dividerH });
  }

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 3,
      background: accent,
    },
  })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}

export class PhotoStorageService {
  private getPrivateObjectDir(): string {
    // Trim defends against accidental whitespace from bulk env-var pastes —
    // we got bitten by a trailing space on DO during Phase 2 soak.
    const dir = (process.env.PRIVATE_OBJECT_DIR || "").trim();
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

  // Store an arbitrary document (e.g. a supplier-invoice PDF) verbatim in GCS,
  // without the image/thumbnail pipeline (sharp would choke on a PDF). Served
  // back via the same /objects/photos/ route, which streams with the stored
  // contentType so browsers render the PDF inline.
  async uploadDocument(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<{ url: string }> {
    const privateDir = this.getPrivateObjectDir();
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueFilename = `${timestamp}_${randomUUID()}.${extension}`;

    const bucket = objectStorageClient.bucket(this.parseObjectPath(privateDir).bucketName);
    const fullPath = `${privateDir}/photos/${uniqueFilename}`;
    const fullFile = bucket.file(this.parseObjectPath(fullPath).objectName);

    await fullFile.save(fileBuffer, {
      metadata: {
        contentType: mimeType || 'application/octet-stream',
      },
    });

    return { url: `/objects/photos/${uniqueFilename}` };
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
              "Cache-Control": "private, max-age=31536000",
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
            "Cache-Control": "private, max-age=31536000",
          });

          res.send(optimizedBuffer);
          console.log('✅ HEIC converted and served as JPEG');
        } catch (conversionError) {
          console.error('❌ HEIC conversion failed:', conversionError);
          // Fall back to serving original file
          res.set({
            "Content-Type": metadata.contentType || "image/jpeg",
            "Content-Length": metadata.size,
            "Cache-Control": "private, max-age=31536000",
          });
          const stream = file.createReadStream();
          stream.pipe(res);
        }
      } else {
        // Serve non-HEIC files normally. Because uploads historically accepted
        // any content-type, a stored text/html or image/svg+xml would otherwise
        // execute inline on the app's own origin (stored XSS). Neutralise the
        // script-capable types (coerce to octet-stream + force download) and
        // always send nosniff so a benign declared type can't be sniffed into
        // active content. Images/PDF/etc. still render inline as before.
        const stored = (metadata.contentType || "image/jpeg").toLowerCase();
        const dangerous = [
          "text/html", "application/xhtml+xml", "image/svg+xml",
          "application/xml", "text/xml", "text/javascript", "application/javascript",
        ];
        const isDangerous = dangerous.some((t) => stored.startsWith(t));
        res.set({
          "Content-Type": isDangerous ? "application/octet-stream" : (metadata.contentType || "image/jpeg"),
          "Content-Length": metadata.size,
          "Cache-Control": "private, max-age=31536000",
          "X-Content-Type-Options": "nosniff",
          ...(isDangerous ? { "Content-Disposition": "attachment" } : {}),
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
