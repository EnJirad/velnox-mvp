/**
 * Velnox — Customer Memory & Personal Intelligence (docs/Velnox-CPNS.md)
 *
 * “ทุก Interaction คือข้อมูล” — this module is the Data Foundation of the
 * platform:
 *
 *   Customer Events  →  Customer Memory  →  Understanding  →  Recommendations
 *
 * Every meaningful shopper action on velshop is recorded into `customerEvents`
 * (bound to the authenticated user — or a guest anonymousId when signed out)
 * and then converted into per-customer understanding that is used to
 * personalize the experience (home recommendations, category chips, proactive
 * reorder reminders).
 *
 * Rules (CPNS §16):
 *   - “ของใคร ของมัน” — every read is scoped to the authenticated user's own
 *     rows. Guests only feed global popularity, never personalized memory.
 *   - Anonymous events carry NO personally-identifiable data.
 *   - Tracking is fire-and-forget: it must never break the shopper's flow.
 *
 * This file is a node action module ("use node") because it reads the Neon
 * commerce core (products / shops / orders) via src/backend/*. The lightweight
 * event mutations + internal queries live in `memoryEvents.ts`.
 */
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { getDb } from "../backend/db";
import { getProduct, listProducts } from "../backend/products";
import { getShopById } from "../backend/sellers";
import { listOrdersForCustomer } from "../backend/orders";
import type { Product } from "../backend/types";
// Scoring weights, half-lives, decay + intent live in the pure core module so
// they can be unit-tested without a Convex runtime (src/lib/customer-memory-core.ts).
import { DAY_MS, decay, estimateIntent, eventWeight } from "../lib/customer-memory-core";

export const CATEGORY_LABELS: Record<string, string> = {
  general: "ทั่วไป",
  food: "อาหาร",
  daily: "ของใช้ประจำวัน",
  beauty: "ความงาม",
  packaging: "บรรจุภัณฑ์",
  other: "อื่น ๆ",
};

const CATEGORY_EMOJI: Record<string, string> = {
  general: "🛍️",
  food: "🍽️",
  daily: "🧴",
  beauty: "💄",
  packaging: "📦",
  other: "✨",
};

type EventRow = {
  _id: string;
  userId?: string;
  anonymousId?: string;
  type: string;
  entityId?: string;
  value?: string;
  context?: unknown;
  createdAt: number;
};

async function loadUserEvents(
  ctx: ActionCtx,
  userId: string,
  limit = 400,
): Promise<EventRow[]> {
  const rows = await ctx.runQuery(api.memoryEvents._recentEventsForUser, {
    userId: userId as Id<"users">,
    limit,
  });
  return rows as unknown as EventRow[];
}

// ---------------------------------------------------------------------------
// Per-customer memory (reads are strictly scoped to the authenticated user)
// ---------------------------------------------------------------------------
/**
 * Customer Memory summary — what Velnox currently “understands” about this
 * customer: category affinity, top searches, favourite shops and intent level.
 */
