import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
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

/**
 * Update the signed-in user's profile: name, phone, avatar (image URL) and cover image URL.
 * Image URLs are Cloudinary secure URLs produced by the server-side upload handler
 * (src/convex/upload.ts). Pass `null` to remove an image, or omit to leave unchanged.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.union(v.string(), v.null())), // Cloudinary URL
    coverImage: v.optional(v.union(v.string(), v.null())), // Cloudinary URL
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

    // Image URLs come from the server-side upload handler (Cloudinary).
    if (args.image !== undefined) {
      patch.image = args.image ?? undefined;
    }

    if (args.coverImage !== undefined) {
      patch.coverImage = args.coverImage ?? undefined;
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

