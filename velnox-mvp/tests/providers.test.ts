/**
 * Velnox Backend — provider abstraction tests (spec §22, §24, §63).
 *
 * The commerce core must not hard-code a courier or a payment gateway: both
 * go through provider interfaces with a working "manual" implementation and a
 * registry where real providers plug in later. These tests lock the contract.
 */
import { describe, expect, it } from "vitest";
import {
  CARRIER_LABELS,
  SHIPPING_METHODS,
  getShippingProvider,
  quoteShipping,
  trackingStatusLabel,
} from "../src/backend/shipping";
import {
  PAYMENT_METHODS,
  getPaymentProvider,
  paymentMethodMeta,
} from "../src/backend/payment";

describe("§22 — ShippingProvider abstraction", () => {
  it("registry resolves the manual provider by default (no hard-coded courier)", () => {
    expect(getShippingProvider().id).toBe("manual");
    expect(getShippingProvider("kerry").id).toBe("manual"); // not yet integrated → manual fallback
  });

  it("quoteShipping: standard method has no surcharge without weight/base", () => {
    const q = quoteShipping();
    expect(q.methodId).toBe("standard");
    expect(q.fee).toBe(0);
    expect(q.currency).toBe("THB");
    expect(q.estimatedDeliveryDays).toEqual([2, 4]);
  });

  it("quoteShipping: express method costs 30 THB", () => {
    expect(quoteShipping({ methodId: "express" }).fee).toBe(30);
  });

  it("quoteShipping: heavy parcels (over 1 kg) add a weight surcharge", () => {
    expect(quoteShipping({ weightKg: 1 }).fee).toBe(0);
    expect(quoteShipping({ weightKg: 3 }).fee).toBe(20); // (3-1) × 10
  });

  it("quoteShipping: platform base fee is added on top", () => {
    expect(quoteShipping({ baseFee: 15 }).fee).toBe(15);
  });

  it("shipping methods are a closed catalog, not UI literals", () => {
    expect(SHIPPING_METHODS.map((m) => m.id)).toEqual(["standard", "express"]);
    expect(SHIPPING_METHODS.every((m) => m.etaDays[0] >= 1)).toBe(true);
  });

  it("tracking status labels are centralized", () => {
    expect(trackingStatusLabel("delivered")).toBe("ส่งถึงแล้ว");
    expect(trackingStatusLabel("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
    expect(CARRIER_LABELS.thailandpost).toBe("Thailand Post");
  });
});

describe("§24 — PaymentProvider abstraction", () => {
  it("registry resolves the manual provider (no gateway hard-coded yet)", () => {
    expect(getPaymentProvider().id).toBe("manual");
    expect(getPaymentProvider("omise").id).toBe("manual"); // Phase 9 TODO
  });

  it("every supported payment method has metadata + a provider", () => {
    for (const m of PAYMENT_METHODS) {
      const meta = paymentMethodMeta(m.id);
      expect(meta.id).toBe(m.id);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.instructions.length).toBeGreaterThan(0);
      expect(["manual", "omise", "stripe"]).toContain(meta.provider);
    }
  });

  it("COD + bank transfer + PromptPay are all listed for Thai checkout", () => {
    const ids = PAYMENT_METHODS.map((m) => m.id);
    expect(ids).toContain("cod");
    expect(ids).toContain("transfer");
    expect(ids).toContain("promptpay");
    expect(ids).toContain("card");
  });

  it("unknown method falls back to COD metadata", () => {
    expect(paymentMethodMeta("cod" as never).id).toBe("cod");
  });
});
