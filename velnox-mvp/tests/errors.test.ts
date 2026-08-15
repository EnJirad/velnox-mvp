/**
 * Velnox Backend — centralized error contract tests (spec §27–28, Phase 8).
 *
 * Every backend action must throw AppError (stable `code`), never a raw
 * Error, so the API layer can map to a safe user message without leaking
 * internals. This file locks the contract: codes are stable, every code has
 * a safe Thai message, and the helper constructors behave as documented.
 */
import { describe, expect, it } from "vitest";
import {
  AppError,
  authRequired,
  forbidden,
  insufficientStock,
  invalidInput,
  invalidTransition,
  notFound,
} from "../src/backend/errors";

const ALL_CODES = [
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_INPUT",
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "ORDER_NOT_FOUND",
  "SHOP_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "INSUFFICIENT_STOCK",
  "INVALID_STATUS_TRANSITION",
  "PAYMENT_FAILED",
  "ADDRESS_GPS_REQUIRED",
  "CONFLICT",
] as const;

describe("§28 — AppError contract", () => {
  it("every error code has a safe Thai message (no internals leaked)", () => {
    for (const code of ALL_CODES) {
      const err = new AppError(code);
      expect(err.code).toBe(code);
      expect(err.message.length).toBeGreaterThan(0);
      // safe message: Thai UI copy, never a stack trace / SQL / secret
      expect(err.message).not.toMatch(/at \/|\.ts:|SELECT |INSERT |password|secret|key/i);
    }
  });

  it("custom message overrides the default without changing the code", () => {
    const err = new AppError("FORBIDDEN", "สินค้านี้ไม่ใช่ของคุณ");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("สินค้านี้ไม่ใช่ของคุณ");
  });

  it("helper constructors set the right codes", () => {
    expect(authRequired().code).toBe("AUTH_REQUIRED");
    expect(forbidden().code).toBe("FORBIDDEN");
    expect(notFound().code).toBe("NOT_FOUND");
    expect(invalidInput().code).toBe("INVALID_INPUT");
    expect(insufficientStock().code).toBe("INSUFFICIENT_STOCK");
    expect(invalidTransition().code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("AppError is still a real Error (existing catch blocks keep working)", () => {
    expect(new AppError("NOT_FOUND") instanceof Error).toBe(true);
    expect(() => {
      throw new AppError("OUT_OF_STOCK", "สินค้าหมดจากสต็อก");
    }).toThrow("สินค้าหมดจากสต็อก");
  });

  it("ownership / IDOR failures carry an explicit code, not a raw message", () => {
    // The pattern every action uses: `if (!owned) throw new AppError("ORDER_NOT_FOUND", ...)`
    const notYours = new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    const forbiddenShop = new AppError("FORBIDDEN", "ร้านนี้ไม่ใช่ของคุณ");
    expect(notYours.code).toBe("ORDER_NOT_FOUND");
    expect(forbiddenShop.code).toBe("FORBIDDEN");
  });
});
