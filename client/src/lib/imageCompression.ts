// Client-side image compression utility
// Compresses images before upload to dramatically reduce upload time

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    mimeType = 'image/jpeg'
  } = options;

  // Skip compression for small files (< 200KB)
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return reject(new Error('Could not get canvas context'));
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Set canvas size and draw image
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas to Blob conversion failed'));
          }

          // Create new file with compressed data
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'),
            {
              type: mimeType,
              lastModified: Date.now(),
            }
          );

          const originalSize = (file.size / 1024).toFixed(0);
          const compressedSize = (compressedFile.size / 1024).toFixed(0);
          console.log(`📉 Compressed ${file.name}: ${originalSize}KB → ${compressedSize}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);

          resolve(compressedFile);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImages(
  files: FileList | File[],
  options?: CompressionOptions
): Promise<File[]> {
  const filesArray = Array.from(files);
  const compressionPromises = filesArray.map(file => 
    compressImage(file, options).catch(err => {
      console.error(`Failed to compress ${file.name}:`, err);
      return file; // Return original if compression fails
    })
  );
  
  return Promise.all(compressionPromises);
}
