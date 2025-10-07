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

  async uploadPhoto(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<{ url: string; thumbnailUrl: string }> {
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
