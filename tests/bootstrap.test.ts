/**
 * Velnox Backend — Secure company-owner bootstrap tests (spec §31).
 *
 * Covers the pure bootstrap-secret logic: configuration detection, the
 * constant-time code comparison, and rejection of empty/garbage input.
 * The one-time nature (owner exists -> mechanism disabled) is enforced by
 * the claimOwner mutation's ownerExists guard, not by this helper.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BOOTSTRAP_ENV_VAR,
  BOOTSTRAP_MIN_LENGTH,
  bootstrapConfigured,
  bootstrapSecretMatches,
} from "../backend/bootstrap";

const original = process.env[BOOTSTRAP_ENV_VAR];

describe("§31 — owner bootstrap secret", () => {
  beforeAll(() => {
    process.env[BOOTSTRAP_ENV_VAR] = "bootstrap-secret-7f3c9a1e";
  });
  afterAll(() => {
    if (original === undefined) delete process.env[BOOTSTRAP_ENV_VAR];
    else process.env[BOOTSTRAP_ENV_VAR] = original;
  });

  it("reports configured when a usable secret is set", () => {
    expect(bootstrapConfigured()).toBe(true);
  });

  it("accepts the exact code", async () => {
    expect(await bootstrapSecretMatches("bootstrap-secret-7f3c9a1e")).toBe(true);
  });

  it("rejects a wrong code", async () => {
    expect(await bootstrapSecretMatches("wrong-code")).toBe(false);
  });

  it("rejects empty input", async () => {
    expect(await bootstrapSecretMatches("")).toBe(false);
    expect(await bootstrapSecretMatches("   ")).toBe(false);
  });

  it("rejects when the secret is not configured", async () => {
    delete process.env[BOOTSTRAP_ENV_VAR];
    expect(bootstrapConfigured()).toBe(false);
    expect(await bootstrapSecretMatches("anything")).toBe(false);
    process.env[BOOTSTRAP_ENV_VAR] = "bootstrap-secret-7f3c9a1e";
  });

  it("rejects a too-short secret as unconfigured", () => {
    process.env[BOOTSTRAP_ENV_VAR] = "short";
    expect(process.env[BOOTSTRAP_ENV_VAR].length).toBeLessThan(BOOTSTRAP_MIN_LENGTH);
    expect(bootstrapConfigured()).toBe(false);
    process.env[BOOTSTRAP_ENV_VAR] = "bootstrap-secret-7f3c9a1e";
  });
});
