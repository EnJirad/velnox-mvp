/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Products (+ images + joined inventory)
 *
 * Product = catalog data + current price. Stock lives in the separate
 * `inventory` entity. Product images: the BINARY lives in object storage
 * (Cloudinary via src/backend/storage.ts), Neon `product_images` stores only
 * metadata (url, storage key, alt, sort order, primary flag, dimensions).
 */
import type { Db } from "./db";
import { getStorage, isStorageConfigured } from "./storage";
import type { Product, ProductCategory, ProductImage, ProductStatus } from "./types";
import { ensureInventory, getInventory, setStock } from "./inventory";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// mappers
// ---------------------------------------------------------------------------
function mapProduct(r: Record<string, any>): Product {
  return {
    id: r.id,
    shopId: r.shop_id,
    sellerId: r.seller_id ?? "",
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
    shopName: r.shop_name ?? undefined,
    sellerName: r.seller_name ?? undefined,
  };
}

function mapImage(r: Record<string, any>): ProductImage {
  const storage = isStorageConfigured() ? getStorage() : null;
  const storageKey = r.storage_key ?? (storage ? storage.extractPublicId(r.url) : null);
  const displayUrl = storage && storageKey ? storage.displayUrl(storageKey) : r.url;
  const thumbUrl = storage && storageKey ? storage.thumbUrl(storageKey) : r.url;
  return {
    id: r.id,
    productId: r.product_id,
    url: r.url,
    displayUrl,
    thumbUrl,
    storageProvider: r.storage_provider ?? "cloudinary",
    storageKey,
    alt: r.alt ?? null,
    sortOrder: Number(r.sort_order),
    isPrimary: Boolean(r.is_primary),
    width: r.width != null ? Number(r.width) : null,
    height: r.height != null ? Number(r.height) : null,
    createdAt: r.created_at,
  };
}

/** Attach images (ordered) + primary convenience to a product. */
async function attachImages(db: Db, product: Product): Promise<Product> {
  const rows = await db(
    "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [product.id],
  );
  const images = rows.map(mapImage);
  product.images = images;
  product.primaryImage = images.find((i) => i.isPrimary) ?? images[0] ?? null;
  return product;
}

// ---------------------------------------------------------------------------
// create / update / delete
// ---------------------------------------------------------------------------
export interface CreateProductInput {
  shopId: string;
  name: string;
  description?: string | null;
  category?: ProductCategory;
  unit?: string;
  price: number;
  status?: ProductStatus;
  supplier?: string | null;
  /** initial images — urls in order (first becomes primary) */
  images?: string[];
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
  product.sellerId = (await db("SELECT seller_id FROM shops WHERE id = $1", [product.shopId]))[0]?.seller_id ?? "";

  await ensureInventory(db, product.id, product.shopId);

  if (input.images && input.images.length > 0) {
    for (let i = 0; i < input.images.length; i++) {
      await addProductImage(db, product.id, { url: input.images[i] }, i === 0);
    }
  }

  if (input.initialStock && input.initialStock > 0) {
    await setStock(db, product.id, input.initialStock);
  }
  // return the full product (images + inventory) so callers can use it directly
  return (await getProduct(db, product.id)) ?? product;
}

