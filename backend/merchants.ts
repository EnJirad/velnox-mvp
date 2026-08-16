/**
 * Backward-compatibility shim — "Merchant" has been renamed to "Seller"
 * across Velnox (see ARCHITECTURE_V3_MIGRATION.md). This module keeps the old
 * names working for any consumer that hasn't migrated yet; new code must use
 * `src/backend/sellers.ts` and the Seller naming.
 *
 * @deprecated use ./sellers (Seller / sellerId / getSellerByOwner / ...)
 */
import type { Db } from "./db";
import {
  createSeller,
  createShop,
  findOrCreateUser,
  getSellerById,
  getSellerByOwner,
  getShopById,
  getShopBySlug,
  getUserByConvexId,
  listShopsBySeller,
  updateShop,
  updateUserRole,
} from "./sellers";

export { findOrCreateUser, getUserByConvexId, updateUserRole, createShop, getShopById, getShopBySlug, updateShop };

/** @deprecated use getSellerByOwner */
export const getMerchantByOwner = getSellerByOwner;
/** @deprecated use getSellerById */
export const getMerchantById = getSellerById;
/** @deprecated use createSeller */
export const createMerchant = createSeller;
/** @deprecated use listShopsBySeller */
export const listShopsByMerchant = listShopsBySeller;

export type { Db };
