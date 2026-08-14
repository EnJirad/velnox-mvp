/**
 * Velnox Backend — Users / Merchants / Shops
 * Ownership chain: User -> Merchant -> Shop
 */
import type { Db } from "./db";
import type { Merchant, Role, Shop, User } from "./types";

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

function mapMerchant(r: Record<string, any>): Merchant {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    taxId: r.tax_id ?? null,
    status: r.status,
    refundPolicyLimit: Number(r.refund_policy_limit),
    createdAt: r.created_at,
  };
}

function mapShop(r: Record<string, any>): Shop {
  return {
    id: r.id,
    merchantId: r.merchant_id,
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
  const rows = await db(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING *`,
    [userId, role],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// merchants
// ---------------------------------------------------------------------------
export async function getMerchantByOwner(db: Db, ownerUserId: string): Promise<Merchant | null> {
  const rows = await db("SELECT * FROM merchants WHERE owner_user_id = $1 LIMIT 1", [ownerUserId]);
  return rows[0] ? mapMerchant(rows[0]) : null;
}

export async function getMerchantById(db: Db, merchantId: string): Promise<Merchant | null> {
  const rows = await db("SELECT * FROM merchants WHERE id = $1 LIMIT 1", [merchantId]);
  return rows[0] ? mapMerchant(rows[0]) : null;
}

export async function createMerchant(
  db: Db,
  input: { ownerUserId: string; name: string; taxId?: string | null },
): Promise<Merchant> {
  const existing = await getMerchantByOwner(db, input.ownerUserId);
  if (existing) return existing;

  const rows = await db(
    `INSERT INTO merchants (owner_user_id, name, tax_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.ownerUserId, input.name, input.taxId ?? null],
  );
  return mapMerchant(rows[0]);
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

export async function listShopsByMerchant(db: Db, merchantId: string): Promise<Shop[]> {
  const rows = await db(
    "SELECT * FROM shops WHERE merchant_id = $1 ORDER BY created_at DESC",
    [merchantId],
  );
  return rows.map(mapShop);
}

export async function createShop(
  db: Db,
  input: {
    merchantId: string;
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
    `INSERT INTO shops (merchant_id, name, slug, description, image_url, phone, address, commission_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.merchantId,
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
  const rows = await db(
    `UPDATE shops SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ? mapShop(rows[0]) : null;
}
