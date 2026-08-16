/**
 * Velnox Backend — VelRepeat scheduling tests (spec §26, §33).
 *
 * next_order_date is always computed by the backend (never accepted from the
 * frontend) and must always land in the future based on the chosen frequency.
 */
import { describe, expect, it } from "vitest";
import { computeNextOrderDate } from "../backend/subscriptions";

describe("§33 — VelRepeat next order date", () => {
  const anchor = new Date("2026-08-15T12:00:00Z");

  it("daily → next day", () => {
    expect(computeNextOrderDate("daily", anchor)).toBe("2026-08-16");
  });

  it("weekly → 7 days later", () => {
    expect(computeNextOrderDate("weekly", anchor)).toBe("2026-08-22");
  });

  it("monthly → 30 days later", () => {
    expect(computeNextOrderDate("monthly", anchor)).toBe("2026-09-14");
  });

  it("custom → interval days later (14-day supply cycle)", () => {
    expect(computeNextOrderDate("custom", anchor, 14)).toBe("2026-08-29");
  });

  it("interval is clamped to at least 1 day", () => {
    expect(computeNextOrderDate("custom", anchor, 0)).toBe("2026-08-16");
  });

  it("crosses month/year boundaries correctly", () => {
    expect(computeNextOrderDate("monthly", new Date("2026-12-20T00:00:00Z"))).toBe("2027-01-19");
  });

  it("always returns YYYY-MM-DD (UTC-safe, no timezone drift)", () => {
    const date = computeNextOrderDate("weekly", new Date("2026-08-31T23:59:00Z"));
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(date).toBe("2026-09-07");
  });
});
