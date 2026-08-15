/**
 * Velnox Backend — input validation (spec §37, §53).
 *
 * Every mutation validates its input with zod BEFORE touching the database.
 * GPS rules (spec §8, §62): a shipping address MUST carry latitude/longitude
 * in range (-90..90 / -180..180).
 */
import { z } from "zod";

export const latitudeSchema = z
  .number()
  .min(-90, "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90")
  .max(90, "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90");

export const longitudeSchema = z
  .number()
  .min(-180, "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180")
  .max(180, "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180");

export const phoneSchema = z
  .string()
  .trim()
  .min(9, "เบอร์โทรไม่ถูกต้อง")
  .max(15, "เบอร์โทรไม่ถูกต้อง")
  .regex(/^[0-9+\- ]+$/, "เบอร์โทรไม่ถูกต้อง");

export const emailSchema = z.string().trim().email("อีเมลไม่ถูกต้อง").max(254);

export const priceSchema = z.number().min(0, "ราคาต้องไม่ติดลบ").max(100_000_000);

export const positiveIntSchema = z
  .number()
  .int("ต้องเป็นจำนวนเต็ม")
  .min(1, "จำนวนต้องมากกว่า 0")
  .max(1_000_000);

export const nonNegativeIntSchema = z.number().int().min(0).max(1_000_000_000);

export const ratingSchema = z.number().int().min(1, "คะแนน 1–5").max(5, "คะแนน 1–5");

export const idSchema = z.string().uuid("id ไม่ถูกต้อง").or(z.string().min(8));

/** GPS pair — both present and in range when provided. */
export const gpsSchema = z
  .object({
    latitude: latitudeSchema.nullish(),
    longitude: longitudeSchema.nullish(),
  })
  .refine((g) => (g.latitude === null || g.latitude === undefined) === (g.longitude === null || g.longitude === undefined), {
    message: "ต้องระบุ latitude และ longitude คู่กัน",
  });

/** Address input — GPS REQUIRED for shipping addresses (spec §7–8, §62). */
export const addressInputSchema = z
  .object({
    label: z.string().trim().min(1).max(40).default("บ้าน"),
    recipientName: z.string().trim().min(1, "กรุณากรอกชื่อผู้รับ").max(120),
    phone: phoneSchema,
    line1: z.string().trim().min(1, "กรุณากรอกที่อยู่").max(255),
    line2: z.string().trim().max(255).nullish(),
    subdistrict: z.string().trim().max(120).nullish(),
    district: z.string().trim().max(120).nullish(),
    province: z.string().trim().max(120).nullish(),
    postalCode: z.string().trim().max(20).nullish(),
    country: z.string().trim().max(4).default("TH"),
    latitude: latitudeSchema.nullish(),
    longitude: longitudeSchema.nullish(),
    placeId: z.string().trim().max(255).nullish(),
    isDefault: z.boolean().default(false),
  })
  .refine(
    (a) => (a.latitude == null) === (a.longitude == null),
    { message: "ต้องระบุ latitude และ longitude คู่กัน", path: ["latitude"] },
  )
  .refine(
    // spec §62: the DEFAULT shipping address must carry GPS.
    // Non-default addresses without GPS are allowed (legacy/migration policy)
    // but rejected at checkout (requireShippingAddress).
    (a) => !a.isDefault || (a.latitude != null && a.longitude != null),
    { message: "ที่อยู่จัดส่งหลักต้องมีพิกัด GPS", path: ["latitude"] },
  );

/** Parsed address ready for the DB. */
export type AddressInput = z.infer<typeof addressInputSchema>;

/** Cart item add input. */
export const cartItemInputSchema = z.object({
  productId: idSchema,
  variantId: idSchema.nullish(),
  quantity: positiveIntSchema,
});

/** Checkout input — address id must belong to the caller (checked in service). */
export const checkoutInputSchema = z.object({
  addressId: idSchema,
  paymentMethod: z.enum(["cod", "transfer", "card", "promptpay", "wallet"]).default("cod"),
  shippingFee: z.number().min(0).max(100_000_000).default(0),
  note: z.string().trim().max(500).nullish(),
});

/** Return request input. */
export const returnInputSchema = z.object({
  orderId: idSchema,
  items: z.array(z.object({ orderItemId: idSchema, quantity: positiveIntSchema })).min(1, "ต้องระบุสินค้าที่จะคืน"),
  reason: z.enum(["damaged", "wrong_item", "missing_item", "not_as_described", "customer_changed_mind", "other"]),
  description: z.string().trim().max(1000).nullish(),
  evidenceUrls: z.array(z.string().url()).max(6).default([]),
});

/** Review input — verified purchase is enforced in the service. */
export const reviewInputSchema = z.object({
  productId: idSchema,
  orderId: idSchema,
  rating: ratingSchema,
  title: z.string().trim().max(120).nullish(),
  comment: z.string().trim().max(2000).nullish(),
  images: z.array(z.string().url()).max(6).default([]),
});
