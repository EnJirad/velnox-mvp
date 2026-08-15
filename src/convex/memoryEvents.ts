/**
 * Velnox — customer event recording (docs/Velnox-CPNS.md).
 *
 * Regular (non-node) Convex module: mutations for writing `customerEvents`
 * and the internal queries the node actions in `memory.ts` use to read them.
 * Kept separate from `memory.ts` because node modules can only export actions.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/** Event vocabulary (CPNS §17) — keep in sync with src/lib/track.ts. */
export const EVENT_TYPES = [
  "PRODUCT_VIEW",
  "PRODUCT_CLICK",
  "SEARCH",
  "CATEGORY_VIEW",
  "SHOP_VIEW",
  "INTEREST",
  "WISHLIST_ADD",
  "WISHLIST_REMOVE",
  "CART_ADD",
  "CART_REMOVE",
  "CHECKOUT_START",
  "PURCHASE",
  "REORDER",
  "VELREPEAT_START",
] as const;
export type CustomerEventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

/**
 * Record a customer event from the browser. Signed-in users are bound to
 * their Convex userId; signed-out visitors pass a random anonymousId
 * (generated once in localStorage) so their browsing can power global
 * popularity without identifying them.
 */
export const track = mutation({
  args: {
    type: v.string(),
    entityId: v.optional(v.string()),
    value: v.optional(v.string()),
    context: v.optional(v.any()),
    anonymousId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!EVENT_TYPE_SET.has(args.type)) return;
    const userId = await getAuthUserId(ctx);
    const anonymousId = args.anonymousId?.trim() || undefined;
    if (!userId && !anonymousId) return; // nothing to bind to — drop silently
    if (userId && anonymousId) return; // authenticated users never use anon ids

    // Light abuse guard: never throw — tracking must stay invisible to the UI.
    try {
      const limiter = (await ctx.runMutation(api.rateLimit.hitRateLimit, {
        name: "customer_events",
        key: (userId ?? anonymousId) as string,
        max: 300,
        windowMs: 60_000,
      })) as { allowed: boolean };
      if (!limiter.allowed) return;
    } catch {
      return;
    }

    await ctx.db.insert("customerEvents", {
      userId: userId ?? undefined,
      anonymousId,
      type: args.type,
      entityId: args.entityId?.slice(0, 200) || undefined,
      value: args.value?.slice(0, 120) || undefined,
      context: args.context,
      createdAt: Date.now(),
    });
  },
});

/**
 * Server-side event recording (called by node actions via ctx.runMutation —
 * e.g. PURCHASE after checkout, REORDER, VELREPEAT_START, WISHLIST_ADD).
 * The userId comes from the action's authenticated identity, never from the
 * client, so event attribution cannot be spoofed by a shopper.
 */
export const trackForUser = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    entityId: v.optional(v.string()),
    value: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!EVENT_TYPE_SET.has(args.type)) return;
    await ctx.db.insert("customerEvents", {
      userId: args.userId,
      type: args.type,
      entityId: args.entityId?.slice(0, 200) || undefined,
      value: args.value?.slice(0, 120) || undefined,
      context: args.context,
      createdAt: Date.now(),
    });
  },
});

/** Internal query used by actions to load one user's event stream. */
export const _recentEventsForUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("customerEvents")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 400);
  },
});

/** Internal: recent PRODUCT_VIEW events across the marketplace. */
export const _popularEntities = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("customerEvents")
      .withIndex("by_type", (q) => q.eq("type", "PRODUCT_VIEW"))
      .order("desc")
      .take(300);
  },
});

/** Internal: recent SEARCH events. */
export const _recentSearches = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("customerEvents")
      .withIndex("by_type", (q) => q.eq("type", "SEARCH"))
      .order("desc")
      .take(200);
  },
});

/** Internal: recent CATEGORY_VIEW events. */
export const _recentCategoryViews = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("customerEvents")
      .withIndex("by_type", (q) => q.eq("type", "CATEGORY_VIEW"))
      .order("desc")
      .take(200);
  },
});
