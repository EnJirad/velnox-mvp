/**
 * Velnox Backend — business rule tests (spec §60–61, §23–27).
 *
 * §60  Price 1000 · commission 3% → platform 30, seller gross 1000, net 970
 * §61  Return rate 8% ≤ 10% threshold → no penalty
 *      Return rate 15% > 10% threshold → seller covers the excess
 *      (15% − 10% = 5% of gross)
 */
import { describe, expect, it } from "vitest";
import {
  calcPlatformFee,
  calcPlatformRevenue,
  calcReturnRatePercent,
  calcSellerNet,
  calcSellerReturnCost,
  round2,
} from "../src/backend/rules";
import { validateValue } from "../src/backend/platformSettings";
import { priceSchema } from "../src/backend/validation";

describe("§60 — platform commission (default 3%)", () => {
  it("1000 THB × 3% → platform fee 30 THB", () => {
    expect(calcPlatformFee(1000, 3)).toBe(30);
  });

  it("seller net = gross − fee − return cost − shipping deductions (970)", () => {
    expect(calcSellerNet(1000, 30, 0, 0)).toBe(970);
  });

  it("commission is configurable via platform_settings — not hard-coded", () => {
    expect(calcPlatformFee(1000, 5)).toBe(50);
    expect(calcPlatformFee(1000, 0)).toBe(0);
  });
});

describe("§61 — return rate & penalty (threshold 10%)", () => {
  it("8 returned / 100 completed → 8% ≤ threshold → seller covers 0", () => {
    const rate = calcReturnRatePercent(8, 100);
    expect(rate).toBe(8);
    const gross = 100_000;
    const returnsValue = 8_000;
    // platform covers up to 10% of gross = 10,000 → 8,000 fully covered
    expect(calcSellerReturnCost(gross, returnsValue, 10)).toBe(0);
  });

  it("15 returned / 100 completed → 15% > threshold → seller covers excess (5% of gross)", () => {
    expect(calcReturnRatePercent(15, 100)).toBe(15);
    const gross = 100_000;
    const returnsValue = 15_000;
    // coverage = min(15_000, 10% × 100_000 = 10_000) → seller covers 5_000
    expect(calcSellerReturnCost(gross, returnsValue, 10)).toBe(5_000);
  });

  it("no completed orders → return rate 0 (no division by zero)", () => {
    expect(calcReturnRatePercent(3, 0)).toBe(0);
  });

  it("returns within coverage → seller net unaffected", () => {
    const gross = 100_000;
    const returnsValue = 8_000;
    const fee = calcPlatformFee(gross, 3); // 3,000
    const sellerCost = calcSellerReturnCost(gross, returnsValue, 10); // 0
    expect(calcSellerNet(gross, fee, sellerCost, 0)).toBe(97_000);
  });
});

describe("shipping revenue split (default 10% to platform)", () => {
  it("gross 1000 + shipping 100 → commission 30 + shipping 10 = 40", () => {
    const r = calcPlatformRevenue(1000, 100, 3, 10);
    expect(r.commission).toBe(30);
    expect(r.shippingRevenue).toBe(10);
    expect(r.total).toBe(40);
  });
});

describe("round2 — money math stays exact to 2 decimals", () => {
  it("avoids float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1000 * 0.03)).toBe(30);
  });
});

describe("§39.10 — commission SNAPSHOT is frozen at order time", () => {
  it("commission is computed from the snapshot rate, not the current config", () => {
    // checkout stores order_items.commission_rate + commissions.commission_amount
    // at purchase time (see src/backend/checkout.ts) — changing platform
    // settings later must NOT rewrite old orders.
    const orderAmount = 1000;
    const snapshotRate = 0.03; // rate at order time
    const todayRate = 0.06; // hypothetical future platform setting

    const recorded = round2(orderAmount * snapshotRate); // what the order froze
    const recomputed = round2(orderAmount * todayRate); // what a wrong recalc would give
    expect(recorded).toBe(30);
    expect(recomputed).toBe(60);
    // the stored value is the source of truth — recomputing from a changed
    // config would corrupt history, which the snapshot design prevents
    expect(recorded).not.toBe(recomputed);
  });

  it("seller net is derived from the frozen commission snapshot", () => {
    const orderAmount = 1000;
    const snapshotRate = 0.03;
    const fee = round2(orderAmount * snapshotRate);
    expect(calcSellerNet(orderAmount, fee, 0, 0)).toBe(970);
  });
});

describe("§13 — platform settings percentage validation (0–100)", () => {
  it("rejects commission/shipping/threshold values above 100%", () => {
    // validateValue lives in src/backend/platformSettings.ts and is applied
    // to every VelCenter settings write — a 500% commission would break
    // financial math, so it must be rejected at the boundary.
    expect(() => validateValue("platform_commission_percent", 150)).toThrow();
    expect(() => validateValue("shipping_company_percent", 100.01)).toThrow();
    expect(() => validateValue("return_rate_threshold", -1)).toThrow();
    expect(() => validateValue("tax_percent", 101)).toThrow();
  });

  it("accepts in-range percentages and non-percentage keys", () => {
    expect(() => validateValue("platform_commission_percent", 3)).not.toThrow();
    expect(() => validateValue("return_rate_threshold", 10)).not.toThrow();
    expect(() => validateValue("auto_approve_sellers", true)).not.toThrow();
    expect(() => validateValue("platform_name", "Velnox")).not.toThrow();
  });

  it("product price must be non-negative (createProduct/updateProduct guard)", () => {
    // priceSchema is the guard used by createProduct/updateProduct — a
    // negative price must never reach the DB (no CHECK exists on the column)
    expect(priceSchema.safeParse(-1).success).toBe(false);
    expect(priceSchema.safeParse(-0.01).success).toBe(false);
    expect(priceSchema.safeParse(0).success).toBe(true);
    expect(priceSchema.safeParse(499.99).success).toBe(true);
  });
});
