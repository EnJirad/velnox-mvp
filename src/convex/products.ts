import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireUser, slugify } from "./lib";

// ---------------------------------------------------------------------------
// Public catalog
// ---------------------------------------------------------------------------

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    return categories
      .filter((category) => category.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        id: category._id,
        name: category.name,
        slug: category.slug,
        image: category.image,
      }));
  },
});

export const getPublicProducts = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, search }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();

    const keyword = search?.trim().toLowerCase();
    const result = [];
    for (const product of products) {
      if (categoryId && product.categoryId !== categoryId) continue;
      if (keyword) {
        const haystack = `${product.name} ${product.description} ${product.sku ?? ""}`.toLowerCase();
        if (!haystack.includes(keyword)) continue;
      }
      const seller = await ctx.db.get(product.sellerId);
      const category = product.categoryId
        ? await ctx.db.get(product.categoryId)
        : undefined;
      result.push({
        id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        images: product.images,
        stock: product.stock,
        reserved: product.reserved,
        totalSold: product.totalSold,
        description: product.description,
        sellerId: product.sellerId,
        sellerName: seller?.storeName ?? "Velnox seller",
        sellerLogo: seller?.logo,
        categoryName: category?.name?.en ?? null,
        updatedAt: product.updatedAt,
      });
    }
    return result.sort((a, b) => b.totalSold - a.totalSold);
  },
});

export const getProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) return null;
    const seller = await ctx.db.get(product.sellerId);
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    const category = product.categoryId
      ? await ctx.db.get(product.categoryId)
      : undefined;
    return {
      product,
      categoryName: category?.name?.en ?? null,
      seller: {
        id: seller?._id,
        storeName: seller?.storeName ?? "Velnox seller",
        storeSlug: seller?.storeSlug ?? "",
        logo: seller?.logo,
        description: seller?.description ?? "",
        status: seller?.status ?? "DISABLED",
      },
      variants,
    };
  },
});

// ---------------------------------------------------------------------------
// Seller product management
// ---------------------------------------------------------------------------

export const getMyProducts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) return null;
    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .collect();
    const result = [];
    for (const product of products) {
      const category = product.categoryId
        ? await ctx.db.get(product.categoryId)
        : undefined;
      result.push({
        id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        stock: product.stock,
        reserved: product.reserved,
        images: product.images,
        status: product.status,
        rejectionReason: product.rejectionReason,
        totalSold: product.totalSold,
        categoryName: category?.name?.en ?? null,
        updatedAt: product.updatedAt,
        description: product.description,
        sku: product.sku,
      });
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsertProduct = mutation({
  args: {
    id: v.optional(v.id("products")),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    stock: v.number(),
    categoryId: v.optional(v.id("categories")),
    sku: v.optional(v.string()),
    images: v.array(v.string()),
    weight: v.optional(v.number()),
    shippingInfo: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, name, description, price, stock, categoryId, sku, images, weight, shippingInfo },
  ) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller || seller.status !== "APPROVED") {
      throw new Error("Only approved sellers can manage products.");
    }
    const cleanName = name.trim();
    if (cleanName.length < 3) throw new Error("Product name is too short.");
    if (price <= 0) throw new Error("Price must be greater than zero.");
    if (stock < 0) throw new Error("Stock cannot be negative.");
    if (images.length === 0) throw new Error("Add at least one image.");

    if (id) {
      const product = await ctx.db.get(id);
      if (!product || product.sellerId !== seller._id) {
        throw new Error("Product not found.");
      }
      const keepStatus =
        product.status === "REJECTED" ? "DRAFT" : product.status;
      await ctx.db.patch(id, {
        name: cleanName,
        description: description.trim(),
        price: Math.round(price),
        stock: Math.round(stock),
        categoryId,
        sku: sku?.trim() || undefined,
        images,
        weight,
        shippingInfo: shippingInfo?.trim() || undefined,
        status: keepStatus,
        updatedAt: Date.now(),
      });
      return { id };
    }

    const inserted = await ctx.db.insert("products", {
      sellerId: seller._id,
      categoryId,
      name: cleanName,
      slug: `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 7)}`,
      description: description.trim(),
      price: Math.round(price),
      sku: sku?.trim() || undefined,
      stock: Math.round(stock),
      reserved: 0,
      images,
      weight,
      shippingInfo: shippingInfo?.trim() || undefined,
      status: "DRAFT",
      totalSold: 0,
      updatedAt: Date.now(),
    });
    await audit(ctx, {
      actorId: user._id,
      action: "product.created",
      targetType: "products",
      targetId: inserted,
    });
    return { id: inserted };
  },
});

export const setProductStatus = mutation({
  args: {
    productId: v.id("products"),
    action: v.union(v.literal("publish"), v.literal("archive")),
  },
  handler: async (ctx, { productId, action }) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const product = await ctx.db.get(productId);
    if (!product || product.sellerId !== seller?._id) {
      throw new Error("Product not found.");
    }
    if (action === "publish") {
      if (product.price <= 0 || product.images.length === 0) {
        throw new Error("Add a price and at least one image before publishing.");
      }
      await ctx.db.patch(productId, {
        status: "PENDING_REVIEW",
        rejectionReason: undefined,
        updatedAt: Date.now(),
      });
      await audit(ctx, {
        actorId: user._id,
        action: "product.submitted_for_review",
        targetType: "products",
        targetId: productId,
      });
    } else {
      await ctx.db.patch(productId, { status: "ARCHIVED", updatedAt: Date.now() });
    }
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const product = await ctx.db.get(productId);
    if (!product || product.sellerId !== seller?._id) {
      throw new Error("Product not found.");
    }
    if (!["DRAFT", "REJECTED", "ARCHIVED"].includes(product.status)) {
      throw new Error("Only drafts, rejected or archived products can be deleted.");
    }
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    for (const variant of variants) {
      await ctx.db.delete(variant._id);
    }
    await ctx.db.delete(productId);
    await audit(ctx, {
      actorId: user._id,
      action: "product.deleted",
      targetType: "products",
      targetId: productId,
    });
  },
});
