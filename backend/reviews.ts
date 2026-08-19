/**
 * Velnox Backend — Reviews (spec §32, §47).
 *
 * A customer can only review a product they actually bought: the order must
 * exist, belong to the user, contain the product, and be completed. One review
 * per (user, product, order) — enforced by a unique index.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { toMs } from "./dates";
import { AppError } from "./errors";
import { reviewInputSchema } from "./validation";
import type { Review } from "./types";

function mapReview(r: Record<string, any>): Review {
  const images = Array.isArray(r.images) ? r.images : [];
  return {
    id: r.id,
    productId: r.product_id,
    shopId: r.shop_id,
    userId: r.user_id,
    orderId: r.order_id ?? null,
    rating: Number(r.rating),
    title: r.title ?? null,
    comment: r.comment ?? null,
    images,
    status: r.status,
    createdAt: toMs(r.created_at),
    userName: r.user_name ?? undefined,
  };
}

/** Verify the customer really completed an order containing the product. */
async function assertVerifiedPurchase(db: Db, userId: string, orderId: string, productId: string): Promise<string> {
  const rows = await db(
    `SELECT 1 FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1 AND o.customer_user_id = $2 AND oi.product_id = $3
       AND o.status IN ('delivered','completed')
     LIMIT 1`,
    [orderId, userId, productId],
  );
  if (!rows[0]) throw new AppError("FORBIDDEN", "ต้องซื้อสินค้านี้จริง (ออเดอร์สำเร็จ) ก่อนรีวิวได้");
  return productId;
}

export async function createReview(
  db: Db,
  input: { userId: string; productId: string; orderId: string; rating: number; title?: string | null; comment?: string | null; images?: string[] },
): Promise<Review> {
  const parsed = reviewInputSchema.parse(input);
  await assertVerifiedPurchase(db, input.userId, parsed.orderId, parsed.productId);

  const product = await db("SELECT shop_id FROM products WHERE id = $1", [parsed.productId]);
  if (!product[0]) throw new AppError("PRODUCT_NOT_FOUND");

  const rows = await db(
    `INSERT INTO reviews (product_id, shop_id, user_id, order_id, rating, title, comment, images, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'published')
     ON CONFLICT (user_id, product_id, order_id) DO UPDATE SET
       rating = EXCLUDED.rating, title = EXCLUDED.title, comment = EXCLUDED.comment,
       images = EXCLUDED.images, updated_at = now()
     RETURNING *`,
    [
      parsed.productId,
      product[0].shop_id,
      input.userId,
      parsed.orderId,
      parsed.rating,
      parsed.title ?? null,
      parsed.comment ?? null,
      JSON.stringify(parsed.images),
    ],
  );
  return mapReview(rows[0]);
}

export async function listReviewsByProduct(db: Db, productId: string, limit = 20): Promise<Review[]> {
  const rows = await db(
    `SELECT r.*, u.name AS user_name
     FROM reviews r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND r.status = 'published'
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [productId, limit],
  );
  return rows.map(mapReview);
}

export async function listReviewsByShop(db: Db, shopId: string, limit = 20): Promise<Review[]> {
  const rows = await db(
    `SELECT r.*, u.name AS user_name
     FROM reviews r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.shop_id = $1 AND r.status = 'published'
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [shopId, limit],
  );
  return rows.map(mapReview);
}

/** Aggregate rating for a product (from published reviews). */
export async function productRating(db: Db, productId: string): Promise<{ avg: number; count: number }> {
  const rows = await db(
    `SELECT COALESCE(AVG(rating), 0)::float8 AS avg, COUNT(*)::int AS count
     FROM reviews WHERE product_id = $1 AND status = 'published'`,
    [productId],
  );
  return { avg: Number(rows[0].avg), count: Number(rows[0].count) };
}
