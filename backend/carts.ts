/**
 * Velnox Backend — Cart (spec §16, §18–19).
 *
 * cart_items snapshot the unit price at add-to-cart time; checkout re-validates
 * price + stock against the database (spec §16: ราคาที่ checkout ต้องถูกตรวจสอบ
 * ใหม่จาก Backend — ห้ามเชื่อราคาจาก frontend). Multi-seller supported per
 * line (seller_id + shop_id) so checkout can split per shop (spec §22, §42).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { AppError } from "./errors";
import { getProduct } from "./products";
import { cartItemInputSchema } from "./validation";
import type { Cart, CartItem } from "./types";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function mapCartItem(r: Record<string, any>): CartItem {
  return {
    id: r.id,
    cartId: r.cart_id,
    productId: r.product_id,
    variantId: r.variant_id ?? null,
    sellerId: r.seller_id,
    shopId: r.shop_id,
    quantity: Number(r.quantity),
    priceSnapshot: Number(r.price_snapshot),
    createdAt: r.created_at,
    // joined columns
    productName: r.product_name ?? undefined,
    productImageUrl: r.primary_image_url ?? undefined,
    shopName: r.shop_name ?? undefined,
    availableStock: r.available != null ? Number(r.available) : undefined,
    unit: r.unit ?? undefined,
  };
}

export async function getOrCreateCart(db: Db, userId: string): Promise<Cart> {
  const rows = await db(
    `INSERT INTO carts (user_id, status)
     VALUES ($1, 'active')
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [userId],
  );
  if (rows[0]) return { id: rows[0].id, userId, status: "active", createdAt: rows[0].created_at, updatedAt: rows[0].updated_at };
  const existing = await db("SELECT * FROM carts WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1", [userId]);
  return { id: existing[0].id, userId, status: "active", createdAt: existing[0].created_at, updatedAt: existing[0].updated_at };
}

export async function getActiveCart(db: Db, userId: string): Promise<Cart | null> {
  const cart = await getOrCreateCart(db, userId);
  const rows = await db(
    `SELECT ci.*, p.name AS product_name, p.unit, s.name AS shop_name,
            (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) AS primary_image_url,
            (i.quantity - i.reserved_quantity) AS available
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     JOIN shops s ON s.id = ci.shop_id
     LEFT JOIN inventory i ON i.product_id = ci.product_id AND (i.variant_id IS NULL OR i.variant_id = ci.variant_id)
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cart.id],
  );
  cart.items = rows.map(mapCartItem);
  return cart;
}

export async function addToCart(db: Db, userId: string, input: { productId: string; variantId?: string | null; quantity: number }): Promise<CartItem[]> {
  const parsed = cartItemInputSchema.parse({ ...input, variantId: input.variantId ?? undefined });
  const product = await getProduct(db, parsed.productId);
  if (!product) throw new AppError("PRODUCT_NOT_FOUND");
  if (product.status !== "published") throw new AppError("OUT_OF_STOCK", `สินค้า ${product.name} ไม่ได้วางขาย`);

  // stock check (product-level availability)
  const inv = await db(
    `SELECT quantity - reserved_quantity AS available FROM inventory WHERE product_id = $1 AND variant_id IS NULL LIMIT 1`,
    [product.id],
  );
  const available = inv[0] ? Number(inv[0].available) : 0;
  if (available <= 0) throw new AppError("OUT_OF_STOCK", `สินค้า ${product.name} หมดสต็อก`);

  const cart = await getOrCreateCart(db, userId);
  const existing = await db(
    `SELECT id, quantity FROM cart_items
     WHERE cart_id = $1 AND product_id = $2 AND variant_id IS NOT DISTINCT FROM $3`,
    [cart.id, product.id, parsed.variantId ?? null],
  );
  if (existing[0]) {
    const newQty = Number(existing[0].quantity) + parsed.quantity;
    if (newQty > available) throw new AppError("INSUFFICIENT_STOCK", `มีสินค้าในตะกร้าเกินสต็อก (เหลือ ${available})`);
    await db("UPDATE cart_items SET quantity = $2, updated_at = now() WHERE id = $1", [existing[0].id, newQty]);
  } else {
    if (parsed.quantity > available) throw new AppError("INSUFFICIENT_STOCK", `สินค้า ${product.name} มีสต็อกไม่พอ (เหลือ ${available})`);
    await db(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, seller_id, shop_id, quantity, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cart.id, product.id, parsed.variantId ?? null, product.sellerId, product.shopId, parsed.quantity, product.price],
    );
  }
  return (await getActiveCart(db, userId))?.items ?? [];
}

export async function updateCartItemQuantity(db: Db, userId: string, cartItemId: string, quantity: number): Promise<CartItem[]> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("INVALID_INPUT", "จำนวนต้องเป็นเลขจำนวนเต็ม >= 1");
  const cart = await getOrCreateCart(db, userId);
  const row = await db("SELECT * FROM cart_items WHERE id = $1 AND cart_id = $2", [cartItemId, cart.id]);
  if (!row[0]) throw new AppError("NOT_FOUND", "ไม่พบสินค้าในตะกร้า");

  const inv = await db(
    `SELECT quantity - reserved_quantity AS available FROM inventory WHERE product_id = $1 AND variant_id IS NULL LIMIT 1`,
    [row[0].product_id],
  );
  const available = inv[0] ? Number(inv[0].available) : 0;
  if (quantity > available) throw new AppError("INSUFFICIENT_STOCK", `สินค้ามีสต็อกไม่พอ (เหลือ ${available})`);

  await db("UPDATE cart_items SET quantity = $2, updated_at = now() WHERE id = $1", [cartItemId, quantity]);
  return (await getActiveCart(db, userId))?.items ?? [];
}

export async function removeCartItem(db: Db, userId: string, cartItemId: string): Promise<CartItem[]> {
  const cart = await getOrCreateCart(db, userId);
  await db("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [cartItemId, cart.id]);
  return (await getActiveCart(db, userId))?.items ?? [];
}

export async function clearCart(db: Db, userId: string): Promise<void> {
  const cart = await getOrCreateCart(db, userId);
  await db("DELETE FROM cart_items WHERE cart_id = $1", [cart.id]);
}

/** Mark the cart as checked out (called inside the checkout transaction). */
export async function markCartCheckedOut(db: Db, cartId: string): Promise<void> {
  await db("UPDATE carts SET status = 'checked_out', updated_at = now() WHERE id = $1", [cartId]);
}
