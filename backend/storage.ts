/**
 * Velnox Storage Adapter
 *
 * Business logic never talks to a storage vendor directly — it goes through
 * the StorageProvider interface so the provider (Cloudinary today, R2/S3
 * tomorrow) can be swapped without touching the product system.
 *
 * Cloudinary flow (marketplace-grade, no binary bytes through our server):
 *
 *   VelSeller -> getProductImageUploadSignature()  (Convex node action)
 *             -> direct POST to Cloudinary (browser, signed params)
 *             -> saveProductImage()  (Convex node action: re-validate +
 *                                     persist metadata in Neon product_images)
 *
 * Signing is done here with HMAC-SHA1 (same algorithm as the official SDK),
 * so no extra dependency is required.
 *
 * Required env vars (Convex deployment env, set via `npx convex env set` or
 * the project Keys/API keys UI):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
import { createHmac } from "node:crypto";

export const ALLOWED_IMAGE_FORMATS = "jpg,jpeg,png,webp,avif,gif";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  allowedFormats: string;
  maxBytes: number;
}

export interface StoredFileInfo {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  format: string;
  bytes: number;
}

export interface StorageProvider {
  readonly name: string;
  /** Server-side params the browser needs to upload directly to the vendor. */
  getSignedUploadParams(folder: string, publicId: string): UploadSignature;
  /** Delete a binary from storage (called only after ownership checks). */
  deleteFile(publicId: string): Promise<void>;
  /** Original secure CDN URL for a public id. */
  originalUrl(publicId: string): string;
  /** Transform helpers — CDN derivatives (thumbnail / display). */
  thumbUrl(publicId: string): string;
  displayUrl(publicId: string): string;
  /** Derive the storage key from an existing URL (for legacy rows). */
  extractPublicId(url: string): string | null;
}

function sha1Sign(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHmac("sha1", apiSecret).update(sorted).digest("hex");
}

export class CloudinaryStorage implements StorageProvider {
  readonly name = "cloudinary";
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private get baseUrl() {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}`;
  }

  getSignedUploadParams(folder: string, publicId: string): UploadSignature {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      timestamp: String(timestamp),
      folder,
      public_id: publicId,
      allowed_formats: ALLOWED_IMAGE_FORMATS,
      max_bytes: String(MAX_IMAGE_BYTES),
    };
    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      folder,
      publicId,
      signature: sha1Sign(params, this.apiSecret),
      allowedFormats: ALLOWED_IMAGE_FORMATS,
      maxBytes: MAX_IMAGE_BYTES,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      timestamp: String(timestamp),
      public_id: publicId,
    };
    const signature = sha1Sign(params, this.apiSecret);
    const body = new URLSearchParams({
      public_id: publicId,
      api_key: this.apiKey,
      timestamp: String(timestamp),
      signature,
    });
    const res = await fetch(`${this.baseUrl}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { result?: string };
    if (data.result !== "ok") {
      throw new Error(`Cloudinary delete failed for ${publicId}`);
    }
  }

  private secureUrl(publicId: string, transform?: string): string {
    const base = `https://res.cloudinary.com/${this.cloudName}/image/upload`;
    if (!transform) return `${base}/${publicId}`;
    return `${base}/${transform}/${publicId}`;
  }

  originalUrl(publicId: string): string {
    return this.secureUrl(publicId);
  }

  thumbUrl(publicId: string): string {
    return this.secureUrl(publicId, "w_240,h_240,c_fill,f_auto,q_auto");
  }

  displayUrl(publicId: string): string {
    return this.secureUrl(publicId, "w_900,c_limit,f_auto,q_auto");
  }

  extractPublicId(url: string): string | null {
    const marker = `/image/upload/`;
    const idx = url.lastIndexOf(marker);
    if (idx === -1) return null;
    // strip any transformation segment
    const raw = url.slice(idx + marker.length).split("?")[0];
    const parts = raw.split("/");
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : null;
  }
}

let cached: StorageProvider | null = null;

/** Get the configured storage provider (server-side only). */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Image storage is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and " +
        "CLOUDINARY_API_SECRET in the project Keys/API keys UI (Convex deployment env).",
    );
  }
  cached = new CloudinaryStorage(cloudName, apiKey, apiSecret);
  return cached;
}

/** True when Cloudinary env vars are present (used for graceful fallbacks). */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}
