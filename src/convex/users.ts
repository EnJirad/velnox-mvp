import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/** Allowed image types for profile avatar / cover uploads. */
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/** Server-side guard: reject non-image files or oversized uploads before they are stored on the user. */
async function assertValidImage(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (metadata === null) {
    throw new Error("ไม่พบไฟล์ที่อัปโหลด กรุณาลองใหม่อีกครั้ง");
  }
  if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType ?? "")) {
    throw new Error("รูปภาพไม่รองรับ กรุณาเลือก JPG, PNG หรือ WebP");
  }
  if ((metadata.size ?? 0) > MAX_IMAGE_SIZE) {
    throw new Error("ไฟล์มีขนาดใหญ่เกินไป กรุณาเลือกรูปที่มีขนาดเล็กลง");
  }
}

/**
 * Generate a one-time upload URL for profile images (avatar / cover).
 * The client POSTs the file to this URL and receives a storageId to pass to `updateProfile`.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพ");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update the signed-in user's profile: name, phone, avatar (image) and cover image.
 * Pass `null` to remove an image, or omit a field to leave it unchanged.
 * Replaced images are deleted from storage.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.union(v.id("_storage"), v.null())), // profile avatar
    coverImage: v.optional(v.union(v.id("_storage"), v.null())), // cover photo
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("ไม่พบผู้ใช้");
    }

    const patch: {
      name?: string;
      phone?: string;
      image?: string;
      coverImage?: string;
    } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) {
        throw new Error("กรุณากรอกชื่อ");
      }
      if (name.length > 60) {
        throw new Error("ชื่อยาวเกินไป (สูงสุด 60 ตัวอักษร)");
      }
      patch.name = name;
    }

    if (args.phone !== undefined) {
      const phone = args.phone.trim();
      if (phone.length > 30) {
        throw new Error("เบอร์โทรศัพท์ยาวเกินไป");
      }
      patch.phone = phone;
    }

    if (args.image !== undefined) {
      if (args.image !== null) {
        await assertValidImage(ctx, args.image);
        patch.image = args.image;
      } else {
        patch.image = undefined; // removes the avatar field
      }
      // replacing / removing the avatar: delete the old file from storage
      if (user.image && user.image !== args.image) {
        await ctx.storage.delete(user.image as Id<"_storage">);
      }
    }

    if (args.coverImage !== undefined) {
      if (args.coverImage !== null) {
        await assertValidImage(ctx, args.coverImage);
        patch.coverImage = args.coverImage;
      } else {
        patch.coverImage = undefined; // removes the cover field
      }
      if (user.coverImage && user.coverImage !== args.coverImage) {
        await ctx.storage.delete(user.coverImage as Id<"_storage">);
      }
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});
