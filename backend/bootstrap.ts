/**
 * Velnox Backend — Secure company-owner bootstrap (spec §31).
 *
 * The old "first user to click claims the company" flow is replaced by a
 * one-time bootstrap secret:
 *
 *   1. The operator sets BOOTSTRAP_OWNER_SECRET (Convex deployment env —
 *      NEVER in source, NEVER exposed to the frontend).
 *   2. The first person who presents the correct code becomes COMPANY_OWNER.
 *   3. Every later claim is rejected server-side: an owner already exists,
 *      so the mechanism is invalidated immediately after first use.
 *
 * The comparison is done over SHA-256 digests with a constant-time byte
 * compare (no plaintext ===, no timing side-channel on the secret itself).
 * Web Crypto is used so this runs both in Convex edge mutations and in Node
 * unit tests.
 */

export const BOOTSTRAP_ENV_VAR = "BOOTSTRAP_OWNER_SECRET";
export const BOOTSTRAP_MIN_LENGTH = 16;

/** True only when a usable bootstrap secret is configured. */
export function bootstrapConfigured(): boolean {
  const secret = process.env[BOOTSTRAP_ENV_VAR];
  return typeof secret === "string" && secret.length >= BOOTSTRAP_MIN_LENGTH;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

/**
 * Constant-time check that the presented code matches the configured secret.
 * Returns false (never throws) when the secret is missing or the code is
 * empty — callers should check bootstrapConfigured() for the missing case.
 */
export async function bootstrapSecretMatches(input: string): Promise<boolean> {
  const secret = process.env[BOOTSTRAP_ENV_VAR];
  if (!secret || typeof input !== "string" || input.length === 0) return false;
  const [expected, actual] = await Promise.all([sha256(secret), sha256(input)]);
  return constantTimeEqual(expected, actual);
}
