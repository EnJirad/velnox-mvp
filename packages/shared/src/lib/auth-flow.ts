/**
 * Velnox — Email OTP auth-flow helpers (pure, unit-testable).
 *
 * All logic that the Auth page needs beyond calling Convex Auth lives here so
 * it can be tested without a browser or a backend. The Convex Auth backend
 * remains the source of truth: these helpers only shape UX (normalization,
 * masking, friendly error selection, resend countdown). Nothing here can
 * bypass a server-side check.
 */

/** Must match the backend OTP length (convex/auth/emailOtp.ts, 6 digits). */
export const OTP_LENGTH = 6;

/** Client-side mirror of the backend OTP lifetime (convex/auth/emailOtp.ts). */
export const OTP_MAX_AGE_MS = 15 * 60 * 1000;

/** Resend countdown shown after a code is issued (seconds). */
export const RESEND_COUNTDOWN_SECONDS = 60;

/**
 * How many consecutive wrong codes the client tolerates before nudging the
 * user to request a new code. The backend enforces its own stricter limit
 * (10 failed attempts / hour) — this is a UX hint, not a security boundary.
 */
export const OTP_MAX_ATTEMPTS_HINT = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + lowercase — email identity is case-insensitive in Velnox. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic format check (server-side validation remains authoritative). */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Mask an email for display: keep the first char of the local part, mask the
 * rest, keep the domain. Examples:
 *   "john.doe@gmail.com" → "j***@gmail.com"
 *   "a@b.co"             → "a***@b.co"
 * Non-email strings degrade to "***" (never a crash, never a leak).
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

/** 6 digits only — rejects letters, symbols, and short pastes. */
export function isCompleteOtp(otp: string): boolean {
  return otp.length === OTP_LENGTH && /^\d+$/.test(otp);
}

/** Extract a safe message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/** Transport failures surface as fetch/network errors — map them safely. */
function isNetworkErrorMessage(message: string): boolean {
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network")
  );
}

/**
 * Error kinds the Auth page can present. Each maps to a user-facing message
 * in the i18n dictionaries — never to internal details (request ids, env var
 * names, provider responses, stack traces).
 */
export type AuthErrorKind =
  | "rateLimited" // OTP email requests throttled (server-enforced)
  | "sendFailed" // provider/config failure while sending the code
  | "network" // transport failure
  | "otpInvalid" // code was rejected (wrong, consumed, or wrong provider)
  | "otpExpired" // code is past its server-side lifetime
  | "otpTooMany" // many consecutive wrong codes → resend hint
  | "generic"; // anything else — always a safe generic message

/**
 * Classify an error from the FIRST signIn call (requesting the code).
 * The backend already returns user-safe Thai messages for the two cases it
 * controls (rate limited / send failed); we recognize them and keep the rest
 * generic.
 */
export function classifySendError(error: unknown): AuthErrorKind {
  const message = errorMessage(error);
  if (!message) return "network";
  if (message.includes("บ่อยเกินไป")) return "rateLimited";
  if (message.includes("ไม่สามารถส่งรหัส")) return "sendFailed";
  if (isNetworkErrorMessage(message)) return "network";
  return "generic";
}

/**
 * Classify an error from the SECOND signIn call (submitting the code).
 * Convex Auth reports every verification failure as "Could not verify code",
 * so the client combines the server signal with local facts (did the code
 * already expire? how many attempts?) to pick the most truthful message.
 * The backend still enforces expiry / single-use / brute-force limits.
 */
export function classifyVerifyError(
  error: unknown,
  opts: { expired: boolean; attempts: number },
): AuthErrorKind {
  if (opts.expired) return "otpExpired";
  const message = errorMessage(error);
  if (message.includes("Could not verify")) {
    return opts.attempts >= OTP_MAX_ATTEMPTS_HINT ? "otpTooMany" : "otpInvalid";
  }
  if (!message || isNetworkErrorMessage(message)) return "network";
  return "generic";
}

/** Decrement the resend countdown safely (never below zero). */
export function tickResendCountdown(seconds: number): number {
  return Math.max(0, seconds - 1);
}