export const myMemory = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const events = await loadUserEvents(ctx, userId, 400);
    if (events.length === 0) return null;

    const now = Date.now();
    let viewCount = 0;
    let purchaseCount = 0;
    let cartAddCount = 0;
    let wishlistCount = 0;
    let checkoutCount = 0;

    const categoryScore = new Map<string, { score: number; count: number }>();
    const shopScore = new Map<string, { shopId: string; score: number; count: number; shopName: string }>();
    const searchCount = new Map<string, number>();
    const productEvents = new Map<
      string,
      { views: number; clicks: number; added: number; wished: number; interested: number; bought: number; lastAt: number }
    >();
    const seenShops = new Set<string>();

    for (const e of events) {
      const w = eventWeight(e.type);
      const d = decay(e.type, e.createdAt, now);
      switch (e.type) {
        case "PRODUCT_VIEW":
          viewCount++;
          break;
        case "PURCHASE":
          purchaseCount++;
          break;
        case "CART_ADD":
          cartAddCount++;
          break;
        case "WISHLIST_ADD":
        case "INTEREST":
          wishlistCount++;
          break;
        case "CHECKOUT_START":
          checkoutCount++;
          break;
      }
      if (w <= 0) continue;
      if (e.type === "SEARCH" && e.value) {
        const q = e.value.trim().slice(0, 60);
        if (q) searchCount.set(q, (searchCount.get(q) ?? 0) + 1);
        continue;
      }
      if (e.type === "CATEGORY_VIEW" && e.value) {
        const agg = categoryScore.get(e.value) ?? { score: 0, count: 0 };
        agg.score += w * d;
        agg.count += 1;
        categoryScore.set(e.value, agg);
        continue;
      }
      if (e.type === "SHOP_VIEW" && e.entityId) {
        const agg = shopScore.get(e.entityId) ?? { shopId: e.entityId, score: 0, count: 0, shopName: "ร้านค้า" };
        agg.score += w * d;
        agg.count += 1;
        shopScore.set(e.entityId, agg);
        seenShops.add(e.entityId);
        continue;
      }
      if (e.entityId) {
        const agg = productEvents.get(e.entityId) ?? {
          views: 0,
          clicks: 0,
          added: 0,
          wished: 0,
          interested: 0,
          bought: 0,
          lastAt: 0,
        };
        if (e.type === "PRODUCT_VIEW") agg.views++;
        else if (e.type === "PRODUCT_CLICK") agg.clicks++;
        else if (e.type === "CART_ADD") agg.added++;
        else if (e.type === "WISHLIST_ADD") agg.wished++;
        else if (e.type === "INTEREST") agg.interested++;
        else if (e.type === "PURCHASE") agg.bought++;
        agg.lastAt = Math.max(agg.lastAt, e.createdAt);
        productEvents.set(e.entityId, agg);
      }
    }

    // Resolve product categories + shop names (Neon lookups, bounded).
    const db = getDb();
    for (const [productId, agg] of productEvents) {
      const product = await getProduct(db, productId);
      if (!product) continue;
      const score = agg.views * 2 + agg.clicks * 1.5 + agg.added * 6 + agg.wished * 5 + agg.interested * 4 + agg.bought * 12;
      const catAgg = categoryScore.get(product.category) ?? { score: 0, count: 0 };
      catAgg.score += score;
      catAgg.count += 1;
      categoryScore.set(product.category, catAgg);
      if (agg.bought > 0 && !seenShops.has(product.shopId)) {
        const shop = await getShopById(db, product.shopId);
        if (shop) {
          const sAgg = shopScore.get(shop.id) ?? { shopId: shop.id, score: 0, count: 0, shopName: shop.name };
          sAgg.score += agg.bought * 3;
          sAgg.count += 1;
          shopScore.set(shop.id, sAgg);
        }
      }
    }
    for (const shopId of seenShops) {
      const agg = shopScore.get(shopId);
      if (!agg || agg.shopName !== "ร้านค้า") continue;
      const shop = await getShopById(db, shopId);
      if (shop) agg.shopName = shop.name;
    }

    const categories = Array.from(categoryScore.entries())
      .map(([category, { score, count }]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        score: Math.round(score * 10) / 10,
        count,
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const searches = Array.from(searchCount.entries())
      .map(([q, count]) => ({ q, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const shops = Array.from(shopScore.values())
      .map((s) => ({ shopId: s.shopId, shopName: s.shopName, score: Math.round(s.score * 10) / 10, count: s.count }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // CPNS §10 — estimate intent carefully, never from a single event.
    const intent = estimateIntent({ purchaseCount, cartAddCount, viewCount, wishlistCount, checkoutCount });

    return {
      categories,
      searches,
      shops,
      intent,
      eventCount: events.length,
      viewCount,
      purchaseCount,
      cartAddCount,
      wishlistCount,
      checkoutCount,
    };
  },
});

// ---------------------------------------------------------------------------
// Personalized recommendations
// ---------------------------------------------------------------------------
/**
 * What THIS customer should see, ranked from their own memory:
 *   product interest + category affinity + shop affinity + search matches.
 * Signed-out visitors get marketplace popularity instead (no identity → no
 * personal memory, CPNS §16).
 */
export const recommendForCustomer = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 8;
    const identity = await ctx.auth.getUserIdentity();
    const db = getDb();
    const catalog = await listProducts(db, { status: "published", limit: 100 });
    const catalogMap = new Map(catalog.map((p) => [p.id, p]));

    // ---- signed-out → global popularity (last 30 days) ---------------------
    if (!identity) {
      return popularItems(ctx, db, catalogMap, limit);
    }

    // ---- signed-in → personal memory --------------------------------------
    const events = await loadUserEvents(ctx, identity.subject, 500);
    if (events.length === 0) {
      return popularItems(ctx, db, catalogMap, limit);
    }

    const now = Date.now();

    // 1) per-product interest (weighted + decayed)
    const productScore = new Map<
      string,
      {
        score: number;
        views: number;
        added: number;
        wished: number;
        interested: number;
        bought: number;
        searches: string[];
        lastAt: number;
      }
    >();
    const categoryAffinity = new Map<string, number>();
    const shopAffinity = new Map<string, number>();

    for (const e of events) {
      const w = eventWeight(e.type);
      const d = decay(e.type, e.createdAt, now);
      if (e.type === "SEARCH") {
        const q = e.value?.trim().slice(0, 60);
        if (!q) continue;
        for (const p of catalog) {
          if (p.name.toLowerCase().includes(q.toLowerCase())) {
            const agg = productScore.get(p.id) ?? {
              score: 0,
              views: 0,
              added: 0,
              wished: 0,
              interested: 0,
              bought: 0,
              searches: [],
              lastAt: 0,
            };
            const boost = w * d;
            agg.score += boost;
            if (!agg.searches.includes(q)) agg.searches.push(q);
            productScore.set(p.id, agg);
            categoryAffinity.set(p.category, (categoryAffinity.get(p.category) ?? 0) + boost * 0.8);
          }
        }
        continue;
      }
      if (e.type === "CATEGORY_VIEW" && e.value) {
        categoryAffinity.set(e.value, (categoryAffinity.get(e.value) ?? 0) + w * d);
        continue;
      }
      if (e.type === "SHOP_VIEW" && e.entityId) {
        shopAffinity.set(e.entityId, (shopAffinity.get(e.entityId) ?? 0) + w * d);
        continue;
      }
      if (!e.entityId) continue;
      const agg = productScore.get(e.entityId) ?? {
        score: 0,
        views: 0,
        added: 0,
        wished: 0,
        interested: 0,
        bought: 0,
        searches: [],
        lastAt: 0,
      };
      agg.score += w * d;
      if (e.type === "PRODUCT_VIEW") agg.views++;
      else if (e.type === "CART_ADD") agg.added++;
      else if (e.type === "WISHLIST_ADD") agg.wished++;
      else if (e.type === "INTEREST") agg.interested++;
      else if (e.type === "PURCHASE") agg.bought++;
      agg.lastAt = Math.max(agg.lastAt, e.createdAt);
      productScore.set(e.entityId, agg);
      const product = catalogMap.get(e.entityId);
      if (product) {
        categoryAffinity.set(product.category, (categoryAffinity.get(product.category) ?? 0) + w * d * 0.6);
      }
    }

    const topCategory = Array.from(categoryAffinity.entries()).sort((a, b) => b[1] - a[1])[0];

    const items: { product: Product; score: number; reasons: string[]; views: number }[] = [];
    for (const p of catalog) {
      if (p.price <= 0) continue;
      const agg = productScore.get(p.id);
      const direct = agg?.score ?? 0;
      const catBoost = (categoryAffinity.get(p.category) ?? 0) * 0.6;
      const shopBoost = (shopAffinity.get(p.shopId) ?? 0) * 0.35;
      const score = direct + catBoost + shopBoost;
      if (score <= 0) continue;

      const reasons: string[] = [];
      if (agg && agg.bought > 0) reasons.push("คุณเคยสั่งซื้อ");
      if (agg && agg.added > 0) reasons.push("คุณเคยเพิ่มลงตะกร้า");
      if (agg && (agg.wished > 0 || agg.interested > 0)) reasons.push("คุณแสดงความสนใจ");
      if (agg && agg.views >= 3 && reasons.length < 2) reasons.push("คุณเปิดดูบ่อย");
      if (agg && agg.searches.length > 0 && reasons.length < 2) {
        reasons.push(`คุณค้นหา “${agg.searches[0]}”`);
      }
      if (reasons.length < 2 && topCategory && topCategory[0] === p.category && topCategory[1] > 0) {
        reasons.push(`หมวด ${CATEGORY_LABELS[p.category] ?? p.category} ที่คุณสนใจ`);
      }
      if (reasons.length === 0 && shopBoost > 0) reasons.push("จากร้านที่คุณแวะบ่อย");

      items.push({ product: p, score: Math.round(score * 100) / 100, reasons, views: agg?.views ?? 0 });
    }

    items.sort((a, b) => b.score - a.score || b.views - a.views);

    // warm-up blend: fewer than 4 personal picks → top up with popular
    if (items.length < 4) {
      const picked = new Set(items.map((i) => i.product.id));
      const popular = (await ctx.runQuery(api.memoryEvents._popularEntities, {})) as EventRow[];
      const counts = new Map<string, number>();
      const since = Date.now() - 30 * DAY_MS;
      for (const r of popular) {
        if (r.createdAt < since || !r.entityId || picked.has(r.entityId)) continue;
        counts.set(r.entityId, (counts.get(r.entityId) ?? 0) + 1);
      }
      const fallback: { product: Product; score: number; reasons: string[]; views: number }[] = [];
      for (const [productId, count] of counts) {
        const product = catalogMap.get(productId);
        if (!product || product.status !== "published" || product.price <= 0) continue;
        fallback.push({ product, score: 1 + count, reasons: ["ยอดนิยมในตลาดตอนนี้"], views: count });
      }
      fallback.sort((a, b) => b.score - a.score);
      for (const f of fallback) {
        if (items.length >= limit) break;
        items.push(f);
      }
    }

    return { items: items.slice(0, limit), source: "personal" as const };
  },
});

/** Marketplace popularity — used for guests and warm-up blending. */
async function popularItems(
  ctx: ActionCtx,
  db: ReturnType<typeof getDb>,
  catalogMap: Map<string, Product>,
  limit: number,
) {
  const since = Date.now() - 30 * DAY_MS;
  const rows = (await ctx.runQuery(api.memoryEvents._popularEntities, {})) as EventRow[];
  const counts = new Map<string, { views: number; lastAt: number }>();
  for (const r of rows) {
    if (r.createdAt < since || !r.entityId) continue;
    const agg = counts.get(r.entityId) ?? { views: 0, lastAt: 0 };
    agg.views += 1;
    agg.lastAt = Math.max(agg.lastAt, r.createdAt);
    counts.set(r.entityId, agg);
  }
  const items: { product: Product; score: number; reasons: string[]; views: number }[] = [];
  for (const [productId, agg] of counts) {
    const product = catalogMap.get(productId) ?? (await getProduct(db, productId));
    if (!product || product.status !== "published" || product.price <= 0) continue;
    items.push({ product, score: agg.views, reasons: ["ยอดนิยมในตลาดตอนนี้"], views: agg.views });
  }
  items.sort((a, b) => b.score - a.score || b.views - a.views);
  return { items: items.slice(0, limit), source: "popular" as const };
}

// ---------------------------------------------------------------------------
// Proactive Commerce — “ถึงเวลาสั่งซื้อซ้ำแล้ว” (CPNS §14)
// ---------------------------------------------------------------------------
/**
 * Learn each regular item's purchase cycle from the customer's own order
 * history (≥2 purchases, sane interval) and return what is due (or overdue)
 * right now — the proactive nudge that turns Reactive into Proactive commerce.
 */
export const dueReorderReminders = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const db = getDb();
    const orders = await listOrdersForCustomer(db, identity.subject, 100);

    const byProduct = new Map<string, { times: number; lastOrderedAt: number; orderDates: number[] }>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const ts = new Date(order.createdAt).getTime();
      const items = order.items ?? [];
      for (const item of items) {
        const agg = byProduct.get(item.productId) ?? { times: 0, lastOrderedAt: 0, orderDates: [] };
        agg.times += 1;
        agg.lastOrderedAt = Math.max(agg.lastOrderedAt, ts);
        agg.orderDates.push(ts);
        byProduct.set(item.productId, agg);
      }
    }

    const now = Date.now();
    const reminders: {
      product: Product;
      times: number;
      avgCycleDays: number;
      lastOrderedAt: number;
      nextDueAt: number;
      daysLeft: number;
      emoji: string;
    }[] = [];

    for (const [productId, agg] of byProduct) {
      if (agg.times < 2) continue;
      const dates = agg.orderDates.sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        const gap = (dates[i] - dates[i - 1]) / DAY_MS;
        if (gap >= 2 && gap <= 180) intervals.push(gap);
      }
      if (intervals.length === 0) continue;
      const avgCycleDays = Math.round(intervals.reduce((s, x) => s + x, 0) / intervals.length);
      const nextDueAt = agg.lastOrderedAt + avgCycleDays * DAY_MS;
      const daysLeft = Math.round((nextDueAt - now) / DAY_MS);
      if (daysLeft > 3) continue; // not due yet — wait for the right moment

      const product = await getProduct(db, productId);
      if (!product || product.status !== "published") continue;
      reminders.push({
        product,
        times: agg.times,
        avgCycleDays,
        lastOrderedAt: agg.lastOrderedAt,
        nextDueAt,
        daysLeft,
        emoji: CATEGORY_EMOJI[product.category] ?? "🛍️",
      });
    }

    reminders.sort((a, b) => a.daysLeft - b.daysLeft);
    return reminders.slice(0, 6);
  },
});

