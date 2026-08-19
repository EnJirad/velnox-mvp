/**
 * Velnox Backend — Wishlist (spec §20, §48).
 * One wishlist per user; add/remove/toggle products.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { toMs } from "./dates";
import { AppError } from "./errors";
import type { WishlistItem } from "./types";

export async function toggleWishlist(db: Db, userId: string, productId: string): Promise<{ added: boolean }> {
  const wishlist = await getOrCreateWishlist(db, userId);
  const existing = await db("SELECT id FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2", [
    wishlist.id,
    productId,
  ]);
  if (existing[0]) {
    await db("DELETE FROM wishlist_items WHERE id = $1", [existing[0].id]);
    return { added: false };
  }
  await db("INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2)", [wishlist.id, productId]);
  return { added: true };
}

export async function removeWishlistItem(db: Db, userId: string, productId: string): Promise<void> {
  const wishlist = await getOrCreateWishlist(db, userId);
  await db("DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2", [wishlist.id, productId]);
}

export async function isWishlisted(db: Db, userId: string, productId: string): Promise<boolean> {
  const wishlist = await getOrCreateWishlist(db, userId);
  const rows = await db("SELECT 1 FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2 LIMIT 1", [
    wishlist.id,
    productId,
  ]);
  return rows.length > 0;
}

export async function listWishlist(db: Db, userId: string): Promise<WishlistItem[]> {
  const wishlist = await getOrCreateWishlist(db, userId);
  const rows = await db(
    `SELECT wi.id, wi.wishlist_id, wi.product_id, wi.created_at
     FROM wishlist_items wi
     WHERE wi.wishlist_id = $1
     ORDER BY wi.created_at DESC`,
    [wishlist.id],
  );
  return rows.map((r) => ({
    id: r.id,
    wishlistId: r.wishlist_id,
    productId: r.product_id,
    createdAt: toMs(r.created_at),
  }));
}

async function getOrCreateWishlist(db: Db, userId: string): Promise<{ id: string }> {
  const rows = await db(
    `INSERT INTO wishlists (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [userId],
  );
  if (rows[0]) return rows[0];
  throw new AppError("CONFLICT", "ไม่สามารถสร้าง wishlist ได้");
}
