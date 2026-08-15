/**
 * Velnox Backend — order state machine tests (spec §18).
 *
 * pending → confirmed → shipped → delivered → completed
 * pending → cancelled, confirmed → cancelled
 * shipped/delivered/completed → cancelled NOT allowed (use refund flow)
 */
import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus } from "../src/backend/orders";

describe("§18 — order status transitions", () => {
  it("happy path pending → confirmed → shipped → delivered → completed", () => {
    expect(canTransitionOrderStatus("pending", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "delivered")).toBe(true);
    expect(canTransitionOrderStatus("delivered", "completed")).toBe(true);
  });

  it("cancellation allowed only before shipping", () => {
    expect(canTransitionOrderStatus("pending", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "cancelled")).toBe(false);
    expect(canTransitionOrderStatus("delivered", "cancelled")).toBe(false);
    expect(canTransitionOrderStatus("completed", "cancelled")).toBe(false);
  });

  it("skipping steps is forbidden", () => {
    expect(canTransitionOrderStatus("pending", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("pending", "completed")).toBe(false);
    expect(canTransitionOrderStatus("confirmed", "delivered")).toBe(false);
    expect(canTransitionOrderStatus("shipped", "completed")).toBe(false);
  });

  it("terminal states are locked", () => {
    expect(canTransitionOrderStatus("completed", "delivered")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "pending")).toBe(false);
  });

  it("same status is a no-op (allowed)", () => {
    expect(canTransitionOrderStatus("pending", "pending")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "shipped")).toBe(true);
  });
});
