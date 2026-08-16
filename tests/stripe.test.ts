/**
 * Velnox Backend — Stripe gateway tests (Phase 14 / spec §24, §58).
 *
 * Covers the money-critical + security-critical pure logic:
 *   - THB ↔ Stripe minor-unit conversion (amounts are NEVER invented inline)
 *   - webhook signature verification (tamper/expiry/wrong-secret rejection)
 *   - checkout-session event parsing + metadata gating
 *   - provider registry: without STRIPE_SECRET_KEY everything falls back to
 *     manual — the platform keeps working when the gateway is not configured
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sessionOrderRef,
  sessionPaid,
  stripeIsConfigured,
  stripeToThb,
  thbToStripe,
} from "../backend/stripe";
import { verifyStripeSignatureWeb } from "../backend/stripeVerify";
import { PAYMENT_METHODS, getPaymentProvider, onlinePaymentsEnabled } from "../backend/payment";

const enc = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a Stripe-style signature header exactly like Stripe does. */
async function makeSignature(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return `t=${timestamp},v1=${await hmacHex(`${timestamp}.${payload}`, secret)}`;
}

const SAMPLE_EVENT = {
  id: "evt_test_123",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      status: "complete",
      payment_status: "paid",
      amount_total: 19990,
      currency: "thb",
      metadata: { parentOrderId: "parent-order-1", orderNumber: "VN-1001" },
    },
  },
};

describe("§58 — THB ↔ Stripe minor-unit conversion", () => {
  it("converts baht to satang (2 decimals)", () => {
    expect(thbToStripe(199.9)).toBe(19990);
    expect(thbToStripe(0.01)).toBe(1);
    expect(thbToStripe(0)).toBe(0);
  });

  it("rounds float drift safely", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE754 — must still land on 30 satang
    expect(thbToStripe(0.1 + 0.2)).toBe(30);
    expect(thbToStripe(19.99 + 0.01)).toBe(2000);
  });

  it("converts back without losing the amount", () => {
    expect(stripeToThb(19990)).toBe(199.9);
    expect(stripeToThb(thbToStripe(1234.56))).toBe(1234.56);
  });
});

describe("§24 — Stripe webhook signature verification", () => {
  const secret = "whsec_test_secret_123";
  const payload = JSON.stringify(SAMPLE_EVENT);

  it("accepts a valid signature and returns the parsed event", async () => {
    const signature = await makeSignature(payload, secret);
    const event = await verifyStripeSignatureWeb(payload, signature, secret);
    expect(event.type).toBe("checkout.session.completed");
    expect(event.data.object.id).toBe("cs_test_123");
  });

  it("rejects a tampered body (payload changed after signing)", async () => {
    const signature = await makeSignature(payload, secret);
    const tampered = payload.replace("19990", "100");
    await expect(verifyStripeSignatureWeb(tampered, signature, secret)).rejects.toThrow();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const signature = await makeSignature(payload, "whsec_attacker");
    await expect(verifyStripeSignatureWeb(payload, signature, secret)).rejects.toThrow();
  });

  it("rejects a replayed old timestamp (outside tolerance)", async () => {
    const old = Math.floor(Date.now() / 1000) - 3600; // 1h old
    const signature = await makeSignature(payload, secret, old);
    await expect(verifyStripeSignatureWeb(payload, signature, secret)).rejects.toThrow();
  });

  it("rejects a malformed or missing signature header", async () => {
    await expect(verifyStripeSignatureWeb(payload, "not-a-signature", secret)).rejects.toThrow();
    await expect(verifyStripeSignatureWeb(payload, "", secret)).rejects.toThrow();
  });

  it("accepts a signature at the edge of the tolerance window", async () => {
    const near = Math.floor(Date.now() / 1000) - 240; // 4 min — inside 5 min
    const signature = await makeSignature(payload, secret, near);
    await expect(verifyStripeSignatureWeb(payload, signature, secret)).resolves.toBeDefined();
  });
});

describe("§24 — checkout session event parsing", () => {
  const session = SAMPLE_EVENT.data.object as unknown as import("stripe").Stripe.Checkout.Session;

  it("extracts the Velnox parent order from metadata", () => {
    expect(sessionOrderRef(session)).toEqual({
      parentOrderId: "parent-order-1",
      orderNumber: "VN-1001",
    });
  });

  it("returns null for sessions without Velnox metadata (never applied)", () => {
    expect(
      sessionOrderRef({ ...session, metadata: null } as unknown as import("stripe").Stripe.Checkout.Session),
    ).toBeNull();
    expect(
      sessionOrderRef(
        { ...session, metadata: { other: "x" } } as unknown as import("stripe").Stripe.Checkout.Session,
      ),
    ).toBeNull();
  });

  it("only treats complete + paid sessions as paid (PromptPay is async)", () => {
    expect(sessionPaid({ ...session } as unknown as import("stripe").Stripe.Checkout.Session)).toBe(true);
    expect(
      sessionPaid(
        { ...session, payment_status: "unpaid" } as unknown as import("stripe").Stripe.Checkout.Session,
      ),
    ).toBe(false);
    expect(
      sessionPaid({ ...session, status: "open" } as unknown as import("stripe").Stripe.Checkout.Session),
    ).toBe(false);
  });
});

describe("§24 — provider registry (no keys → manual fallback)", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });
  afterAll(() => {
    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("reports the gateway as not configured without keys", () => {
    expect(stripeIsConfigured()).toBe(false);
    expect(onlinePaymentsEnabled()).toBe(false);
  });

  it("getPaymentProvider('stripe') falls back to manual when unconfigured", () => {
    expect(getPaymentProvider("stripe").id).toBe("manual");
    expect(getPaymentProvider().id).toBe("manual");
  });

  it("the 'online' method exists and maps to the stripe provider", () => {
    const online = PAYMENT_METHODS.find((m) => m.id === "online");
    expect(online?.provider).toBe("stripe");
    expect(online?.label).toBeTruthy();
  });
});
