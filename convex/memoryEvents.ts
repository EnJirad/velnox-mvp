/**
 * Velnox — customer event recording (Phase 1: Brain Foundation).
 *
 * Regular (non-node) Convex module: mutations for writing `customerEvents`
 * and the internal queries the node actions in `memory.ts` use to read them.
 * Kept separate from `memory.ts` because node modules can only export actions.
 *
 * Phase 1 additions:
 *   - Complete event vocabulary (28 event types)
 *   - Session tracking (sessionId)
 *   - Batch event recording
 *   - Session lifecycle (start/end)
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  planAnonymousMerge,
  BRAIN_EVENT_SET,
} from "../packages/shared/src/lib/customer-memory-core";

/**
 * Complete event vocabulary (Phase 1: Brain Foundation).
 * All 28 recognized event types — keep in sync with customer-memory-core.ts.
 */
export const EVENT_TYPES = [
  // Session
  "SESSION_START",
  "SESSION_END",
  "APP_OPEN",
  // Product
  "PRODUCT_VIEW",
  "PRODUCT_CLICK",
  "PRODUCT_IMAGE_VIEW",
  // Discovery
  "CATEGORY_VIEW",
  "STORE_VIEW",
  // Search
  "SEARCH",
  "SEARCH_RESULT_CLICK",
  // Cart
  "CART_ADD",
  "CART_REMOVE",
  "CART_VIEW",
  // Wishlist
  "WISHLIST_ADD",
  "WISHLIST_REMOVE",
  // Checkout / Purchase
  "CHECKOUT_START",
  "PURCHASE",
  "PURCHASE_CANCEL",
  "REPEAT_PURCHASE",
  // Interest
  "INTEREST",
  "REORDER",
  "VELREPEAT_START",
  "VELREPEAT_CANCEL",
  // Recommendations
  "RECOMMENDATION_VIEW",
  "RECOMMENDATION_CLICK",
  "RECOMMENDATION_IGNORE",
  // Notifications
  "NOTIFICATION_SENT",
  "NOTIFICATION_OPEN",
] as const;
export type CustomerEventType = (typeof EVENT_TYPES)[number];

// Also accept any string event from BRAIN_EVENT_SET for forward-compatibility
const EVENT_TYPE_SET = BRAIN_EVENT_SET;

/**
 * Record a customer event from the browser/app. Signed-in users are bound to
 * their Convex userId; signed-out visitors pass a random anonymousId
 * (generated once in localStorage) so their browsing can power global
 * popularity without identifying them.
 *
 * Phase 1: supports optional sessionId for session grouping.
 */
export const track = mutation({
  args: {
    type: v.string(),
    entityId: v.optional(v.string()),
    value: v.optional(v.string()),
    context: v.optional(v.any()),
    anonymousId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
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
      sessionId: args.sessionId?.slice(0, 64) || undefined,
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

/**
 * Batch event recording — record multiple events in a single mutation call.
 * Used by mobile apps that batch events for efficiency.
 * Each event is individually validated; invalid events are silently dropped.
 */
export const trackBatch = mutation({
  args: {
    events: v.array(
      v.object({
        type: v.string(),
        entityId: v.optional(v.string()),
        value: v.optional(v.string()),
        context: v.optional(v.any()),
      }),
    ),
    anonymousId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const anonymousId = args.anonymousId?.trim() || undefined;
    if (!userId && !anonymousId) return;

    // Rate limit on batch: count total events
    try {
      const limiter = (await ctx.runMutation(api.rateLimit.hitRateLimit, {
        name: "customer_events",
        key: (userId ?? anonymousId) as string,
        max: 500,
        windowMs: 60_000,
      })) as { allowed: boolean };
      if (!limiter.allowed) return;
    } catch {
      return;
    }

    const now = Date.now();
    const sessionId = args.sessionId?.slice(0, 64) || undefined;

    for (const event of args.events) {
      if (!EVENT_TYPE_SET.has(event.type)) continue;
      await ctx.db.insert("customerEvents", {
        userId: userId ?? undefined,
        anonymousId: !userId ? anonymousId : undefined,
        sessionId,
        type: event.type,
        entityId: event.entityId?.slice(0, 200) || undefined,
        value: event.value?.slice(0, 120) || undefined,
        context: event.context,
        createdAt: now,
      });
    }
  },
});

// ===========================================================================
// SESSION MANAGEMENT
// ===========================================================================

/**
 * Start a new browsing session. Called when the user opens the app/site.
 * Returns the sessionId for the client to use in subsequent events.
 */
export const startSession = mutation({
  args: {
    device: v.optional(v.string()),
    platform: v.optional(v.string()),
    anonymousId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const anonymousId = args.anonymousId?.trim() || undefined;

    const sessionId = await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      anonymousId: !userId ? anonymousId : undefined,
      startedAt: Date.now(),
      device: args.device,
      platform: args.platform,
    });

    return sessionId;
  },
});

/**
 * End a browsing session. Called when the user closes the app/site or after timeout.
 */
export const endSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    // Only the session owner can end it
    const userId = await getAuthUserId(ctx);
    if (session.userId && session.userId !== userId) return;

    await ctx.db.patch(args.sessionId, { endedAt: Date.now() });
  },
});

