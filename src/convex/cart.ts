// ---------------------------------------------------------------------------
// Cart — guest (session) and signed-in cart operations
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Get current user's cart items */
export const list = query({
  args: {
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    let items;
    if (userId) {
      items = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    } else if (args.sessionId) {
      items = await ctx.db
        .query("cartItems")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
    } else {
      return [];
    }

    // Enrich with product data
    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const variant = item.variantId
          ? await ctx.db.get(item.variantId)
          : null;
        const seller = product
          ? await ctx.db.get(product.sellerId)
          : null;

        return {
          ...item,
          productName: product?.name ?? "Unknown",
          productSlug: product?.slug ?? "",
          productImage: product?.images[0] ?? null,
          variantName: variant?.name ?? null,
          unitPrice: variant?.price ?? product?.price ?? 0,
          sellerName: seller?.storeName ?? "Unknown",
          sellerId: product?.sellerId ?? null,
          inStock: product
            ? product.stock - product.reserved >= item.quantity
            : false,
          maxQuantity: product
            ? product.stock - product.reserved
            : 0,
        };
      }),
    );

    return enriched.filter((e) => e.productName !== "Unknown");
  },
});

/** Add an item to the cart */
export const add = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.id("variants")),
    quantity: v.number(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Check stock
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.stock - product.reserved < args.quantity) {
      throw new Error("Insufficient stock");
    }

    // Find existing cart item
    let existing = null;
    if (userId) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      existing = items.find(
        (i) =>
          i.productId === args.productId &&
          i.variantId === (args.variantId ?? undefined),
      );
    } else if (args.sessionId) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      existing = items.find(
        (i) =>
          i.productId === args.productId &&
          i.variantId === (args.variantId ?? undefined),
      );
    }

    if (existing) {
      const newQty = existing.quantity + args.quantity;
      if (product.stock - product.reserved < newQty) {
        throw new Error("Insufficient stock");
      }
      await ctx.db.patch(existing._id, {
        quantity: newQty,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("cartItems", {
      userId: userId ?? undefined,
      sessionId: userId ? undefined : args.sessionId,
      productId: args.productId,
      variantId: args.variantId,
      quantity: args.quantity,
      updatedAt: Date.now(),
    });
  },
});

/** Update quantity of a cart item */
export const updateQuantity = mutation({
  args: {
    cartItemId: v.id("cartItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.cartItemId);
    if (!item) throw new Error("Cart item not found");

    const product = await ctx.db.get(item.productId);
    if (!product) throw new Error("Product not found");

    if (args.quantity <= 0) {
      await ctx.db.delete(args.cartItemId);
      return;
    }

    if (product.stock - product.reserved < args.quantity) {
      throw new Error("Insufficient stock");
    }

    await ctx.db.patch(args.cartItemId, {
      quantity: args.quantity,
      updatedAt: Date.now(),
    });
  },
});

/** Remove a cart item */
export const remove = mutation({
  args: { cartItemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.cartItemId);
  },
});

/** Clear all cart items for a user or session */
export const clear = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    let items;
    if (userId) {
      items = await ctx.db
        .query("cartItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    } else if (args.sessionId) {
      items = await ctx.db
        .query("cartItems")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
    } else {
      return;
    }

    for (const item of items) {
      await ctx.db.delete(item._id);
    }
  },
});

/** Merge guest cart into user cart on sign-in */
export const mergeGuestCart = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const guestItems = await ctx.db
      .query("cartItems")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const userItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const guest of guestItems) {
      const existing = userItems.find(
        (u) =>
          u.productId === guest.productId &&
          u.variantId === guest.variantId,
      );

      if (existing) {
        await ctx.db.patch(existing._id, {
          quantity: existing.quantity + guest.quantity,
          updatedAt: Date.now(),
        });
        await ctx.db.delete(guest._id);
      } else {
        await ctx.db.patch(guest._id, {
          userId,
          sessionId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});