// ---------------------------------------------------------------------------
// Marketplace insights (velcenter) — aggregates only, no personal data
// ---------------------------------------------------------------------------
/** What the whole marketplace is interested in right now (privacy-safe sums). */
export const marketInsights = action({
  args: {},
  handler: async (ctx) => {
    const db = getDb();
    const since = Date.now() - 30 * DAY_MS;

    const searchRows = (await ctx.runQuery(api.memoryEvents._recentSearches, {})) as EventRow[];
    const searchCount = new Map<string, number>();
    for (const r of searchRows) {
      if (r.createdAt < since || !r.value) continue;
      const q = r.value.trim().slice(0, 60);
      if (!q) continue;
      searchCount.set(q, (searchCount.get(q) ?? 0) + 1);
    }
    const topSearches = Array.from(searchCount.entries())
      .map(([q, count]) => ({ q, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const categoryRows = (await ctx.runQuery(api.memoryEvents._recentCategoryViews, {})) as EventRow[];
    const categoryCount = new Map<string, number>();
    for (const r of categoryRows) {
      if (r.createdAt < since || !r.value) continue;
      categoryCount.set(r.value, (categoryCount.get(r.value) ?? 0) + 1);
    }
    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, label: CATEGORY_LABELS[category] ?? category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const viewRows = (await ctx.runQuery(api.memoryEvents._popularEntities, {})) as EventRow[];
    const productCount = new Map<string, number>();
    let eventCount = 0;
    for (const r of viewRows) {
      if (r.createdAt < since || !r.entityId) continue;
      eventCount++;
      productCount.set(r.entityId, (productCount.get(r.entityId) ?? 0) + 1);
    }
    const popularProducts: { product: Product; views: number }[] = [];
    for (const [productId, views] of productCount) {
      const product = await getProduct(db, productId);
      if (!product || product.status !== "published") continue;
      popularProducts.push({ product, views });
    }
    popularProducts.sort((a, b) => b.views - a.views);

    return {
      topSearches,
      topCategories,
      popularProducts: popularProducts.slice(0, 8),
      eventCount,
      windowDays: 30,
    };
  },
});
