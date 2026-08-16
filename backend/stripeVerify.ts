/**
 * Velnox Backend — Stripe webhook signature verification (edge-safe).
 *
 * http actions run in Convex's edge (V8 isolate) runtime, so they cannot use
 * the Stripe SDK's node:crypto `constructEvent`. This module implements the
 * same verification with Web Crypto (`crypto.subtle`), which the runtime
 * provides (the auth routes already use it for JWT verification):
 *
 *   signature header = `t=<unix-seconds>,v1=<hex hmac-sha256(secret, t.body)>`
 *
 * Rules:
 *   - Reject if the signature is missing/malformed, the HMAC does not match,
 *     or the timestamp is outside the tolerance window (replay protection).
 *   - Returns the parsed event (plain JSON) on success; the caller forwards
 *     it to a "use node" action that applies the state change.
 *   - Pure + dependency-free (no Stripe SDK, no node modules) so it can be
 *     bundled into edge functions AND unit-tested under plain Node.
 */
const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/** Default replay-protection window (seconds) — Stripe's own 5-minute rule. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export interface VerifiedStripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Verify the `stripe-signature` header over the raw body with Web Crypto.
 * Throws on invalid input; returns the parsed event when valid.
 */
export async function verifyStripeSignatureWeb(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  opts: { toleranceSeconds?: number } = {},
): Promise<VerifiedStripeEvent> {
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signatureHeader) throw new Error("Missing stripe-signature header");

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const idx = pair.indexOf("=");
    if (idx > 0) parts.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) throw new Error("Malformed stripe-signature header");

  const tolerance = opts.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestamp = Number(t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > tolerance) {
    throw new Error("Stripe webhook timestamp is outside the tolerance window");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${t}.${payload}`;
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(signed)),
  );
  if (!timingSafeEqualHex(toHex(digest), v1)) {
    throw new Error("Stripe webhook signature does not match");
  }

  const event = JSON.parse(payload) as VerifiedStripeEvent;
  if (!event || typeof event.type !== "string") {
    throw new Error("Stripe webhook payload is not a valid event");
  }
  return event;
}
