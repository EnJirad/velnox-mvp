import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Resolve a storage id to its public URL. Used by the profile page to
 * display the avatar / cover image saved on the user document.
 */
export const getImageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
