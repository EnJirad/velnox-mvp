import { mutation } from "./_generated/server";
import { slugify } from "./lib";

const svgImage = (label: string, from: string, to: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="50%" y="46%" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="700" fill="rgba(255,255,255,0.95)" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Seed a first-run marketplace: categories, two approved demo sellers and a
 * catalog of active products. Idempotent — guarded by a settings flag.
 */
export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "seed:v1"))
      .first();
    if (flag) return { seeded: false };

    const now = Date.now();

    const categoryRows = [
      { en: "Electronics", th: "อิเล็กทรอนิกส์", my: "အီလက်ထရွန်နစ်", slug: "electronics", sortOrder: 1 },
      { en: "Fashion", th: "แฟชั่น", my: "ဖက်ရှင်", slug: "fashion", sortOrder: 2 },
      { en: "Home & Living", th: "บ้านและที่อยู่อาศัย", my: "အိမ်နှင့်နေထိုင်ရေး", slug: "home-living", sortOrder: 3 },
      { en: "Beauty", th: "ความงาม", my: "အလှအပ", slug: "beauty", sortOrder: 4 },
      { en: "Sports", th: "กีฬา", my: "အားကစား", slug: "sports", sortOrder: 5 },
    ];
    const categoryIds: Record<string, string> = {};
    for (const row of categoryRows) {
      const id = await ctx.db.insert("categories", {
        name: { en: row.en, th: row.th, my: row.my },
        slug: row.slug,
        active: true,
        sortOrder: row.sortOrder,
      });
      categoryIds[row.slug] = id;
    }

    const seller1UserId = await ctx.db.insert("users", {
      name: "Nova Supply Co.",
      email: "nova@demo.velnox.local",
    });
    const seller2UserId = await ctx.db.insert("users", {
      name: "Aster & Co.",
      email: "aster@demo.velnox.local",
    });

    const seller1 = await ctx.db.insert("sellers", {
      userId: seller1UserId,
      storeName: "Nova Supply Co.",
      storeSlug: "nova-supply",
      description: "Gadgets, audio and everyday tech — tested, curated, delivered fast.",
      contactPerson: "Nova Team",
      contactPhone: "080-000-0001",
      contactEmail: "nova@demo.velnox.local",
      shippingSettings: {
        shipsNationwide: true,
        flatFee: 4500,
        freeShippingThreshold: 100000,
        processingDays: 1,
      },
      status: "APPROVED",
      approvedAt: now,
      submittedAt: now,
      agreementAccepted: true,
    });
    const seller2 = await ctx.db.insert("sellers", {
      userId: seller2UserId,
      storeName: "Aster & Co.",
      storeSlug: "aster-co",
      description: "Homeware, living essentials and slow-made goods with character.",
      contactPerson: "Aster Team",
      contactPhone: "080-000-0002",
      contactEmail: "aster@demo.velnox.local",
      shippingSettings: {
        shipsNationwide: true,
        flatFee: 4500,
        freeShippingThreshold: 100000,
        processingDays: 2,
      },
      status: "APPROVED",
      approvedAt: now,
      submittedAt: now,
      agreementAccepted: true,
    });

    const catalog: {
      sellerId: string;
      category: string;
      name: string;
      price: number;
      stock: number;
      sold: number;
      blurb: string;
      from: string;
      to: string;
    }[] = [
      { sellerId: seller1, category: "electronics", name: "PulseBuds Pro Wireless Earbuds", price: 129000, stock: 42, sold: 187, blurb: "Active noise cancelling, 32-hour battery, low-latency gaming mode.", from: "#0f172a", to: "#22d3ee" },
      { sellerId: seller1, category: "electronics", name: "Volt 65W GaN Travel Charger", price: 89900, stock: 120, sold: 341, blurb: "Three ports, foldable pins, pocket-size power for all your devices.", from: "#1e1b4b", to: "#a78bfa" },
      { sellerId: seller1, category: "electronics", name: "Lumen Smart LED Desk Lamp", price: 159000, stock: 26, sold: 94, blurb: "Glare-free light with auto brightness that follows your day.", from: "#052e16", to: "#4ade80" },
      { sellerId: seller1, category: "electronics", name: "Hexa Mechanical Keyboard TKL", price: 249000, stock: 18, sold: 76, blurb: "Hot-swappable switches, gasket mount, tri-mode connectivity.", from: "#171717", to: "#facc15" },
      { sellerId: seller2, category: "home-living", name: "Ember Ceramic Pour-Over Set", price: 189000, stock: 14, sold: 58, blurb: "Hand-finished stoneware dripper, carafe and cup for slow mornings.", from: "#431407", to: "#fb923c" },
      { sellerId: seller2, category: "home-living", name: "Halo Woven Throw Blanket", price: 119000, stock: 33, sold: 142, blurb: "Brushed cotton-blend throw in a warm, textured weave.", from: "#3b0764", to: "#e879f9" },
      { sellerId: seller2, category: "home-living", name: "Nook Modular Storage Shelf", price: 329000, stock: 9, sold: 37, blurb: "Reconfigurable oak-veneer shelving that grows with your space.", from: "#292524", to: "#d6d3d1" },
      { sellerId: seller2, category: "beauty", name: "Botanica Vitamin C Serum", price: 69000, stock: 64, sold: 412, blurb: "15% stabilised vitamin C with hyaluronic acid and niacinamide.", from: "#4a044e", to: "#f472b6" },
      { sellerId: seller2, category: "fashion", name: "Aster Canvas Tote — Midnight", price: 59000, stock: 88, sold: 233, blurb: "Heavyweight organic canvas tote, reinforced base, inside pocket.", from: "#0c0a09", to: "#57534e" },
      { sellerId: seller1, category: "sports", name: "Strata Lightweight Yoga Mat", price: 79000, stock: 51, sold: 176, blurb: "6mm natural rubber with alignment lines and carry strap.", from: "#0f172a", to: "#2dd4bf" },
    ];

    for (const row of catalog) {
      await ctx.db.insert("products", {
        sellerId: row.sellerId as never,
        categoryId: categoryIds[row.category] as never,
        name: row.name,
        slug: `${slugify(row.name)}-demo`,
        description: row.blurb,
        price: row.price,
        stock: row.stock,
        reserved: 0,
        images: [svgImage(row.name.split(" ")[0], row.from, row.to)],
        shippingInfo: "Ships nationwide within 1–2 business days.",
        status: "ACTIVE",
        totalSold: row.sold,
        updatedAt: now - row.sold * 1000,
      });
    }

    await ctx.db.insert("settings", {
      key: "seed:v1",
      value: { done: true, at: now },
    });

    return { seeded: true };
  },
});
