/**
 * Velnox — Customer Memory Core unit tests (vitest)
 *
 * Covers the deterministic CPNS rules: event weights (§10), time decay (§11),
 * purchase intent (§10) and the guest → account merge dedup (§5 / §8).
 * The logic under test is pure (no Convex runtime), matching the spec's
 * "deterministic rule-based scoring first, ML later" principle (§44).
 */
import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  DEFAULT_HALF_LIFE_DAYS,
  EVENT_HALF_LIFE,
  decay,
  estimateIntent,
  eventKey,
  eventWeight,
  interestContribution,
  planAnonymousMerge,
} from "./customer-memory-core";

const now = Date.now();

describe("event weights (CPNS §10)", () => {
  it("orders signals by behavioural strength", () => {
    expect(eventWeight("PURCHASE")).toBeGreaterThan(eventWeight("CART_ADD"));
    expect(eventWeight("CART_ADD")).toBeGreaterThan(eventWeight("WISHLIST_ADD"));
    expect(eventWeight("WISHLIST_ADD")).toBeGreaterThan(eventWeight("INTEREST"));
    expect(eventWeight("INTEREST")).toBeGreaterThan(eventWeight("PRODUCT_VIEW"));
    expect(eventWeight("PRODUCT_VIEW")).toBeGreaterThan(eventWeight("PRODUCT_CLICK"));
  });

  it("treats unknown / measurement-only types as zero-weight", () => {
    expect(eventWeight("RECOMMENDATION_CLICK")).toBe(0);
    expect(eventWeight("VELREPEAT_CANCEL")).toBe(0);
    expect(eventWeight("NONSENSE")).toBe(0);
  });

  it("weighs a confirmed purchase above every other signal", () => {
    expect(eventWeight("PURCHASE")).toBeGreaterThanOrEqual(10);
    expect(eventWeight("PURCHASE")).toBeGreaterThan(eventWeight("VELREPEAT_START"));
  });
});

describe("time decay (CPNS §11)", () => {
  it("starts at full weight at the moment of the event", () => {
    expect(decay("PRODUCT_VIEW", now, now)).toBeCloseTo(1, 9);
  });

  it("halves after exactly one half-life", () => {
    const createdAt = now - EVENT_HALF_LIFE.PRODUCT_VIEW * DAY_MS;
    expect(decay("PRODUCT_VIEW", createdAt, now)).toBeCloseTo(0.5, 9);
  });

  it("quarters after two half-lives", () => {
    const createdAt = now - 2 * EVENT_HALF_LIFE.PRODUCT_VIEW * DAY_MS;
    expect(decay("PRODUCT_VIEW", createdAt, now)).toBeCloseTo(0.25, 9);
  });

  it("never decays below zero and ignores future timestamps", () => {
    expect(decay("PRODUCT_VIEW", now - 1000 * DAY_MS, now)).toBeGreaterThan(0);
    expect(decay("PRODUCT_VIEW", now + DAY_MS, now)).toBe(1);
  });

  it("keeps recent interest stronger than old interest", () => {
    const recent = decay("PRODUCT_VIEW", now - 5 * DAY_MS, now);
    const old = decay("PRODUCT_VIEW", now - 60 * DAY_MS, now);
    expect(recent).toBeGreaterThan(old);
  });

  it("fades strong purchase signals slower than light views", () => {
    const purchase = decay("PURCHASE", now - 30 * DAY_MS, now);
    const view = decay("PRODUCT_VIEW", now - 30 * DAY_MS, now);
    expect(purchase).toBeGreaterThan(view);
  });

  it("uses the default half-life for unknown types", () => {
    const createdAt = now - DEFAULT_HALF_LIFE_DAYS * DAY_MS;
    expect(decay("RECOMMENDATION_CLICK", createdAt, now)).toBeCloseTo(0.5, 9);
  });

  it("contributes weight × decay", () => {
    const createdAt = now - 30 * DAY_MS;
    expect(interestContribution("PURCHASE", createdAt, now)).toBeCloseTo(
      eventWeight("PURCHASE") * decay("PURCHASE", createdAt, now),
      9,
    );
  });
});

