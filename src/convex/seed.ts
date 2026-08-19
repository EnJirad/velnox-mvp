// ---------------------------------------------------------------------------
// Seed — idempotent data seeding for development
// ---------------------------------------------------------------------------

import { mutation } from "./_generated/server";

/** Seed categories, demo sellers, and products */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("categories").first();
    if (existing) return "already_seeded";

    // Categories
    const cats = [
      { name: { th: "สุขภาพและความงาม", en: "Health & Beauty", my: "ကျန်းမာရေးနှင့် အလှအပ" }, slug: "health-beauty", sortOrder: 1 },
      { name: { th: "อาหารและเครื่องดื่ม", en: "Food & Beverage", my: "အစားအစာနှင့် ဖျော်ရည်" }, slug: "food-beverage", sortOrder: 2 },
      { name: { th: "แฟชั่น", en: "Fashion", my: "ဖက်ရှင်" }, slug: "fashion", sortOrder: 3 },
      { name: { th: "อิเล็กทรอนิกส์", en: "Electronics", my: "အီလက်ထရွန်နစ်" }, slug: "electronics", sortOrder: 4 },
      { name: { th: "บ้านและสวน", en: "Home & Garden", my: "အိမ်နှင့် ဥယျာဉ်" }, slug: "home-garden", sortOrder: 5 },
    ];

    const catIds = [];
    for (const c of cats) {
      catIds.push(
        await ctx.db.insert("categories", {
          name: c.name,
          slug: c.slug,
          active: true,
          sortOrder: c.sortOrder,
        }),
      );
    }

    return "seeded";
  },
});
