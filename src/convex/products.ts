import { mutation, query } from "./_generated/server";

/** Demo catalog for the VelShop storefront. */
const DEMO_PRODUCTS = [
  {
    name: "เสื้อยืดคอรอบ Premium Cotton",
    description: "ผ้าคอตตอน 100% น้ำหนัก 180 แกรม ใส่สบาย ไม่ยับง่าย",
    price: 390,
    category: "เสื้อผ้า",
    emoji: "👕",
  },
  {
    name: "กระเป๋าโท้ทผ้าแคนวาส",
    description: "ดีไซน์มินิมอล พื้นที่กว้าง หิ้วได้ทั้งใส่ของและใส่ใจ",
    price: 490,
    category: "กระเป๋า",
    emoji: "👜",
  },
  {
    name: "นาฬิกาข้อมือ Minimal Steel",
    description: "สายสตีล หน้าปัดเงาสะอาด กันน้ำได้ในชีวิตประจำวัน",
    price: 1290,
    category: "เครื่องประดับ",
    emoji: "⌚",
  },
  {
    name: "รองเท้าผ้าใบ Everyday White",
    description: "พื้นนุ่มเดินได้ทั้งวัน สีขาวสะอาดเข้ากับทุกชุด",
    price: 1590,
    category: "รองเท้า",
    emoji: "👟",
  },
  {
    name: "แก้วกาแฟสแตนเลส Keep Cool",
    description: "เก็บอุณหภูมิได้นาน 12 ชั่วโมง ฝาปิดกันรั่ว",
    price: 690,
    category: "ของใช้",
    emoji: "☕",
  },
  {
    name: "หูฟังไร้สาย Soundly Air",
    description: "ตัดเสียงรบกวน แบตเตอรี่ใช้งานได้นานถึง 30 ชั่วโมง",
    price: 2490,
    category: "อิเล็กทรอนิกส์",
    emoji: "🎧",
  },
  {
    name: "แว่นกันแดด Retro Round",
    description: "เลนส์กัน UV400 กรอบเรซิ่นน้ำหนักเบา",
    price: 890,
    category: "เครื่องประดับ",
    emoji: "🕶️",
  },
  {
    name: "เทียนหอม Signature Scent",
    description: "กลิ่นหอมละมุนจากธรรมชาติ เผาได้นานกว่า 40 ชั่วโมง",
    price: 450,
    category: "ของใช้",
    emoji: "🕯️",
  },
];

/** List all products in the catalog, ordered by name. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").order("asc").collect();
  },
});

/** Seed the demo catalog once. Idempotent: does nothing if products exist. */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("products").first();
    if (existing !== null) {
      return { seeded: false };
    }
    for (const product of DEMO_PRODUCTS) {
      await ctx.db.insert("products", product);
    }
    return { seeded: true };
  },
});
