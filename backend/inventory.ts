/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Inventory
 * Inventory is a separate entity from Product (supports multiple warehouses later).
 *
 * Stock lifecycle:
 *   quantity (on-hand)  ─reserve─▶  reservedQuantity  ─deduct─▶  sold (gone)
 *                                        │
 *                                        └─release─▶ back to quantity (cancel)
 */
import type { Db } from "./db";
import type { Inventory } from "./types";

export class InsufficientStockError extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for product ${productId}: requested ${requested}, available ${available}`);
    this.name = "InsufficientStockError";
  }
}

function mapInventory(r: Record<string, any>): Inventory {
  const quantity = Number(r.quantity);
  const reserved = Number(r.reserved_quantity);
  return {
    id: r.id,
    productId: r.product_id,
    shopId: r.shop_id,
    quantity,
    reservedQuantity: reserved,
    reorderLevel: Number(r.reorder_level),
    warehouse: r.warehouse,
    available: quantity - reserved,
  };
}

export async function getInventory(db: Db, productId: string): Promise<Inventory | null> {
  const rows = await db("SELECT * FROM inventory WHERE product_id = $1 LIMIT 1", [productId]);
  return rows[0] ? mapInventory(rows[0]) : null;
}

/**
 * Ensure an inventory row exists for a product (created with the product).
 * Keeps Product and Inventory as separate entities while guaranteeing a row.
 */
export async function ensureInventory(db: Db, productId: string, shopId: string): Promise<Inventory> {
  const rows = await db(
    `INSERT INTO inventory (product_id, shop_id, quantity)
     VALUES ($1, $2, 0)
     ON CONFLICT (product_id) DO UPDATE SET shop_id = EXCLUDED.shop_id
     RETURNING *`,
    [productId, shopId],
  );
  return mapInventory(rows[0]);
}

/** Set the on-hand stock level (e.g. after a stock count / restock). */
export async function setStock(db: Db, productId: string, quantity: number): Promise<Inventory> {
  if (quantity < 0) throw new Error("quantity must be >= 0");
  const product = await db("SELECT shop_id FROM products WHERE id = $1 LIMIT 1", [productId]);
  if (!product[0]) throw new Error(`Product ${productId} not found`);
  await ensureInventory(db, productId, product[0].shop_id);
  const rows = await db(
    `UPDATE inventory SET quantity = $2, updated_at = now() WHERE product_id = $1 RETURNING *`,
    [productId, quantity],
  );
  return mapInventory(rows[0]);
}

export async function setReorderLevel(db: Db, productId: string, reorderLevel: number): Promise<Inventory> {
  const rows = await db(
    `UPDATE inventory SET reorder_level = $2 WHERE product_id = $1 RETURNING *`,
    [productId, reorderLevel],
  );
  if (!rows[0]) throw new Error(`No inventory row for product ${productId}`);
  return mapInventory(rows[0]);
}

/**
 * Reserve `quantity` units (when an order is placed).
 * Atomic: only succeeds if enough is available; fails otherwise.
 */
export async function reserve(db: Db, productId: string, quantity: number): Promise<Inventory> {
  const rows = await db(
    `UPDATE inventory
     SET reserved_quantity = reserved_quantity + $2
     WHERE product_id = $1 AND quantity - reserved_quantity >= $2
     RETURNING *`,
    [productId, quantity],
  );
  if (!rows[0]) {
    const current = await getInventory(db, productId);
    throw new InsufficientStockError(productId, quantity, current ? current.available : 0);
  }
  return mapInventory(rows[0]);
}

/** Release reserved units back (order cancelled before payment/shipment). */
export async function release(db: Db, productId: string, quantity: number): Promise<Inventory> {
  const rows = await db(
    `UPDATE inventory
     SET reserved_quantity = GREATEST(reserved_quantity - $2, 0)
     WHERE product_id = $1
     RETURNING *`,
    [productId, quantity],
  );
  if (!rows[0]) throw new Error(`No inventory row for product ${productId}`);
  return mapInventory(rows[0]);
}

/**
 * Move reserved units out of stock (payment confirmed / order shipped):
 *   quantity -= q, reserved_quantity -= q
 */
export async function deduct(db: Db, productId: string, quantity: number): Promise<Inventory> {
  const rows = await db(
    `UPDATE inventory
     SET quantity = quantity - $2,
         reserved_quantity = GREATEST(reserved_quantity - $2, 0)
     WHERE product_id = $1 AND quantity >= $2 AND reserved_quantity >= $2
     RETURNING *`,
    [productId, quantity],
  );
  if (!rows[0]) {
    const current = await getInventory(db, productId);
    throw new InsufficientStockError(productId, quantity, current ? current.reservedQuantity : 0);
  }
  return mapInventory(rows[0]);
}

/** Products at or below their reorder level (Smart Reorder). */
export async function listLowStock(db: Db, shopId: string): Promise<Inventory[]> {
  const rows = await db(
    `SELECT * FROM inventory
     WHERE shop_id = $1 AND quantity <= reorder_level
     ORDER BY (quantity - reorder_level) ASC`,
    [shopId],
  );
  return rows.map(mapInventory);
}
