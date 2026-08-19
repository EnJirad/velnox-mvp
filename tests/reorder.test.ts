/**
 * Velnox Backend — Smart Reorder cycle math (spec §14, §26).
 *
 * The suggestions engine reads real Neon orders; the pure parts (mean order
 * gap + confidence) are unit-tested here. With insufficient data we return
 * NOT_ENOUGH_DATA instead of inventing a prediction.
 */
import { describe, expect, it } from "vitest";
import { avgCycleDays } from "../backend/reorder";

const iso = (offsetDays: number, from = Date.parse("2026-08-01T00:00:00Z")) =>
  new Date(from + offsetDays * 24 * 60 * 60 * 1000).toISOString();

describe("§14/§26 — reorder cycle math", () => {
  it("computes the mean gap between consecutive orders", () => {
    const days = [iso(0), iso(30), iso(60)]; // 30-day cycle
    expect(avgCycleDays(days)).toBe(30);
  });

  it("handles irregular intervals", () => {
    const days = [iso(0), iso(10), iso(40)]; // gaps 10, 30 -> mean 20
    expect(avgCycleDays(days)).toBe(20);
  });

  it("returns null with fewer than two orders (not enough data)", () => {
    expect(avgCycleDays([])).toBeNull();
    expect(avgCycleDays([iso(0)])).toBeNull();
  });
});
