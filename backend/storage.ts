/**
 * Velnox Storage Adapter
 *
 * Business logic never talks to a storage vendor directly — it goes through
 * the StorageProvider interface so the provider (Cloudinary today, R2/S3
 * tomorrow) can be swapped without touching the product system.
 *
 * Cloudinary flow (marketplace-grade, no binary bytes through our server):
 *
 * VelShop -> getProfileImageUploadSignature() (Convex node action)
 * -> direct POST to Cloudinary (browser, signed params)
 * -> saveProfileImage() (Convex node action: re-validate +
 * persist URL metadata in Neon users)
 *
 * Signing is done here with plain SHA-1 over the alphabetically-sorted
 * `key=value` parameter string with the API secret APPENDED — exactly what
 * Cloudinary's own SDK does (api_sign_request). Do NOT switch this to
 * HMAC-SHA1: Cloudinary verifies `SHA1(sorted_params + api_secret)`, so an
 * HMAC digest is rejected as "Invalid Signature" on every upload.
 *
 * Required env vars (Convex deployment env, set via `npx convex env set` or
 * the project Keys/API keys UI):
 * CLOUDINARY_CLOUD_NAME
 * CLOUDINARY_API_KEY
 * CLOUDINARY_API_SECRET
 */
import { createHash } from "node:crypto";
export const ALLOWED_IMAGE_FORMATS = "jpg,jpeg,png,webp,avif,gif";
/** Max bytes accepted by the backend re-validation (frontend mirrors this).
 *  NOTE: this is NOT sent to Cloudinary — `max_bytes` is not an Upload API
 *  parameter and Cloudinary rejects unknown params with HTTP 400. The limit
 *  is enforced client-side + server-side in saveProfileImage. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  allowedFormats: string;
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
/**
 * Cloudinary upload/delete signature: sort params alphabetically, join as
 * `key=value` pairs with `&`, append the API secret, then SHA-1 the whole
 * string (hex). Matches cloudinary_npm `api_sign_request` byte-for-byte —
 * verified against the example digest in Cloudinary's own docs.
 */
function sha1Sign(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(sorted + apiSecret).digest("hex");
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
    // Exactly the params the browser will POST (minus file/api_key/signature,
    // which Cloudinary excludes from signing). If a param is added here it
    // MUST also be sent by the frontend, and vice versa — any drift yields
    // "Invalid Signature".
    const params: Record<string, string> = {
      timestamp: String(timestamp),
      folder,
      public_id: publicId,
      allowed_formats: ALLOWED_IMAGE_FORMATS,
    };
    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      folder,
      publicId,
      signature: sha1Sign(params, this.apiSecret),
      allowedFormats: ALLOWED_IMAGE_FORMATS,
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
  /**
   * Derive the full Cloudinary public id (including any folder prefix) from a
   * delivery URL: everything after `/image/upload/`, minus an optional
   * leading transform or version segment. The full id is what `destroy`
   * needs — taking only the last path segment would target a non-existent
   * asset whenever the id lives in a folder (e.g. velnox/profiles/<id>/...).
   */
  extractPublicId(url: string): string | null {
    const marker = "/image/upload/";
    const idx = url.lastIndexOf(marker);
    if (idx === -1) return null;
    const rest = url.slice(idx + marker.length).split("?")[0];
    if (!rest) return null;
    const segments = rest.split("/");
    const first = segments[0];
    // Transform segment looks like "w_240,h_240,c_fill,f_auto,q_auto";
    // version segment looks like "v1234567890". Neither is part of the id.
    if (first && (first.includes(",") || /^v\d+$/.test(first))) segments.shift();
    const publicId = segments.join("/");
    return publicId ? decodeURIComponent(publicId) : null;
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
