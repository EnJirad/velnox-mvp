/**
 * Velnox Backend — address normalization tests.
 *
 * Regression for the production bug:
 *   [CONVEX customer:saveAddress] Server Error:
 *   null value in column "city" of relation "addresses" violates not-null constraint
 *
 * Root cause: `addresses.city` is TEXT NOT NULL, but the address data flow
 * (validation schema → Convex action → INSERT/UPDATE) never provided `city`.
 * The fix adds normalizeAddressInput() at the service layer: for Thailand the
 * `city` column holds the province (legacy mapping: city -> province), so city
 * is derived as explicit city > province > existing city (on update), and a
 * missing city fails fast with a user-friendly AppError instead of a raw
 * PostgreSQL error.
 */
import { describe, expect, it } from "vitest";
import { AppError } from "../backend/errors";
import { normalizeAddressInput } from "../backend/addresses";
import { addressInputSchema } from "../backend/validation";

const base = {
  recipientName: "สมชาย",
  phone: "0812345678",
  line1: "1 ถนนสุขุมวิท",
};

describe("normalizeAddressInput — city NOT NULL contract (§4, §7, §9)", () => {
  it("derives city from the province for a Thai address (create)", () => {
    const parsed = addressInputSchema.parse({ ...base, province: "กรุงเทพมหานคร" });
    const out = normalizeAddressInput(parsed);
    expect(out.city).toBe("กรุงเทพมหานคร");
  });

  it("prefers an explicit city over the province", () => {
    const parsed = addressInputSchema.parse({
      ...base,
      city: "Bangkok",
      province: "กรุงเทพมหานคร",
    });
    const out = normalizeAddressInput(parsed);
    expect(out.city).toBe("Bangkok");
  });

  it("throws a user-friendly error when no city can be derived (never SQL NOT NULL)", () => {
    const parsed = addressInputSchema.parse(base);
    expect(() => normalizeAddressInput(parsed)).toThrow(AppError);
    try {
      normalizeAddressInput(parsed);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe("INVALID_INPUT");
      expect(appErr.message).toContain("เมือง");
    }
  });

  it("preserves the existing city on a partial update (edit must not null fields)", () => {
    const parsed = addressInputSchema.parse({ ...base, phone: "0899999999" });
    const out = normalizeAddressInput(parsed, { city: "เชียงใหม่", province: "เชียงใหม่" });
    expect(out.city).toBe("เชียงใหม่");
  });

  it("follows a changed province on edit (city stays in sync with province)", () => {
    const parsed = addressInputSchema.parse({ ...base, province: "เชียงใหม่" });
    const out = normalizeAddressInput(parsed, { city: "กรุงเทพมหานคร", province: "กรุงเทพมหานคร" });
    expect(out.city).toBe("เชียงใหม่");
  });

  it("trims whitespace and rejects a blank city", () => {
    const parsed = addressInputSchema.parse({ ...base, province: "   " });
    expect(() => normalizeAddressInput(parsed)).toThrow(AppError);
  });

  it("is rejected by the schema when city is too long (validation layer)", () => {
    expect(
      addressInputSchema.safeParse({ ...base, city: "x".repeat(121) }).success,
    ).toBe(false);
  });
});