describe("purchase intent (CPNS §10)", () => {
  it("a single browse never reads as buying intent", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 1, wishlistCount: 0, checkoutCount: 0 })).toBe("low");
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("low");
  });

  it("any strong signal moves intent to medium", () => {
    expect(estimateIntent({ purchaseCount: 1, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("medium");
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 1, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("medium");
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 1, checkoutCount: 0 })).toBe("medium");
  });

  it("repeated purchases escalate to high", () => {
    expect(estimateIntent({ purchaseCount: 3, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("high");
  });

  it("heavy browsing plus cart activity is high intent", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 5, viewCount: 10, wishlistCount: 0, checkoutCount: 0 })).toBe("high");
    // ...but heavy browsing alone is not
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 50, wishlistCount: 0, checkoutCount: 0 })).toBe("low");
  });

  it("wishlists and checkout starts signal high intent", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 3, checkoutCount: 0 })).toBe("high");
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 2 })).toBe("high");
  });
});

describe("event identity + guest merge (CPNS §5 / §8)", () => {
  it("keys events by type + entity + value", () => {
    expect(eventKey("PRODUCT_VIEW", "p1")).toBe(eventKey("PRODUCT_VIEW", "p1"));
    expect(eventKey("PRODUCT_VIEW", "p1")).not.toBe(eventKey("PRODUCT_VIEW", "p2"));
    expect(eventKey("SEARCH", undefined, "coffee")).not.toBe(eventKey("SEARCH", undefined, "tea"));
    expect(eventKey("PRODUCT_VIEW", "p1")).not.toBe(eventKey("CART_ADD", "p1"));
  });

  it("merges anonymous history into the account without duplicates", () => {
    const anon = [
      { _id: "a1", type: "PRODUCT_VIEW", entityId: "p1" },
      { _id: "a2", type: "SEARCH", value: "coffee" },
      { _id: "a3", type: "PRODUCT_VIEW", entityId: "p1" }, // dup of a1
    ];
    const user = [{ _id: "u1", type: "WISHLIST_ADD", entityId: "p2" }];

    const { toMerge, toDrop } = planAnonymousMerge(anon, user);
    expect(toMerge.map((e) => e._id)).toEqual(["a1", "a2"]);
    expect(toDrop.map((e) => e._id)).toEqual(["a3"]);
  });

  it("drops anonymous events the account already has (no double counting)", () => {
    const anon = [{ _id: "a1", type: "PURCHASE", entityId: "p9" }];
    const user = [{ _id: "u1", type: "PURCHASE", entityId: "p9" }];
    const { toMerge, toDrop } = planAnonymousMerge(anon, user);
    expect(toMerge).toHaveLength(0);
    expect(toDrop).toHaveLength(1);
  });

  it("is idempotent — a second pass over already-merged rows merges nothing", () => {
    const anon = [{ _id: "a1", type: "PRODUCT_VIEW", entityId: "p1" }];
    const first = planAnonymousMerge(anon, []);
    // after the first pass the row now belongs to the user
    const second = planAnonymousMerge(first.toMerge, [{ _id: "a1", type: "PRODUCT_VIEW", entityId: "p1" }]);
    expect(second.toMerge).toHaveLength(0);
    expect(second.toDrop).toHaveLength(1);
  });

  it("keeps distinct events from both identities", () => {
    const anon = [{ _id: "a1", type: "SEARCH", value: "soap" }];
    const user = [{ _id: "u1", type: "SEARCH", value: "shampoo" }];
    const { toMerge, toDrop } = planAnonymousMerge(anon, user);
    expect(toMerge).toHaveLength(1);
    expect(toDrop).toHaveLength(0);
  });
});
