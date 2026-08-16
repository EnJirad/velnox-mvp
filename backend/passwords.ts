/**
 * Velnox Backend — password policies (spec §9–§10).
 *
 * The company NEVER stores or displays an employee's existing password: only
 * the Convex Auth account stores a salted scrypt hash (Password provider).
 * These helpers generate the one-time temporary credential shown to HR at
 * creation/reset time and validate strength server-side before any hash is
 * created. Pure functions — unit-testable without a database.
 */
import { randomInt, randomBytes } from "node:crypto";

export const TEMP_PASSWORD_LENGTH = 14;
export const MIN_PASSWORD_LENGTH = 8;

const TEMP_ALPHABET = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I/O to avoid look-alikes
  lower: "abcdefghijkmnopqrstuvwxyz", // no l
  digits: "23456789", // no 0/1
  symbols: "!@#$%&*",
} as const;

export interface PasswordStrengthIssue {
  code: "too_short" | "no_letter" | "no_number";
  message: string;
}

/**
 * Validate a password chosen by a user (or by HR at reset time).
 * Returns the list of violations — an empty array means acceptable.
 * Never rejects on anything that would leak policy internals to the client.
 */
export function validatePasswordStrength(password: string): PasswordStrengthIssue[] {
  const issues: PasswordStrengthIssue[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push({
      code: "too_short",
      message: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
    });
  }
  if (!/[a-zA-Z]/.test(password)) {
    issues.push({ code: "no_letter", message: "รหัสผ่านต้องมีตัวอักษร" });
  }
  if (!/[0-9]/.test(password)) {
    issues.push({ code: "no_number", message: "รหัสผ่านต้องมีตัวเลข" });
  }
  return issues;
}

/** Cryptographically random secure value (node:crypto — safe on the server). */
function randomChars(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Generate a one-time temporary password for a new employee / password reset.
 * Guarantees at least one char from every class, then fills the rest randomly
 * and shuffles — the result always satisfies validatePasswordStrength.
 * The plaintext is returned EXACTLY ONCE to the authorized HR user; it is
 * never stored — only the scrypt hash goes into the auth account.
 */
export function generateTemporaryPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const groups = [TEMP_ALPHABET.upper, TEMP_ALPHABET.lower, TEMP_ALPHABET.digits, TEMP_ALPHABET.symbols];
  const chars: string[] = groups.map((g) => randomChars(g, 1));
  while (chars.length < length) {
    const group = groups[randomInt(0, groups.length)];
    chars.push(randomChars(group, 1));
  }
  // Fisher–Yates shuffle so the guaranteed classes are not in fixed positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
