/**
 * Velnox Backend — API rate limiting (spec §25, §54).
 *
 * Fixed-window limiter stored in the `rateLimits` Convex table. Convex
 * mutations are serialized per document, so incrementing one counter doc per
 * (name, key) is atomic — no double-spend on the same window.
 *
 * Node actions call enforceRateLimit() before abuse-prone work (checkout,
 * review, return, subscription, order cancel). Convex Auth already applies its
 * own rate limiting to OTP/sign-in attempts (emailOtp provider).
 */
import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const hitRateLimit = mutation({
  args: {
    name: v.string(),
    key: v.string(),
    max: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_name_key", (q) => q.eq("name", args.name).eq("key", args.key))
      .first();

    // expired window → start over
    if (!existing || existing.resetAt <= now) {
      await ctx.db.insert("rateLimits", {
        name: args.name,
        key: args.key,
        count: 1,
        resetAt: now + args.windowMs,
      });
      return { allowed: true, remaining: args.max - 1, retryAfterMs: 0 };
    }

    if (existing.count >= args.max) {
      return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true, remaining: args.max - (existing.count + 1), retryAfterMs: 0 };
  },
});

/** Shared guard for node actions — throws a friendly error when throttled. */
export async function enforceRateLimit(
  ctx: import("./_generated/server").ActionCtx,
  opts: { name: string; key: string; max: number; windowMs: number },
): Promise<void> {
  const res = (await ctx.runMutation(api.rateLimit.hitRateLimit, opts)) as {
    allowed: boolean;
    retryAfterMs: number;
  };
  if (!res.allowed) {
    const seconds = Math.ceil(res.retryAfterMs / 1000);
    throw new Error(`ทำรายการถี่เกินไป กรุณารอประมาณ ${seconds} วินาที แล้วลองอีกครั้ง`);
  }
}