// ===========================================================================
// GUEST → ACCOUNT MERGE
// ===========================================================================

/**
 * Guest → account identity merge (CPNS §5 / §8).
 *
 * Called by the client right after a guest signs in: the anonymous browsing
 * history kept under localStorage anonymousId is claimed by the account so no
 * useful memory is lost. Safe + idempotent:
 *   - events the account already has (same type + entity + value) are deleted
 *     so memory is never double-counted;
 *   - everything else is re-bound (userId set, anonymousId cleared);
 *   - a second call finds no anonymous rows left and is a no-op.
 * The client clears localStorage anonymousId after a successful merge, so the
 * claim happens exactly once per device.
 */
export const mergeAnonymousToUser = mutation({
  args: { anonymousId: v.string() },
  handler: async (ctx, { anonymousId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const anonId = anonymousId.trim();
    if (!anonId) return 0;

    const anonEvents = await ctx.db
      .query("customerEvents")
      .withIndex("by_anonymous", (q) => q.eq("anonymousId", anonId))
      .take(500);
    if (anonEvents.length === 0) return 0;

    const userEvents = await ctx.db
      .query("customerEvents")
      .withIndex("by_user_type", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);

    const { toMerge, toDrop } = planAnonymousMerge(
      anonEvents.map((e) => ({
        _id: e._id,
        type: e.type,
        entityId: e.entityId,
        value: e.value,
      })),
      userEvents.map((e) => ({ _id: e._id, type: e.type, entityId: e.entityId, value: e.value })),
    );

    for (const event of toDrop) {
      await ctx.db.delete(event._id as Id<"customerEvents">);
    }
    for (const event of toMerge) {
      await ctx.db.patch(event._id as Id<"customerEvents">, {
        userId,
        anonymousId: undefined, // identity claimed — no longer anonymous
      });
    }

    // Also merge anonymous sessions
    const anonSessions = await ctx.db
      .query("sessions")
      .withIndex("by_anonymous", (q) => q.eq("anonymousId", anonId))
      .take(100);
    for (const session of anonSessions) {
      await ctx.db.patch(session._id, {
        userId,
        anonymousId: undefined,
      });
    }

    return toMerge.length;
  },
});

// ===========================================================================
// INTERNAL QUERIES (used by node actions in memory.ts / brain.ts)
// ===========================================================================

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

/**
 * Internal: events created at/after `since` (epoch ms), ascending — the scan
 * window used by the Convex → Neon durable-flush cron.
 */
export const _recentEventsSince = query({
  args: { since: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("customerEvents")
      .filter((q) => q.gte(q.field("createdAt"), args.since))
      .order("asc")
      .take(args.limit ?? 2000);
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

/** Internal: events for a specific session. */
export const _eventsBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("customerEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100);
  },
});

/** Internal: count events by type for a user (used in signal computation). */
export const _countEventsByType = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("customerEvents")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId))
      .take(2000);

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    return counts;
  },
});
