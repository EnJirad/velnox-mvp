import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";
import { verifyStripeSignatureWeb } from "../backend/stripeVerify";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Health endpoint for uptime / load-balancer checks (spec §53).
 *
 * GET <convex-url>/health → { "status": "ok" }
 *
 * Always responds 200 when the deployment is reachable; no DB call so a
 * database outage does not make the health check flap before real traffic
 * probes surface it.
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_ctx, _request) =>
    new Response(JSON.stringify({ status: "ok", service: "velnox-convex" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }),
  ),
});

/**
 * Server-side Cloudinary upload for profile images (avatar + cover).
 *
 * POST <convex-url>/cloudinary/upload-profile
 * Content-Type: multipart/form-data
 * Body fields:
 *   - file: the image file (jpg/png/webp)
 *   - uploadType: "avatar" | "cover"
 *
 * This replaces the old browser→Cloudinary direct upload which failed on
 * mobile browsers due to CORS preflight / carrier proxy interference.
 *
 * New flow:
 *   Browser → Convex HTTP → Cloudinary (server-side, no CORS) → Neon DB
 *
 * Security:
 *   - Authentication is enforced via Convex Auth cookies (ctx.runAction propagates auth)
 *   - Cloudinary credentials NEVER reach the browser
 *   - File type + size are validated both client-side AND server-side
 *   - The authenticated user's ID determines the storage folder (never from client)
 */
