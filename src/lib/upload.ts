/**
 * Velnox Client Upload Helpers
 *
 * Client-side image compression + validation only.
 * The actual upload goes through a Convex "use node" action via useAction hook.
 * The browser NEVER touches Cloudinary directly.
 *
 * Flow:
 *   File → Canvas compress → base64 dataUrl → Convex action → Cloudinary → URL
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadType = "profile" | "cover" | "logo" | "banner";

export interface UploadDebug {
  uploadRoute: string;
  step: string;
  mimeType?: string;
  uploadType?: string;
  userId?: string;
  approxSizeMB?: number;
  folder?: string;
  publicId?: string;
  cloudinaryHttpCode?: number;
  secureUrl?: string;
  cloudinaryErrorCode?: unknown;
  cloudinaryErrorMessage?: string;
  [key: string]: unknown;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  debug?: UploadDebug;
  error?: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Image compression
// ---------------------------------------------------------------------------

const MAX_DIMENSION = 1200; // max width/height in pixels
const JPEG_QUALITY = 0.85;

/**
 * Compress and resize an image file to JPEG.
 * Returns a data:mime/type;base64,... URL suitable for Convex action args.
 * Client-side compression keeps the payload well under Convex's 8 MB arg limit.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if needed
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG data URL
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () =>
        reject(new Error("Failed to load image for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Max file size: 10 MB */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Validate a file before upload.
 * Returns an error message string, or null if valid.
 */
export function validateFile(file: File): string | null {
  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
  ]);
  if (!allowedTypes.has(file.type)) {
    return `ไฟล์ประเภท ${file.type} ไม่รองรับ — อนุญาตเฉพาะ JPEG, PNG, WebP, AVIF, GIF`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "ไฟล์มีขนาดใหญ่เกิน 10 MB";
  }
  return null;
}
