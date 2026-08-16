/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Users / Sellers / Shops
 * Ownership chain: User -> Seller -> Shop
 */
import type { Db } from "./db";
import type { Role, Seller, Shop, User } from "./types";

// ---------------------------------------------------------------------------
// row mappers
// ---------------------------------------------------------------------------
function mapUser(r: Record<string, any>): User {
  return {
    id: r.id,
    convexId: r.convex_id ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    name: r.name ?? null,
    role: r.role,
    department: r.department ?? null,
    createdAt: r.created_at,
  };
}

function mapSeller(r: Record<string, any>): Seller {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    taxId: r.tax_id ?? null,
    status: r.status,
    rejectionReason: r.rejection_reason ?? null,
    refundPolicyLimit: Number(r.refund_policy_limit),
    createdAt: r.created_at,
  };
}

function mapShop(r: Record<string, any>): Shop {
  return {
    id: r.id,
    sellerId: r.seller_id,
    name: r.name,
    slug: r.slug ?? null,
    description: r.description ?? null,
    imageUrl: r.image_url ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    announcement: r.announcement ?? null,
    status: r.status,
    commissionRate: Number(r.commission_rate),
    currency: r.currency,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
/** Upsert a user row keyed by the Convex auth id (auth stays in Convex). */
export async function findOrCreateUser(
  db: Db,
  input: { convexId: string; email?: string | null; name?: string | null; role?: Role },
): Promise<User> {
  const existing = await db("SELECT * FROM users WHERE convex_id = $1 LIMIT 1", [input.convexId]);
  if (existing[0]) return mapUser(existing[0]);

  const rows = await db(
    `INSERT INTO users (convex_id, email, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (convex_id) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, users.email),
       name  = COALESCE(EXCLUDED.name, users.name)
     RETURNING *`,
    [input.convexId, input.email ?? null, input.name ?? null, input.role ?? "customer"],
  );
  return mapUser(rows[0]);
}

export async function getUserByConvexId(db: Db, convexId: string): Promise<User | null> {
  const rows = await db("SELECT * FROM users WHERE convex_id = $1 LIMIT 1", [convexId]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateUserRole(db: Db, userId: string, role: Role): Promise<User | null> {
  const rows = await db(`UPDATE users SET role = $2 WHERE id = $1 RETURNING *`, [userId, role]);
  return rows[0] ? mapUser(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// sellers
// ---------------------------------------------------------------------------
export async function getSellerByOwner(db: Db, ownerUserId: string): Promise<Seller | null> {
  const rows = await db("SELECT * FROM sellers WHERE owner_user_id = $1 LIMIT 1", [ownerUserId]);
  return rows[0] ? mapSeller(rows[0]) : null;
}

export async function getSellerById(db: Db, sellerId: string): Promise<Seller | null> {
  const rows = await db("SELECT * FROM sellers WHERE id = $1 LIMIT 1", [sellerId]);
  return rows[0] ? mapSeller(rows[0]) : null;
}

export async function createSeller(
  db: Db,
  input: { ownerUserId: string; name: string; taxId?: string | null },
): Promise<Seller> {
  const existing = await getSellerByOwner(db, input.ownerUserId);
  if (existing) return existing;

  const rows = await db(
    `INSERT INTO sellers (owner_user_id, name, tax_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.ownerUserId, input.name, input.taxId ?? null],
  );
  return mapSeller(rows[0]);
}

// ---------------------------------------------------------------------------
// shops
// ---------------------------------------------------------------------------
export async function getShopById(db: Db, shopId: string): Promise<Shop | null> {
  const rows = await db("SELECT * FROM shops WHERE id = $1 LIMIT 1", [shopId]);
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function getShopBySlug(db: Db, slug: string): Promise<Shop | null> {
  const rows = await db("SELECT * FROM shops WHERE slug = $1 LIMIT 1", [slug]);
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function listShopsBySeller(db: Db, sellerId: string): Promise<Shop[]> {
  const rows = await db(
    "SELECT * FROM shops WHERE seller_id = $1 ORDER BY created_at DESC",
    [sellerId],
  );
  return rows.map(mapShop);
}

export async function createShop(
  db: Db,
  input: {
    sellerId: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    phone?: string | null;
    address?: string | null;
    commissionRate?: number;
  },
): Promise<Shop> {
  const rows = await db(
    `INSERT INTO shops (seller_id, name, slug, description, image_url, phone, address, commission_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.sellerId,
      input.name,
      input.slug ?? null,
      input.description ?? null,
      input.imageUrl ?? null,
      input.phone ?? null,
      input.address ?? null,
      input.commissionRate ?? 0.03,
    ],
  );
  return mapShop(rows[0]);
}

export interface ShopLocationInput {
  latitude: number | null;
  longitude: number | null;
}

/**
 * Set the shop's storefront location (lat/long) — used for pickup, return
 * shipping and delivery-area validation (spec §11, §21). GPS must be a valid
 * pair (validated by the caller through gpsSchema).
 */
export async function updateShopLocation(db: Db, shopId: string, input: ShopLocationInput): Promise<Shop | null> {
  const rows = await db(
    `UPDATE shops SET latitude = $2, longitude = $3 WHERE id = $1 RETURNING *`,
    [shopId, input.latitude, input.longitude],
  );
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function updateShop(
  db: Db,
  shopId: string,
  patch: Partial<Pick<Shop, "name" | "description" | "imageUrl" | "phone" | "address" | "announcement" | "status">>,
): Promise<Shop | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const allowed: Record<string, string> = {
    name: "name",
    description: "description",
    imageUrl: "image_url",
    phone: "phone",
    address: "address",
    announcement: "announcement",
    status: "status",
  };
  for (const [key, col] of Object.entries(allowed)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = $${sets.length + 1}`);
      values.push(val);
    }
  }
  if (sets.length === 0) return getShopById(db, shopId);
  values.push(shopId);
  const rows = await db(`UPDATE shops SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  return rows[0] ? mapShop(rows[0]) : null;
}
