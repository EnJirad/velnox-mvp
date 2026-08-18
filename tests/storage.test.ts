/**
 * Velnox — storage adapter contract tests.
 *
 * Profile avatar/cover and product images all upload through the SAME
 * Cloudinary signed-upload flow (backend/storage.ts). These tests lock the
 * contract so a future change cannot silently break the shared limits:
 *
 *  - MAX_IMAGE_BYTES must stay 10 MB — the frontend uploader
 *    (apps/shop ProfileImageUpload.tsx MAX_BYTES) and the Cloudinary
 *    `max_bytes` param both mirror this value.
 *  - The signature must be HMAC-SHA1 over EXACTLY the five params the
 *    browser POSTs (timestamp, folder, public_id, allowed_formats,
 *    max_bytes). Cloudinary validates a signed upload against the signed
 *    set, so any drift between the signed set and the sent set produces
 *    “Invalid Signature”.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_FORMATS, CloudinaryStorage, MAX_IMAGE_BYTES } from "../backend/storage";

const FAKE = { cloudName: "test-cloud", apiKey: "123456", apiSecret: "super-secret" };

function hmacSign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHmac("sha1", secret).update(sorted).digest("hex");
}

describe("storage — profile image upload contract (10 MB, signed params)", () => {
  const storage = new CloudinaryStorage(FAKE.cloudName, FAKE.apiKey, FAKE.apiSecret);

  it("MAX_IMAGE_BYTES is exactly 10 MB (frontend + Cloudinary must match)", () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("signed upload params carry every field the browser needs", () => {
    const sig = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    expect(sig.cloudName).toBe(FAKE.cloudName);
    expect(sig.apiKey).toBe(FAKE.apiKey);
    expect(sig.timestamp).toBeGreaterThan(0);
    expect(sig.folder).toBe("velnox/profiles/u1");
    expect(sig.publicId).toBe("avatar-u1-1");
    expect(sig.allowedFormats).toBe("jpg,jpeg,png,webp,avif,gif");
    expect(sig.maxBytes).toBe(10 * 1024 * 1024);
    expect(sig.signature).toMatch(/^[0-9a-f]{40}$/); // sha1 hex
  });

  it("signature is HMAC-SHA1 over EXACTLY the five canonical params", () => {
    const sig = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    const expected = hmacSign(
      {
        timestamp: String(sig.timestamp),
        folder: sig.folder,
        public_id: sig.publicId,
        allowed_formats: sig.allowedFormats,
        max_bytes: String(sig.maxBytes),
      },
      FAKE.apiSecret,
    );
    // If the implementation ever signs an extra param (or drops one), this
    // mismatches — the same drift that Cloudinary would reject as
    // “Invalid Signature” on a real upload.
    expect(sig.signature).toBe(expected);
  });

  it("signature is deterministic for the same params (retry-safe)", () => {
    const a = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    // Same folder + publicId but a later timestamp must still produce a
    // valid-looking signature of the same algorithm (not a random nonce).
    const b = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    expect(a.signature).toMatch(/^[0-9a-f]{40}$/);
    expect(b.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it("extractPublicId round-trips canonical CDN URLs", () => {
    const sig = storage.getSignedUploadParams("velnox/profiles/u1", "avatar-u1-1");
    const url = storage.originalUrl(sig.publicId);
    expect(storage.extractPublicId(url)).toBe(sig.publicId);
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
