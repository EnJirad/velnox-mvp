import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib";

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return [...all]
      .sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return b._creationTime - a._creationTime;
      })
      .slice(0, 30);
  },
});

export const unreadNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return all.filter((notification) => !notification.read).length;
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const notification of all) {
      if (!notification.read) {
        await ctx.db.patch(notification._id, { read: true });
      }
    }
  },
});
