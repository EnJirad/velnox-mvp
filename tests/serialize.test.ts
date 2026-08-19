/**
 * Velnox — Central Convex-boundary serializer (systemic Date fix).
 *
 * Convex rejects JS Date objects in returned values. The boundary serializer
 * recursively converts Date -> Unix ms while preserving everything else:
 * arrays, nested objects, null, undefined, strings, numbers, booleans.
 */
import { describe, expect, it } from "vitest";
import { serializeForConvex, serializedAction } from "../convex/lib/serialize";

describe("§boundary — serializeForConvex", () => {
  it("converts a Date to Unix ms", () => {
    const d = new Date("2026-08-16T15:59:55.315Z");
    expect(serializeForConvex(d)).toBe(d.getTime());
  });

  it("leaves primitives untouched", () => {
    expect(serializeForConvex(1)).toBe(1);
    expect(serializeForConvex("2026-08-16T15:59:55.315Z")).toBe("2026-08-16T15:59:55.315Z");
    expect(serializeForConvex(true)).toBe(true);
    expect(serializeForConvex(null)).toBeNull();
    expect(serializeForConvex(undefined)).toBeUndefined();
    expect(serializeForConvex(1.5)).toBe(1.5);
  });

  it("recurses into arrays", () => {
    const d = new Date("2026-08-16T15:59:55.315Z");
    expect(serializeForConvex([d, 1, "x"])).toEqual([d.getTime(), 1, "x"]);
  });

  it("recurses into nested objects", () => {
    const d = new Date("2026-08-16T15:59:55.315Z");
    const input = { createdAt: d, meta: { paidAt: d, label: "ok" }, items: [{ at: d }] };
    expect(serializeForConvex(input)).toEqual({
      createdAt: d.getTime(),
      meta: { paidAt: d.getTime(), label: "ok" },
      items: [{ at: d.getTime() }],
    });
  });

  it("maps undefined object values to null (Convex has no undefined)", () => {
    expect(serializeForConvex({ a: undefined, b: 1 })).toEqual({ a: null, b: 1 });
  });

  it("preserves an empty array and empty object", () => {
    expect(serializeForConvex([])).toEqual([]);
    expect(serializeForConvex({})).toEqual({});
  });

  it("keeps dates inside arrays of objects", () => {
    const d = new Date("2026-08-16T15:59:55.315Z");
    expect(serializeForConvex([{ createdAt: d }])).toEqual([{ createdAt: d.getTime() }]);
  });
});

describe("§boundary — serializedAction is the Convex action builder", () => {
  it("is callable like the generated action builder (returns a registered action)", () => {
    const fn = serializedAction({
      args: {},
      handler: async () => ({ ok: true }),
    });
    expect(fn).toBeDefined();
    expect(typeof fn).toBe("function");
  });
});
