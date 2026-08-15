/**
 * Velnox Backend — validation tests (spec §8, §37, §53, §62).
 *
 * §62  Shipping address MUST carry GPS: latitude −90..90, longitude −180..180,
 *      and the pair must be present together.
 */
import { describe, expect, it } from "vitest";
import {
  addressInputSchema,
  gpsSchema,
  latitudeSchema,
  longitudeSchema,
  priceSchema,
  ratingSchema,
} from "../src/backend/validation";

describe("§62 — GPS validation", () => {
  it("rejects latitude out of range (−90..90)", () => {
    expect(latitudeSchema.safeParse(91).success).toBe(false);
    expect(latitudeSchema.safeParse(-90.5).success).toBe(false);
    expect(latitudeSchema.safeParse(90).success).toBe(true);
  });

  it("rejects longitude out of range (−180..180)", () => {
    expect(longitudeSchema.safeParse(181).success).toBe(false);
    expect(longitudeSchema.safeParse(-181).success).toBe(false);
    expect(longitudeSchema.safeParse(180).success).toBe(true);
  });

  it("requires latitude and longitude as a pair", () => {
    expect(gpsSchema.safeParse({ latitude: 13.7563, longitude: null }).success).toBe(false);
    expect(gpsSchema.safeParse({ latitude: null, longitude: 100.5018 }).success).toBe(false);
    expect(gpsSchema.safeParse({ latitude: 13.7563, longitude: 100.5018 }).success).toBe(true);
  });

  it("default shipping address without GPS is rejected (spec §7–8, §62)", () => {
    const base = {
      recipientName: "สมชาย",
      phone: "0812345678",
      line1: "1 ถนนสุขุมวิท",
      isDefault: true,
    };
    expect(addressInputSchema.safeParse(base).success).toBe(false);
    expect(
      addressInputSchema.safeParse({ ...base, latitude: 13.7563, longitude: 100.5018 }).success,
    ).toBe(true);
  });

  it("non-default address without GPS is allowed (migration policy) but blocked at checkout", () => {
    // schema permits (legacy addresses keep working) — checkout/requireShippingAddress rejects
    expect(
      addressInputSchema.safeParse({ recipientName: "สมชาย", phone: "0812345678", line1: "1 ถนนสุขุมวิท" })
        .success,
    ).toBe(true);
  });
});

describe("other validation rules (§53)", () => {
  it("rating must be integer 1–5", () => {
    expect(ratingSchema.safeParse(6).success).toBe(false);
    expect(ratingSchema.safeParse(0).success).toBe(false);
    expect(ratingSchema.safeParse(5).success).toBe(true);
    expect(ratingSchema.safeParse(4.5).success).toBe(false);
  });

  it("price must be non-negative", () => {
    expect(priceSchema.safeParse(-1).success).toBe(false);
    expect(priceSchema.safeParse(0).success).toBe(true);
    expect(priceSchema.safeParse(499.5).success).toBe(true);
  });

  it("invalid phone is rejected", () => {
    const base = {
      recipientName: "สมชาย",
      line1: "1 ถนนสุขุมวิท",
      latitude: 13.7563,
      longitude: 100.5018,
    };
    expect(addressInputSchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...base, phone: "0812345678" }).success).toBe(true);
  });
});