http.route({
  path: "/cloudinary/upload-profile",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
      const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];

      // 1. Parse multipart form data
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return json_response(
          { success: false, code: "INVALID_FORM_DATA", message: "ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่อีกครั้ง" },
          400,
        );
      }

      const file = formData.get("file");
      const uploadType = formData.get("uploadType");

      if (!file || !(file instanceof File)) {
        return json_response(
          { success: false, code: "MISSING_FILE", message: "กรุณาเลือกรูปภาพ" },
          400,
        );
      }

      const kind = uploadType === "cover" ? "cover" : "avatar";

      // 2. Validate file type
      const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
        return json_response(
          {
            success: false,
            code: "INVALID_FILE_TYPE",
            message: `รูปแบบไฟล์ไม่รองรับ (รองรับ: JPG, PNG, WebP)`,
          },
          400,
        );
      }

      // 3. Validate file size
      if (file.size > MAX_FILE_BYTES) {
        return json_response(
          {
            success: false,
            code: "FILE_TOO_LARGE",
            message: "ไฟล์มีขนาดใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง",
          },
          400,
        );
      }

      // 4. Get signed upload permit from the backend (auth + rate limit enforced)
      let sig;
      try {
        sig = await ctx.runAction(api.customer.getProfileImageUploadSignature, { kind });
      } catch (err) {
        console.error("[cloudinary/upload-profile] Signature request failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("not configured") || msg.includes("storage")) {
          return json_response(
            { success: false, code: "STORAGE_NOT_CONFIGURED", message: "ระบบอัปโหลดรูปยังไม่พร้อมใช้งาน" },
            503,
          );
        }
        if (msg.includes("Rate limit") || msg.includes("rate limit")) {
          return json_response(
            { success: false, code: "RATE_LIMITED", message: "อัปโหลดรูปบ่อยเกินไป กรุณารอสักครู่" },
            429,
          );
        }
        if (msg.includes("not authenticated") || msg.includes("auth") || msg.includes("identity")) {
          return json_response(
            { success: false, code: "AUTH_REQUIRED", message: "กรุณาเข้าสู่ระบบก่อนอัปโหลดรูป" },
            401,
          );
        }
        return json_response(
          { success: false, code: "SIGNATURE_FAILED", message: "ไม่สามารถเตรียมการอัปโหลดได้ กรุณาลองอีกครั้ง" },
          500,
        );
      }

      if (
        !sig ||
        !sig.cloudName ||
        !sig.apiKey ||
        !sig.timestamp ||
        !sig.folder ||
        !sig.publicId ||
        !sig.signature ||
        !sig.allowedFormats
      ) {
        console.error("[cloudinary/upload-profile] Incomplete signature:", sig);
        return json_response(
          { success: false, code: "INCOMPLETE_SIGNATURE", message: "ระบบอัปโหลดไม่พร้อม กรุณาลองใหม่" },
          500,
        );
      }

      // 5. Upload to Cloudinary server-side (no CORS — server to server)
      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append("file", file);
      cloudinaryFormData.append("api_key", sig.apiKey);
      cloudinaryFormData.append("timestamp", String(sig.timestamp));
      cloudinaryFormData.append("folder", sig.folder);
      cloudinaryFormData.append("public_id", sig.publicId);
      cloudinaryFormData.append("signature", sig.signature);
      cloudinaryFormData.append("allowed_formats", sig.allowedFormats);

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

      let cloudinaryResponse: Response;
      try {
        cloudinaryResponse = await fetch(cloudinaryUrl, {
          method: "POST",
          body: cloudinaryFormData,
          // Do NOT set Content-Type — the runtime generates the multipart boundary automatically
        });
      } catch (err) {
        console.error("[cloudinary/upload-profile] Cloudinary fetch failed:", err);
        return json_response(
          {
            success: false,
            code: "CLOUDINARY_NETWORK_ERROR",
            message: "ไม่สามารถเชื่อมต่อระบบอัปโหลดได้ กรุณาลองใหม่อีกครั้ง",
          },
          502,
        );
      }

      if (!cloudinaryResponse.ok) {
        const body = await cloudinaryResponse.text().catch(() => "");
        console.error("[cloudinary/upload-profile] Cloudinary error:", {
          status: cloudinaryResponse.status,
          body: body.slice(0, 500),
        });
        return json_response(
          {
            success: false,
            code: "CLOUDINARY_ERROR",
            message: `อัปโหลดไม่สำเร็จ (HTTP ${cloudinaryResponse.status})`,
          },
          502,
        );
      }

      let uploaded;
      try {
        uploaded = await cloudinaryResponse.json();
      } catch {
        console.error("[cloudinary/upload-profile] Failed to parse Cloudinary response");
        return json_response(
          { success: false, code: "CLOUDINARY_PARSE_ERROR", message: "ไม่สามารถประมวลผลผลลัพธ์ได้" },
          502,
        );
      }

      if (!uploaded.public_id) {
        console.error("[cloudinary/upload-profile] Cloudinary 200 without public_id:", uploaded);
        return json_response(
          { success: false, code: "CLOUDINARY_MISSING_ID", message: "อัปโหลดไม่สมบูรณ์ กรุณาลองใหม่" },
          502,
        );
      }

      // 6. Save to Neon DB via the existing action (auth + validation + old image cleanup)
      let profile;
      try {
        profile = await ctx.runAction(api.customer.saveProfileImage, {
          kind,
          publicId: uploaded.public_id,
          format: uploaded.format,
          bytes: uploaded.bytes,
          width: uploaded.width,
          height: uploaded.height,
        });
      } catch (err) {
        console.error("[cloudinary/upload-profile] DB save failed:", err);
        // The image was uploaded to Cloudinary but DB save failed.
        // Return the Cloudinary URL so the frontend can at least show the image.
        // The orphan will be cleaned up later.
        return json_response(
          {
            success: false,
            code: "DATABASE_ERROR",
            message: "อัปโหลดรูปสำเร็จ แต่ไม่สามารถบันทึกโปรไฟล์ได้ กรุณาลองอีกครั้ง",
          },
          500,
        );
      }

      // 7. Return success
      return json_response(
        {
          success: true,
          profile: {
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            avatarUrl: profile.avatarUrl,
            coverUrl: profile.coverUrl,
            memberSince: profile.memberSince,
          },
        },
        200,
      );
    } catch (err) {
      console.error("[cloudinary/upload-profile] Unexpected error:", err);
      return json_response(
        { success: false, code: "UPLOAD_FAILED", message: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง" },
        500,
      );
    }
  }),
});

/**
 * Stripe webhook (Phase 14): payment confirmations for the "online" method.
 *
 * POST <convex-url>/stripe/webhook
 *
 * Signature verification runs HERE (edge runtime, Web Crypto — the Stripe
 * SDK needs node:crypto which edge functions cannot import); the verified
 * event is forwarded to the "use node" action `api.stripe.handleStripeEvent`
 * which applies the idempotent + amount-checked payment confirmation.
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      return new Response(JSON.stringify({ error: "missing signature or webhook secret" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawBody = await request.text();
    let event;
    try {
      event = await verifyStripeSignatureWeb(rawBody, signature, secret);
    } catch (err) {
      console.error("[stripe] webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await ctx.runAction(api.stripe.handleStripeEvent, {
        type: event.type,
        object: event.data.object,
      });
    } catch (err) {
      // State-change failure → 500 so Stripe retries the delivery.
      console.error("[stripe] webhook processing failed:", err);
      return new Response(JSON.stringify({ error: "processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function json_response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default http;
