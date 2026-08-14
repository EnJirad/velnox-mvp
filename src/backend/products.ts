/**
 * Velnox Backend — Products (+ images, joined inventory)
 * Product = catalog data + current price. Stock lives in inventory.
 */
import type { Db } from "./db";
import type { Product, ProductCategory, ProductImage, ProductStatus } from "./types";
import { getInventory, setStock } from "./inventory";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function mapProduct(r: Record<string, any>): Product {
  return {
    id: r.id,
    shopId: r.shop_id,
    name: r.name,
    description: r.description ?? null,
    category: r.category,
    unit: r.unit,
    price: Number(r.price),
    currency: r.currency,
    status: r.status,
    supplier: r.supplier ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapImage(r: Record<string, any>): ProductImage {
  return { id: r.id, productId: r.product_id, url: r.url, position: r.position };
}

export interface CreateProductInput {
  shopId: string;
  name: string;
  description?: string | null;
  category?: ProductCategory;
  unit?: string;
  price: number;
  status?: ProductStatus;
  supplier?: string | null;
  images?: string[]; // urls, in order
  initialStock?: number;
}

export async function createProduct(db: Db, input: CreateProductInput): Promise<Product> {
  const rows = await db(
    `INSERT INTO products (shop_id, name, description, category, unit, price, status, supplier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.shopId,
      input.name,
      input.description ?? null,
      input.category ?? "general",
      input.unit ?? "piece",
      round2(input.price),
      input.status ?? "draft",
      input.supplier ?? null,
    ],
  );
  const product = mapProduct(rows[0]);

  if (input.images && input.images.length > 0) {
    for (let i = 0; i < input.images.length; i++) {
      await db(
        `INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)`,
        [product.id, input.images[i], i],
      );
    }
  }

  if (input.initialStock && input.initialStock > 0) {
    await setStock(db, product.id, input.initialStock);
  }
  return product;
}

export async function getProduct(db: Db, productId: string): Promise<Product | null> {
  const rows = await db("SELECT * FROM products WHERE id = $1 LIMIT 1", [productId]);
  if (!rows[0]) return null;
  const product = mapProduct(rows[0]);
  const [images, inventory] = await Promise.all([
    db("SELECT * FROM product_images WHERE product_id = $1 ORDER BY position ASC", [productId]),
    getInventory(db, productId),
  ]);
  product.images = images.map(mapImage);
  product.inventory = inventory ?? undefined;
  return product;
}

export async function updateProduct(
  db: Db,
  productId: string,
  patch: Partial<Pick<Product, "name" | "description" | "category" | "unit" | "price" | "status" | "supplier">>,
): Promise<Product | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = {
    name: "name",
    description: "description",
    category: "category",
    unit: "unit",
    price: "price",
    status: "status",
    supplier: "supplier",
  };
  for (const [key, col] of Object.entries(allowed)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = $${sets.length + 1}`);
      values.push(key === "price" ? round2(Number(val)) : val);
    }
  }
  if (sets.length === 0) return getProduct(db, productId);
  values.push(productId);
  const rows = await db(
    `UPDATE products SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ? mapProduct(rows[0]) : null;
}

export interface ListProductsOptions {
  shopId?: string;
  status?: ProductStatus;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listProducts(db: Db, opts: ListProductsOptions = {}): Promise<Product[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (opts.shopId) {
    values.push(opts.shopId);
    where.push(`p.shop_id = $${values.length}`);
  }
  if (opts.status) {
    values.push(opts.status);
    where.push(`p.status = $${values.length}`);
  }
  if (opts.q) {
    values.push(`%${opts.q}%`);
    where.push(`p.name ILIKE $${values.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  values.push(limit, offset);

  const rows = await db(
    `SELECT p.*, i.id AS inventory_id, i.quantity, i.reserved_quantity, i.reorder_level, i.warehouse
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return rows.map((r: Record<string, any>) => {
    const product = mapProduct(r);
    const quantity = Number(r.quantity);
    const reserved = Number(r.reserved_quantity);
    if (r.quantity !== null) {
      product.inventory = {
        id: r.inventory_id ?? "",
        productId: product.id,
        shopId: r.shop_id,
        quantity,
        reservedQuantity: reserved,
        reorderLevel: Number(r.reorder_level),
        warehouse: r.warehouse ?? "main",
        available: quantity - reserved,
      };
    }
    return product;
  });
}

export async function setProductImages(db: Db, productId: string, urls: string[]): Promise<ProductImage[]> {
  await db("DELETE FROM product_images WHERE product_id = $1", [productId]);
  for (let i = 0; i < urls.length; i++) {
    await db(`INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)`, [
      productId,
      urls[i],
      i,
    ]);
  }
  const rows = await db("SELECT * FROM product_images WHERE product_id = $1 ORDER BY position ASC", [productId]);
  return rows.map(mapImage);
}
