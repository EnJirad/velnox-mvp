/**
 * Velnox Backend — Addresses (spec §7–8, §62).
 *
 * GPS is REQUIRED for addresses used as shipping addresses (default shipping
 * address must carry latitude/longitude). Validation is enforced here, at the
 * service layer, so no frontend can save a GPS-less shipping address.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { toMs } from "./dates";
import { AppError } from "./errors";
import { addressInputSchema, type AddressInput } from "./validation";
import type { Address } from "./types";

function mapAddress(r: Record<string, any>): Address {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    recipientName: r.recipient_name,
    phone: r.phone,
    line1: r.line1,
    line2: r.line2 ?? null,
    city: r.city ?? "",
    state: r.state ?? null,
    subdistrict: r.subdistrict ?? null,
    district: r.district ?? null,
    province: r.province ?? null,
    postalCode: r.postal_code ?? null,
    country: r.country,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    placeId: r.place_id ?? null,
    isDefault: Boolean(r.is_default),
    createdAt: toMs(r.created_at),
  };
}

export async function listAddresses(db: Db, userId: string): Promise<Address[]> {
  const rows = await db(
    "SELECT * FROM addresses WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC",
    [userId],
  );
  return rows.map(mapAddress);
}

export async function getAddress(db: Db, userId: string, addressId: string): Promise<Address | null> {
  const rows = await db(
    "SELECT * FROM addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1",
    [addressId, userId],
  );
  return rows[0] ? mapAddress(rows[0]) : null;
}

/**
 * Create an address. A default (shipping) address MUST have GPS — enforced
 * here and again at checkout (spec §62).
 */
export async function createAddress(db: Db, userId: string, input: AddressInput): Promise<Address> {
  const parsed = addressInputSchema.parse(input);
  if (parsed.isDefault && (parsed.latitude == null || parsed.longitude == null)) {
    throw new AppError("ADDRESS_GPS_REQUIRED");
  }

  if (parsed.isDefault) {
    await db("UPDATE addresses SET is_default = false WHERE user_id = $1", [userId]);
  }

  const rows = await db(
    `INSERT INTO addresses
       (user_id, label, recipient_name, phone, line1, line2, subdistrict, district,
        province, postal_code, country, latitude, longitude, place_id, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      userId,
      parsed.label,
      parsed.recipientName,
      parsed.phone,
      parsed.line1,
      parsed.line2 ?? null,
      parsed.subdistrict ?? null,
      parsed.district ?? null,
      parsed.province ?? null,
      parsed.postalCode ?? null,
      parsed.country,
      parsed.latitude ?? null,
      parsed.longitude ?? null,
      parsed.placeId ?? null,
      parsed.isDefault,
    ],
  );
  return mapAddress(rows[0]);
}

export async function updateAddress(db: Db, userId: string, addressId: string, input: AddressInput): Promise<Address> {
  const existing = await getAddress(db, userId, addressId);
  if (!existing) throw new AppError("NOT_FOUND", "ไม่พบที่อยู่นี้");
  const parsed = addressInputSchema.parse({ ...existing, ...input });
  if (parsed.isDefault && (parsed.latitude == null || parsed.longitude == null)) {
    throw new AppError("ADDRESS_GPS_REQUIRED");
  }

  if (parsed.isDefault && !existing.isDefault) {
    await db("UPDATE addresses SET is_default = false WHERE user_id = $1", [userId]);
  }

  const rows = await db(
    `UPDATE addresses SET
       label = $3, recipient_name = $4, phone = $5, line1 = $6, line2 = $7,
       subdistrict = $8, district = $9, province = $10, postal_code = $11,
       country = $12, latitude = $13, longitude = $14, place_id = $15, is_default = $16
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      addressId,
      userId,
      parsed.label,
      parsed.recipientName,
      parsed.phone,
      parsed.line1,
      parsed.line2 ?? null,
      parsed.subdistrict ?? null,
      parsed.district ?? null,
      parsed.province ?? null,
      parsed.postalCode ?? null,
      parsed.country,
      parsed.latitude ?? null,
      parsed.longitude ?? null,
      parsed.placeId ?? null,
      parsed.isDefault,
    ],
  );
  return mapAddress(rows[0]);
}

/** Soft delete an address (deleted_at — never hard delete user data). */
export async function deleteAddress(db: Db, userId: string, addressId: string): Promise<void> {
  const existing = await getAddress(db, userId, addressId);
  if (!existing) throw new AppError("NOT_FOUND", "ไม่พบที่อยู่นี้");
  await db("UPDATE addresses SET deleted_at = now() WHERE id = $1", [addressId]);
}

/** Verify an address belongs to the user AND has GPS (used by checkout). */
export async function requireShippingAddress(db: Db, userId: string, addressId: string): Promise<Address> {
  const address = await getAddress(db, userId, addressId);
  if (!address) throw new AppError("NOT_FOUND", "ไม่พบที่อยู่จัดส่ง");
  if (address.latitude == null || address.longitude == null) {
    throw new AppError("ADDRESS_GPS_REQUIRED", "ที่อยู่จัดส่งต้องมีพิกัด GPS — กรุณาเลือกตำแหน่งบนแผนที่");
  }
  return address;
}
