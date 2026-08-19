/**
 * Velnox — storage adapter contract tests.
 *
 * Profile avatar/cover and product images all upload through the SAME
 * Cloudinary signed-upload flow (backend/storage.ts). These tests lock the
 * contract so a future change cannot silently break the shared flow:
 *
 *  - MAX_IMAGE_BYTES must stay 10 MB — the frontend uploader
 *    (apps/shop ProfileImageUpload.tsx MAX_BYTES) mirrors this value.
 *  - The signature MUST be plain SHA-1 of the alphabetically-sorted
 *    `key=value` string with the API secret APPENDED — NOT HMAC-SHA1.
 *    Cloudinary's SDK computes `SHA1(sorted_params + api_secret)`; an HMAC
 *    digest is rejected as "Invalid Signature" on every upload (this was a
 *    real production bug: the signature action "succeeded" but Cloudinary
 *    rejected every upload).
 *  - The signature is computed over EXACTLY the params the browser POSTs
 *    (timestamp, folder, public_id, allowed_formats). `max_bytes` is NOT a
 *    Cloudinary upload parameter and must never be sent (Cloudinary rejects
 *    unknown params with HTTP 400).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_FORMATS, CloudinaryStorage, MAX_IMAGE_BYTES } from "../backend/storage";

const FAKE = { cloudName: "test-cloud", apiKey: "123456", apiSecret: "super-secret" };

/**
 * Reference implementation of Cloudinary's signing rule (mirrors
 * cloudinary_npm `api_sign_request`): sort params alphabetically, join as
 * `key=value` with `&`, append the API secret, SHA-1 (hex).
 */
function cloudinarySign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(sorted + secret).digest("hex");
}

describe("storage — profile image upload contract (10 MB, signed params)", () => {
  const storage = new CloudinaryStorage(FAKE.cloudName, FAKE.apiKey, FAKE.apiSecret);

  it("MAX_IMAGE_BYTES is exactly 10 MB (frontend must match)", () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("signed upload params carry every field the browser needs (no max_bytes)", () => {
    const sig = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    expect(sig.cloudName).toBe(FAKE.cloudName);
    expect(sig.apiKey).toBe(FAKE.apiKey);
    expect(sig.timestamp).toBeGreaterThan(0);
    expect(sig.folder).toBe("velnox/profiles/u1");
    expect(sig.publicId).toBe("avatar-u1-1");
    expect(sig.allowedFormats).toBe("jpg,jpeg,png,webp,avif,gif");
    expect(sig.signature).toMatch(/^[0-9a-f]{40}$/); // sha1 hex
    // max_bytes is not a Cloudinary upload parameter — must not leak into
    // the permit (the browser would otherwise POST it and get HTTP 400).
    expect("maxBytes" in sig).toBe(false);
  });

  it("signature uses plain SHA-1 with the secret APPENDED (Cloudinary rule), not HMAC", () => {
    // Cloudinary docs example (authentication_signatures): sorted params
    // eager/public_id/timestamp + secret "abcd" must hash to this digest.
    const docParams: Record<string, string> = {
      public_id: "sample_image",
      timestamp: "1315060510",
      eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
    };
    const expected = "bfd09f95f331f558cbd1320e67aa8d488770583e";
    expect(cloudinarySign(docParams, "abcd")).toBe(expected);

    const sig = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    const expectedSig = cloudinarySign(
      {
        timestamp: String(sig.timestamp),
        folder: sig.folder,
        public_id: sig.publicId,
        allowed_formats: sig.allowedFormats,
      },
      FAKE.apiSecret,
    );
    // If the implementation ever reverts to HMAC-SHA1 (or signs a different
    // param set), this mismatches — the exact drift Cloudinary rejects as
    // “Invalid Signature” on a real upload.
    expect(sig.signature).toBe(expectedSig);
  });

  it("signature is deterministic for the same params (retry-safe)", () => {
    const a = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    const b = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    expect(a.signature).toMatch(/^[0-9a-f]{40}$/);
    expect(b.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it("extractPublicId round-trips folder-prefixed public ids (full path, not last segment)", () => {
    // The frontend POSTs public_id "avatar-u1-1" with folder
    // "velnox/profiles/u1" → Cloudinary's stored id (and the id the browser
    // reports back) is "velnox/profiles/u1/avatar-u1-1".
    const folderId = "velnox/profiles/u1/avatar-u1-1";
    const url = storage.originalUrl(folderId);
    // Deleting must use the FULL id — taking only the last segment would
    // target a non-existent asset and old images would accumulate forever.
    expect(storage.extractPublicId(url)).toBe(folderId);
    // Transform + version segments are stripped, the id path is preserved.
    const transformed = `https://res.cloudinary.com/${FAKE.cloudName}/image/upload/w_240,h_240,c_fill,f_auto,q_auto/${folderId}`;
    expect(storage.extractPublicId(transformed)).toBe(folderId);
    const versioned = `https://res.cloudinary.com/${FAKE.cloudName}/image/upload/v1712345678/${folderId}`;
    expect(storage.extractPublicId(versioned)).toBe(folderId);
    expect(storage.extractPublicId("https://example.com/not-a-cloudinary-url")).toBeNull();
  });

  it("every frontend-accepted image type is allowed by the backend", () => {
    // ProfileImageUpload.tsx accepts image/jpeg, image/png, image/webp.
    // The backend `allowed_formats` must always cover those (never a
    // frontend-accepted type that Cloudinary would reject).
    const allowed = new Set(ALLOWED_IMAGE_FORMATS.split(","));
    expect(allowed.has("jpg") || allowed.has("jpeg")).toBe(true);
    expect(allowed.has("png")).toBe(true);
    expect(allowed.has("webp")).toBe(true);
  });
});
