/**
 * Velnox Backend — Moderation helpers (spec §11–13, §16–17, §36–37).
 *
 * Pure, unit-testable rules for the seller + product review pipelines.
 * Neon stays the source of truth; these functions only decide how a status
 * intent maps to a stored status (and who may operate).
 */
import type { ProductStatus, SellerStatus } from "./types";

/** Only APPROVED sellers may use the merchant tools (server gate). */
export function sellerCanOperate(status: SellerStatus | string | null | undefined): boolean {
  return status === "approved";
}

/**
 * Map a seller's "publish" intent to the stored product status.
 * - draft / archived / rejected-ish flows stay as requested
 * - a publish/submit intent goes to 'pending_review' unless the platform
 *   auto-approve rule is on (then it publishes instantly)
 * Never returns 'rejected' — only velcenter can reject.
 */
export function resolveProductPublishStatus(
  requested: string,
  autoApproveProducts: boolean,
): ProductStatus {
  if (requested === "published" || requested === "pending_review") {
    return autoApproveProducts ? "published" : "pending_review";
  }
  return requested as ProductStatus;
}

/** Statuses a seller is allowed to set themselves (center handles the rest). */
export const SELLER_SETTABLE_PRODUCT_STATUSES = new Set<string>([
  "draft",
  "pending_review",
  "published",
  "archived",
]);
