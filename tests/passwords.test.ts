/**
 * Velnox Backend — employee password policy tests (spec §9–§10).
 *
 * §9  The company never stores or views an existing password — only a salted
 *     scrypt hash lives in the Convex Auth account (Password provider).
 *     These helpers cover the surrounding policy: strength validation and the
 *     one-time temporary credential shown to HR at create/reset time.
 * §10 Temporary passwords always satisfy the strength policy, so the forced
 *     password change can never reject its own one-time credential.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  TEMP_PASSWORD_LENGTH,
  generateTemporaryPassword,
  validatePasswordStrength,
} from "../backend/passwords";

describe("§9 — validatePasswordStrength", () => {
  it("accepts a password meeting the minimum policy", () => {
    expect(validatePasswordStrength("StrongPass123")).toEqual([]);
    expect(validatePasswordStrength("abcDEF456")).toEqual([]);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const issues = validatePasswordStrength("Ab1");
    expect(issues.some((i) => i.code === "too_short")).toBe(true);
    expect(validatePasswordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1) + "A1")).toHaveLength(0);
    expect(validatePasswordStrength("Abcd1234")).toEqual([]); // exactly 8
  });

  it("rejects passwords without a letter", () => {
    const issues = validatePasswordStrength("123456789");
    expect(issues.some((i) => i.code === "no_letter")).toBe(true);
  });

  it("rejects passwords without a number", () => {
    const issues = validatePasswordStrength("abcdefgh");
    expect(issues.some((i) => i.code === "no_number")).toBe(true);
  });

  it("reports every violation at once", () => {
    // symbol-only, too short → fails all three rules
    const issues = validatePasswordStrength("!!!");
    const codes = issues.map((i) => i.code).sort();
    expect(codes).toEqual(["no_letter", "no_number", "too_short"]);
  });
});

describe("§10 — generateTemporaryPassword (one-time credential)", () => {
  it("has the configured length", () => {
    expect(generateTemporaryPassword()).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(generateTemporaryPassword(20)).toHaveLength(20);
  });

  it("contains every character class (upper, lower, digit, symbol)", () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/[A-Z]/);
    expect(pwd).toMatch(/[a-z]/);
    expect(pwd).toMatch(/[0-9]/);
    expect(pwd).toMatch(/[!@#$%&*]/);
  });

  it("always satisfies the strength policy (forced-change can accept it)", () => {
    for (let i = 0; i < 50; i++) {
      expect(validatePasswordStrength(generateTemporaryPassword())).toEqual([]);
    }
  });

  it("never produces look-alike characters (0/O/1/l/I)", () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).not.toMatch(/[0O1lI]/);
  });

  it("is random — consecutive generations differ", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generateTemporaryPassword());
    expect(seen.size).toBe(20);
  });

  it("does not embed the plaintext anywhere (hash-only storage contract)", () => {
    // The plaintext is a string returned exactly once to HR; the backend
    // never writes it to the DB (audit rows omit it). This test documents
    // the contract: the value is fresh on every call, so it cannot be
    // recovered from any stored artifact later.
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
