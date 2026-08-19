/**
 * Velnox Backend — Moderation pipeline tests (spec §11–13, §16–17, §37).
 *
 * Covers the pure status rules:
 *   - seller access: only APPROVED sellers can operate the merchant tools
 *   - product publish intent: routed through review (pending_review) unless
 *     the platform auto-approve rule is on
 *   - seller-set table: sellers can never set 'rejected' themselves
 */
import { describe, expect, it } from "vitest";
import {
  SELLER_SETTABLE_PRODUCT_STATUSES,
  resolveProductPublishStatus,
  sellerCanOperate,
} from "../backend/moderation";

describe("§11–12 — seller access gate (server-side)", () => {
  it("only approved sellers can operate", () => {
    expect(sellerCanOperate("approved")).toBe(true);
  });

  it("pending / rejected / suspended / missing applications are denied", () => {
    expect(sellerCanOperate("pending")).toBe(false);
    expect(sellerCanOperate("under_review")).toBe(false);
    expect(sellerCanOperate("rejected")).toBe(false);
    expect(sellerCanOperate("suspended")).toBe(false);
    expect(sellerCanOperate(null)).toBe(false);
    expect(sellerCanOperate(undefined)).toBe(false);
  });
});

describe("§16–17 — product publish intent goes through review", () => {
  it("publish intent → pending_review when moderation is on (default)", () => {
    expect(resolveProductPublishStatus("published", false)).toBe("pending_review");
  });

  it("publish intent → published when the platform auto-approves", () => {
    expect(resolveProductPublishStatus("published", true)).toBe("published");
    expect(resolveProductPublishStatus("pending_review", true)).toBe("published");
  });

  it("non-publish statuses pass through unchanged", () => {
    expect(resolveProductPublishStatus("draft", false)).toBe("draft");
    expect(resolveProductPublishStatus("draft", true)).toBe("draft");
    expect(resolveProductPublishStatus("archived", false)).toBe("archived");
  });

  it("the seller can never route a product to 'rejected'", () => {
    expect(SELLER_SETTABLE_PRODUCT_STATUSES.has("rejected")).toBe(false);
    expect(SELLER_SETTABLE_PRODUCT_STATUSES.has("published")).toBe(true);
    expect(SELLER_SETTABLE_PRODUCT_STATUSES.has("pending_review")).toBe(true);
  });
});
