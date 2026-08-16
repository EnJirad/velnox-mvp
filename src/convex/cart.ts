import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { availableStock, requireUser } from "./lib";

/**
 * Resolve the current cart owner: a signed-in user wins over the guest
 * session id.
 */
const resolveOwner = async (ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject as Id<"users"> | undefined;
};

export const getCart = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const userId = await resolveOwner(ctx);
    const raw = userId
      ? await ctx.db
          .query("cartItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : sessionId
        ? await ctx.db
            .query("cartItems")
            .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
            .collect()
        : [];
    const items = [];
    let totalMinor = 0;
    for (const item of raw) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;
      const variant = item.variantId
        ? await ctx.db.get(item.variantId)
        : undefined;
      const unitPrice = variant?.price ?? product.price;
      const subtotal = unitPrice * item.quantity;
      totalMinor += subtotal;
      items.push({
        id: item._id,
        productId: product._id,
        variantId: item.variantId ?? undefined,
        name: product.name,
        variantName: variant?.name,
        image: product.images[0],
        unitPrice,
        quantity: item.quantity,
        subtotal,
        available: availableStock(variant ?? product),
      });
    }
    return {
      items,
      totalMinor,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  },
});

export const addToCart = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.id("variants")),
    quantity: v.number(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { productId, variantId, quantity, sessionId }) => {
    if (quantity <= 0) throw new Error("Quantity must be positive.");
    const userId = await resolveOwner(ctx);
    const product = await ctx.db.get(productId);
    if (!product || product.status !== "ACTIVE") {
      throw new Error("This product is no longer available.");
    }
    const variant = variantId ? await ctx.db.get(variantId) : undefined;
    if (variantId && !variant) throw new Error("Variant not found.");
    const stockDoc = variant ?? product;
    const available = availableStock(stockDoc);
    if (quantity > available) {
      throw new Error(`Only ${available} left in stock.`);
    }
    const mine = (
      userId
        ? await ctx.db
            .query("cartItems")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        : sessionId
          ? await ctx.db
              .query("cartItems")
              .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
              .collect()
          : []
    ).find(
      (item) =>
        item.productId === productId && item.variantId === variantId,
    );
    if (mine) {
      await ctx.db.patch(mine._id, {
        quantity: Math.min(mine.quantity + quantity, available),
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("cartItems", {
      userId: userId ?? undefined,
      sessionId: userId ? undefined : sessionId,
      productId,
      variantId,
      quantity,
      updatedAt: Date.now(),
    });
  },
});

export const updateCartItem = mutation({
  args: {
    cartItemId: v.id("cartItems"),
    quantity: v.number(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { cartItemId, quantity, sessionId }) => {
    const userId = await resolveOwner(ctx);
    const item = await ctx.db.get(cartItemId);
    if (!item) return;
    const owns =
      (userId !== undefined && item.userId === userId) ||
      (userId === undefined && item.sessionId === sessionId);
    if (!owns) throw new Error("Cart item not found.");
    if (quantity <= 0) {
      await ctx.db.delete(cartItemId);
      return;
    }
    const product = await ctx.db.get(item.productId);
    if (!product) return;
    const variant = item.variantId ? await ctx.db.get(item.variantId) : undefined;
    const available = availableStock(variant ?? product);
    await ctx.db.patch(cartItemId, {
      quantity: Math.min(quantity, available),
      updatedAt: Date.now(),
    });
  },
});

export const removeCartItem = mutation({
  args: {
    cartItemId: v.id("cartItems"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { cartItemId, sessionId }) => {
    const userId = await resolveOwner(ctx);
    const item = await ctx.db.get(cartItemId);
    if (!item) return;
    const owns =
      (userId !== undefined && item.userId === userId) ||
      (userId === undefined && item.sessionId === sessionId);
    if (!owns) throw new Error("Cart item not found.");
    await ctx.db.delete(cartItemId);
  },
});

export const clearCart = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const userId = await resolveOwner(ctx);
    const items = userId
      ? await ctx.db
          .query("cartItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : sessionId
        ? await ctx.db
            .query("cartItems")
            .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
            .collect()
        : [];
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
  },
});

export const mergeGuestCart = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    if (!sessionId) return;
    const guestItems = await ctx.db
      .query("cartItems")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const userItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const guestItem of guestItems) {
      const product = await ctx.db.get(guestItem.productId);
      if (!product || product.status !== "ACTIVE") {
        await ctx.db.delete(guestItem._id);
        continue;
      }
      const variant = guestItem.variantId
        ? await ctx.db.get(guestItem.variantId)
        : undefined;
      const available = availableStock(variant ?? product);
      const match = userItems.find(
        (item) =>
          item.productId === guestItem.productId &&
          item.variantId === guestItem.variantId,
      );
      if (match) {
        await ctx.db.patch(match._id, {
          quantity: Math.min(match.quantity + guestItem.quantity, available),
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("cartItems", {
          userId: user._id,
          productId: guestItem.productId,
          variantId: guestItem.variantId,
          quantity: Math.min(guestItem.quantity, available),
          updatedAt: Date.now(),
        });
      }
      await ctx.db.delete(guestItem._id);
    }
  },
});
