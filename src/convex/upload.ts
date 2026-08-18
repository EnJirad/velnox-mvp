"use node";

/**
 * Velnox Image Upload — Server-side Cloudinary SDK upload.
 *
 * Architecture:
 *   Browser → Convex Action ("use node") → Cloudinary SDK → secure_url → DB
 *
 * The browser NEVER touches Cloudinary directly.
 * Environment variables required (set in Convex dashboard → Settings → Environment Variables):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v2 as cloudinary } from "cloudinary";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const uploadImage = action({
  args: {
    /** data:mime/type;base64,<encoded> — client must compress before sending */
    dataUrl: v.string(),
    /** "profile" | "cover" | "logo" | "banner" */
    uploadType: v.string(),
  },
  handler: async (ctx, args) => {
    const debug: Record<string, unknown> = {
      uploadRoute: "SERVER",
      step: "VALIDATE",
    };

    try {
      // ── 1. Authentication ────────────────────────────────────────────────
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("คุณต้องเข้าสู่ระบบก่อน");
      }
      const userId = identity.subject;

      // ── 2. Parse data URL ────────────────────────────────────────────────
      const dataUrlMatch = args.dataUrl.match(
        /^data:([^;]+);base64,(.+)$/,
      );
      if (!dataUrlMatch) {
        throw new ConvexError("รูปแบบข้อมูลรูปภาพไม่ถูกต้อง");
      }
      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];

      debug.mimeType = mimeType;
      debug.uploadType = args.uploadType;
      debug.userId = userId;

      // ── 3. Validate MIME type ────────────────────────────────────────────
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new ConvexError(
          `ไฟล์ประเภท ${mimeType} ไม่รองรับ — อนุญาตเฉพาะ JPEG, PNG, WebP, AVIF, GIF`,
        );
      }

      // ── 4. Validate size ─────────────────────────────────────────────────
      // Approximate decoded size from base64 length
      const approxSizeBytes = Math.ceil((base64Data.length * 3) / 4);
      debug.approxSizeMB = +(approxSizeBytes / (1024 * 1024)).toFixed(2);
      if (approxSizeBytes > MAX_SIZE_BYTES) {
        throw new ConvexError("ไฟล์มีขนาดใหญ่เกิน 10 MB");
      }

      // ── 5. Determine Cloudinary path ─────────────────────────────────────
      let folder: string;
      let publicId: string;

      switch (args.uploadType) {
        case "profile": {
          folder = `velnox/profiles/${userId}`;
          publicId = "avatar";
          break;
        }
        case "cover": {
          folder = `velnox/covers/${userId}`;
          publicId = "cover";
          break;
        }
        case "logo": {
          const seller = await ctx.runQuery(api.sellers.mySeller);
          if (!seller) {
            throw new ConvexError("คุณไม่มีร้านค้าที่เชื่อมต่อ");
          }
          folder = `velnox/sellers/${seller._id}/logo`;
          publicId = "logo";
          break;
        }
        case "banner": {
          const seller = await ctx.runQuery(api.sellers.mySeller);
          if (!seller) {
            throw new ConvexError("คุณไม่มีร้านค้าที่เชื่อมต่อ");
          }
          folder = `velnox/sellers/${seller._id}/banner`;
          publicId = "banner";
          break;
        }
        default:
          throw new ConvexError("ประเภทการอัปโหลดไม่ถูกต้อง");
      }

      debug.step = "CLOUDINARY_SERVER_UPLOAD";
      debug.folder = folder;
      debug.publicId = publicId;

      // ── 6. Upload to Cloudinary via SDK ──────────────────────────────────
      const result = await cloudinary.uploader.upload(args.dataUrl, {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      debug.cloudinaryHttpCode = 200;
      debug.secureUrl = result.secure_url;

      if (!result.secure_url) {
        throw new ConvexError("Cloudinary ไม่ได้ส่ง URL กลับมา");
      }

      // ── 7. Save URL to database ONLY AFTER Cloudinary success ────────────
      debug.step = "SAVE_DATABASE";

      switch (args.uploadType) {
        case "profile":
          await ctx.runMutation(api.users.updateProfileImage, {
            imageUrl: result.secure_url,
          });
          break;
        case "cover":
          await ctx.runMutation(api.users.updateCoverImage, {
            imageUrl: result.secure_url,
          });
          break;
        case "logo":
          await ctx.runMutation(api.sellers.updateStoreLogo, {
            logoUrl: result.secure_url,
          });
          break;
        case "banner":
          await ctx.runMutation(api.sellers.updateStoreBanner, {
            bannerUrl: result.secure_url,
          });
          break;
      }

      debug.step = "DONE";

      // Return plain object (this is a Convex action, not an HTTP action)
      return {
        success: true,
        url: result.secure_url,
        debug,
      };
    } catch (error: unknown) {
      // ── Error handling ───────────────────────────────────────────────────
      debug.step = "ERROR";

      // If it's already a ConvexError, re-throw it
      if (error instanceof ConvexError) {
        throw error;
      }

      const err = error as {
        http_code?: number;
        message?: string;
        name?: string;
        error?: { message?: string; http_code?: number };
      };

      debug.cloudinaryErrorCode = err.error?.http_code ?? err.http_code ?? "UNKNOWN";
      debug.cloudinaryErrorMessage =
        err.error?.message ?? err.message ?? String(error);

      throw new ConvexError(
        `Cloudinary upload failed: ${debug.cloudinaryErrorMessage}`,
      );
    }
  },
});