export async function getProduct(db: Db, productId: string): Promise<Product | null> {
  const rows = await db(
    `SELECT p.*, s.name AS shop_name, sel.name AS seller_name
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     JOIN sellers sel ON sel.id = s.seller_id
     WHERE p.id = $1 LIMIT 1`,
    [productId],
  );
  if (!rows[0]) return null;
  const product = mapProduct(rows[0]);
  const inventory = await getInventory(db, productId);
  product.inventory = inventory ?? undefined;
  return attachImages(db, product);
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
  const rows = await db(`UPDATE products SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] ? getProduct(db, productId) : null;
}

/**
 * Delete a product + its images. Binaries are removed from object storage
 * (best-effort — a storage outage must never block deleting a catalog row).
 */
export async function deleteProduct(db: Db, productId: string): Promise<void> {
  const images = await listProductImages(db, productId);
  await db("DELETE FROM products WHERE id = $1", [productId]);
  if (isStorageConfigured()) {
    const storage = getStorage();
    for (const img of images) {
      if (img.storageKey) {
        try {
          await storage.deleteFile(img.storageKey);
        } catch {
          // storage cleanup is best-effort
        }
      }
    }
  }
}

export interface ListProductsOptions {
  shopId?: string;
  sellerId?: string;
  status?: ProductStatus;
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * List products with inventory + primary image + shop/seller names.
 * The storefront (velshop) calls this with status="published".
 */
export async function listProducts(db: Db, opts: ListProductsOptions = {}): Promise<Product[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (opts.shopId) {
    values.push(opts.shopId);
    where.push(`p.shop_id = $${values.length}`);
  }
  if (opts.sellerId) {
    values.push(opts.sellerId);
    where.push(`s.seller_id = $${values.length}`);
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
    `SELECT p.*, s.name AS shop_name, sel.name AS seller_name,
            i.id AS inventory_id, i.quantity, i.reserved_quantity, i.reorder_level, i.warehouse,
            pi.url AS primary_image_url, pi.storage_key AS primary_image_key,
            pi.storage_provider AS primary_image_provider
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     JOIN sellers sel ON sel.id = s.seller_id
     LEFT JOIN inventory i ON i.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  const products = rows.map((r: Record<string, any>) => {
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
    if (r.primary_image_url) {
      product.primaryImage = mapImage({
        id: "",
        product_id: product.id,
        url: r.primary_image_url,
        storage_key: r.primary_image_key,
        storage_provider: r.primary_image_provider,
        sort_order: 0,
        is_primary: true,
      });
    }
    return product;
  });

  // Batch-attach the full image list only when a product has a primary image
  // (keeps the storefront light). Detail view uses getProduct().
  return products;
}

// ---------------------------------------------------------------------------
// product images
// ---------------------------------------------------------------------------
export async function listProductImages(db: Db, productId: string): Promise<ProductImage[]> {
  const rows = await db(
    "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [productId],
  );
  return rows.map(mapImage);
}

export interface AddImageInput {
  url: string;
  storageProvider?: string;
  storageKey?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Persist image metadata for a product. The first image of a product becomes
 * the primary automatically. sort_order = end of the current list.
 */
export async function addProductImage(
  db: Db,
  productId: string,
  input: AddImageInput,
  forcePrimary?: boolean,
): Promise<ProductImage> {
  const existing = await db(
    "SELECT COUNT(*)::int AS n, COALESCE(MAX(sort_order), -1)::int AS max_sort FROM product_images WHERE product_id = $1",
    [productId],
  );
  const count = existing[0]?.n ?? 0;
  const sortOrder = (existing[0]?.max_sort ?? -1) + 1;
  const isPrimary = forcePrimary ?? count === 0;

  const rows = await db(
    `INSERT INTO product_images
       (product_id, url, storage_provider, storage_key, alt, sort_order, is_primary, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      productId,
      input.url,
      input.storageProvider ?? "cloudinary",
      input.storageKey ?? null,
      input.alt ?? null,
      sortOrder,
      isPrimary,
      input.width ?? null,
      input.height ?? null,
    ],
  );
  return mapImage(rows[0]);
}

/** Remove an image row; returns it + whether the product still has images. */
export async function deleteProductImage(
  db: Db,
  imageId: string,
): Promise<{ image: ProductImage; remaining: number } | null> {
  const rows = await db("SELECT * FROM product_images WHERE id = $1", [imageId]);
  if (!rows[0]) return null;
  const image = mapImage(rows[0]);

  const productId = image.productId;
  await db("DELETE FROM product_images WHERE id = $1", [imageId]);

  const remainingRows = await db(
    "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [productId],
  );
  const remaining = remainingRows.map(mapImage);

  // keep exactly one primary
  if (!remaining.some((i) => i.isPrimary) && remaining.length > 0) {
    await db("UPDATE product_images SET is_primary = true WHERE id = $1", [remaining[0].id]);
  }
  return { image, remaining: remaining.length };
}

export async function setPrimaryProductImage(db: Db, productId: string, imageId: string): Promise<void> {
  await db("UPDATE product_images SET is_primary = false WHERE product_id = $1", [productId]);
  const rows = await db(
    `UPDATE product_images SET is_primary = true WHERE id = $1 AND product_id = $2 RETURNING id`,
    [imageId, productId],
  );
  if (!rows[0]) throw new Error("Image not found for this product");
}

/** Reorder a product's images by the given ordered ids (position = index). */
export async function reorderProductImages(db: Db, productId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db(
      `UPDATE product_images SET sort_order = $3 WHERE id = $1 AND product_id = $2`,
      [orderedIds[i], productId, i],
    );
  }
}

/** Legacy helper: replace all images from plain urls (first = primary). */
export async function setProductImages(db: Db, productId: string, urls: string[]): Promise<ProductImage[]> {
  await db("DELETE FROM product_images WHERE product_id = $1", [productId]);
  for (let i = 0; i < urls.length; i++) {
    await addProductImage(db, productId, { url: urls[i] }, i === 0);
  }
  return listProductImages(db, productId);
}
