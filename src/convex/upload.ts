import { httpAction } from "./_generated/server";

/**
 * Velnox server-side image upload handler.
 *
 * Flow:  browser  →  this Convex HTTP action  →  Cloudinary REST API
 * The browser NEVER talks to Cloudinary directly.  No Cloudinary SDK is
 * used — the upload goes through a plain `fetch()` POST so we avoid
 * Node.js built-in module issues with the Convex bundler.
 *
 * Cloudinary signature:  SHA-1( sorted_params + api_secret )
 * Computed via the Web Crypto API (available in all Convex runtimes).
 */

// ── Cloudinary signature (Web Crypto, no Node builtins) ──────────────
async function computeSignature(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const data = new TextEncoder().encode(sorted + apiSecret);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /upload/image
 *
 * Multipart form data:
 *   - file  : the image binary
 *   - kind  : "avatar" | "cover"
 *
 * Auth: Convex Auth JWT (sent via Authorization header by useAuthToken).
 */
export const uploadProfileImage = httpAction(async (ctx, request) => {
  // ── 1. Authentication ──────────────────────────────────────────────
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return Response.json(
      { error: "กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพ" },
      { status: 401 },
    );
  }
  const userId = identity.subject;

  // ── 2. Parse form data ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "ไม่สามารถอ่านข้อมูลไฟล์ได้" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "ไม่พบไฟล์ที่อัปโหลด กรุณาลองใหม่อีกครั้ง" },
      { status: 400 },
    );
  }
  if (kind !== "avatar" && kind !== "cover") {
    return Response.json(
      { error: "ประเภทภาพไม่ถูกต้อง ต้องเป็น avatar หรือ cover" },
      { status: 400 },
    );
  }

  // ── 3. Validate file type ──────────────────────────────────────────
  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json(
      {
        error:
          "รูปภาพไม่รองรับ กรุณาเลือก JPG, PNG, WebP, AVIF หรือ GIF",
      },
      { status: 415 },
    );
  }

  // ── 4. Validate file size ──────────────────────────────────────────
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "ไฟล์มีขนาดใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง" },
      { status: 413 },
    );
  }

  // ── 5. Cloudinary config (server-side only — secret never exposed) ─
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json(
      { error: "ระบบอัปโหลดรูปยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" },
      { status: 500 },
    );
  }

  // ── 6. Prepare Cloudinary upload ───────────────────────────────────
  //    Stable public IDs + overwrite = old image is replaced, no manual
  //    deletion needed.
  const timestamp = Math.floor(Date.now() / 1000);
  const folder =
    kind === "avatar"
      ? `velnox/profiles/${userId}`
      : `velnox/covers/${userId}`;
  const publicId = kind === "avatar" ? "avatar" : "cover";

  // Sign: SHA-1( sorted_params + api_secret )
  const signParams: Record<string, string> = {
    timestamp: String(timestamp),
    folder,
    public_id: publicId,
  };
  const signature = await computeSignature(signParams, apiSecret);

  // ── 7. Upload to Cloudinary via REST API ───────────────────────────
  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", folder);
  uploadForm.append("public_id", publicId);
  uploadForm.append("signature", signature);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm },
    );

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
      console.error("[Upload] Cloudinary error:", msg);
      return Response.json(
        {
          error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
          detail: msg, // safe — no secrets
        },
        { status: 500 },
      );
    }

    const data = (await res.json()) as { secure_url: string };
    return Response.json({ url: data.secure_url }, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Network error during upload";
    console.error("[Upload] Fetch error:", message);
    return Response.json(
      {
        error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        detail: message,
      },
      { status: 500 },
    );
  }
});
