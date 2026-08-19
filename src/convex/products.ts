// ---------------------------------------------------------------------------
// Products — public catalog queries and seller product management
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Public catalog
// ---------------------------------------------------------------------------

/** List active products with optional search and category filter */
export const list = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    sellerId: v.optional(v.id("sellers")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"));

    const products = await q.collect();

    let filtered = products;

    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s),
      );
    }

    if (args.categoryId) {
      filtered = filtered.filter((p) => p.categoryId === args.categoryId);
    }

    if (args.sellerId) {
      filtered = filtered.filter((p) => p.sellerId === args.sellerId);
    }

    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    // Attach first image and seller info
    const results = await Promise.all(
      filtered.map(async (p) => {
        const seller = await ctx.db.get(p.sellerId);
        return {
          ...p,
          sellerName: seller?.storeName ?? "Unknown",
          sellerSlug: seller?.storeSlug ?? "",
          imageUrl: p.images[0] ?? null,
        };
      }),
    );

    return results;
  },
});

/** Get a single product by ID */
export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.status !== "ACTIVE") return null;

    const seller = await ctx.db.get(product.sellerId);
    const category = product.categoryId
      ? await ctx.db.get(product.categoryId)
      : null;

    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    return {
      ...product,
      seller: seller
        ? { name: seller.storeName, slug: seller.storeSlug, logo: seller.logo }
        : null,
      category: category ? { name: category.name, slug: category.slug } : null,
      variants,
    };
  },
});

/** Get a single product by slug */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!product || product.status !== "ACTIVE") return null;

    const seller = await ctx.db.get(product.sellerId);
    const category = product.categoryId
      ? await ctx.db.get(product.categoryId)
      : null;

    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    return {
      ...product,
      seller: seller
        ? { name: seller.storeName, slug: seller.storeSlug, logo: seller.logo }
        : null,
      category: category ? { name: category.name, slug: category.slug } : null,
      variants,
    };
  },
});

/** List categories */
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Seller product management
// ---------------------------------------------------------------------------

/** List products for a seller (any status) */
export const listBySeller = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();
  },
});

/** Create a product (seller only, must be APPROVED) */
export const create = mutation({
  args: {
    sellerId: v.id("sellers"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    sku: v.optional(v.string()),
    stock: v.number(),
    images: v.array(v.string()),
    weight: v.optional(v.number()),
    shippingInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const seller = await ctx.db.get(args.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");
    if (seller.status !== "APPROVED")
      throw new Error("Seller not approved");

    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const now = Date.now();
    const productId = await ctx.db.insert("products", {
      sellerId: args.sellerId,
      categoryId: args.categoryId,
      name: args.name,
      slug,
      description: args.description,
      price: args.price,
      sku: args.sku,
      stock: args.stock,
      reserved: 0,
      images: args.images,
      weight: args.weight,
      shippingInfo: args.shippingInfo,
      status: "DRAFT",
      totalSold: 0,
      updatedAt: now,
    });

    return productId;
  },
});

/** Update a product (seller only) */
export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    stock: v.optional(v.number()),
    images: v.optional(v.array(v.string())),
    categoryId: v.optional(v.id("categories")),
    weight: v.optional(v.number()),
    shippingInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const seller = await ctx.db.get(product.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.price !== undefined) updates.price = args.price;
    if (args.stock !== undefined) updates.stock = args.stock;
    if (args.images !== undefined) updates.images = args.images;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.shippingInfo !== undefined) updates.shippingInfo = args.shippingInfo;

    await ctx.db.patch(args.productId, updates);
    return args.productId;
  },
});

/** Submit product for review */
export const submitForReview = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const seller = await ctx.db.get(product.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.productId, {
      status: "PENDING_REVIEW",
      updatedAt: Date.now(),
    });
    return args.productId;
  },
});

/** Delete a product (seller only, must be DRAFT) */
export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const seller = await ctx.db.get(product.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    if (product.status !== "DRAFT")
      throw new Error("Can only delete draft products");

    await ctx.db.delete(args.productId);
    return args.productId;
  },
});

/** Get a product by ID (seller view — any status) */
export const getSellerProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});
