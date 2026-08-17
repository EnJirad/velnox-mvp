/**
 * Velnox — Email OTP auth-flow helper tests (production auth upgrade).
 *
 * These lock the pure client-side logic of the 2-step sign-in: email
 * normalization/validation, masked display, OTP completeness, the resend
 * countdown, and mapping backend errors to safe user-facing kinds. The
 * backend (Convex Auth + convex/auth/emailOtp.ts) remains the source of
 * truth — nothing here can bypass a server-side check.
 */
import { describe, expect, it } from "vitest";
import {
  OTP_MAX_AGE_MS,
  OTP_MAX_ATTEMPTS_HINT,
  RESEND_COUNTDOWN_SECONDS,
  classifySendError,
  classifyVerifyError,
  isCompleteOtp,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  tickResendCountdown,
} from "../packages/shared/src/lib/auth-flow";

/** Realistic error messages as Convex surfaces them to the client. */
const convexWrapped = (msg: string) => new Error(`[CONVEX action(auth:signIn)] ${msg}\n  Called by client`);

describe("normalizeEmail", () => {
  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("lowercases the address (email identity is case-insensitive)", () => {
    expect(normalizeEmail("John.Doe@Example.COM")).toBe("john.doe@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts standard addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("john.doe+tag@gmail.com")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("user name@example.com")).toBe(false);
  });
});

describe("maskEmail", () => {
  it("masks the local part, keeps the domain", () => {
    expect(maskEmail("john.doe@gmail.com")).toBe("j***@gmail.com");
  });

  it("handles single-character local parts", () => {
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("degrades safely for non-email input (never leaks)", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("isCompleteOtp", () => {
  it("accepts exactly 6 digits", () => {
    expect(isCompleteOtp("123456")).toBe(true);
  });

  it("rejects short, long, and non-numeric values", () => {
    expect(isCompleteOtp("")).toBe(false);
    expect(isCompleteOtp("12345")).toBe(false);
    expect(isCompleteOtp("1234567")).toBe(false);
    expect(isCompleteOtp("abcdef")).toBe(false);
    expect(isCompleteOtp("12 456")).toBe(false);
  });
});

describe("classifySendError — email step (requesting the code)", () => {
  it("recognizes the backend rate-limit message", () => {
    expect(
      classifySendError(convexWrapped("ส่งรหัสยืนยันบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง")),
    ).toBe("rateLimited");
  });

  it("recognizes the backend send-failure message", () => {
    expect(
      classifySendError(convexWrapped("ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง")),
    ).toBe("sendFailed");
  });

  it("maps network failures to the network kind", () => {
    expect(classifySendError(new Error("Failed to fetch"))).toBe("network");
    expect(classifySendError(undefined)).toBe("network");
  });

  it("keeps unknown errors generic (never leaks internals)", () => {
    expect(classifySendError(new Error("Unexpected server response"))).toBe("generic");
  });
});

describe("classifyVerifyError — OTP step (submitting the code)", () => {
  it("reports expiry when the client window has passed", () => {
    expect(classifyVerifyError(convexWrapped("Could not verify code"), {
      expired: true,
      attempts: 1,
    })).toBe("otpExpired");
  });

  it("reports a wrong code for the generic verification failure", () => {
    expect(classifyVerifyError(convexWrapped("Could not verify code"), {
      expired: false,
      attempts: 1,
    })).toBe("otpInvalid");
  });

  it("nudges to resend after several consecutive failures", () => {
    expect(classifyVerifyError(convexWrapped("Could not verify code"), {
      expired: false,
      attempts: OTP_MAX_ATTEMPTS_HINT,
    })).toBe("otpTooMany");
  });

  it("maps network failures to the network kind", () => {
    expect(classifyVerifyError(new Error("Failed to fetch"), {
      expired: false,
      attempts: 0,
    })).toBe("network");
  });
});

describe("resend countdown", () => {
  it("starts at the configured 60 seconds", () => {
    expect(RESEND_COUNTDOWN_SECONDS).toBe(60);
  });

  it("ticks down one second at a time", () => {
    expect(tickResendCountdown(60)).toBe(59);
    expect(tickResendCountdown(1)).toBe(0);
  });

  it("never goes below zero", () => {
    expect(tickResendCountdown(0)).toBe(0);
  });
});

describe("OTP lifetime constants match the backend contract", () => {
  it("the client-side expiry window equals the backend 15-minute maxAge", () => {
    expect(OTP_MAX_AGE_MS).toBe(15 * 60 * 1000);
  });
});
