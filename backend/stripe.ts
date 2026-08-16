/**
 * Velnox Backend — Stripe payment gateway (Phase 14 / spec §24, §58).
 *
 * The commerce core keeps talking through the PaymentProvider abstraction
 * (backend/payment.ts); this module is the REAL gateway implementation for
 * "online" payments (card + PromptPay, THB). Design rules:
 *
 *   - Keys come ONLY from Convex deployment env (`process.env`) — never
 *     hard-coded, never in the client bundle: STRIPE_SECRET_KEY,
 *     STRIPE_PUBLISHABLE_KEY (client), STRIPE_WEBHOOK_SECRET (webhook).
 *   - Amounts: our ledger is THB with 2 decimals (NUMERIC(12,2)); Stripe
 *     wants the smallest unit (satang). Every conversion goes through
 *     thbToStripe / stripeToThb so no number is ever invented inline.
 *   - The customer pays ONCE per parent (multi-shop) order via a Stripe
 *     Checkout Session. The session id is stored as `external_ref` on every
 *     pending payment row of the parent order; the webhook confirms all of
 *     them in one idempotent transaction (backend/payments.ts).
 *   - Webhook signature verification is mandatory: an unverified event is
 *     rejected before any state change. No secret is logged.
 *
 * Required env (project Keys/API keys UI → Convex deployment env):
 *   STRIPE_SECRET_KEY       server calls (create session / retrieve / refund)
 *   STRIPE_WEBHOOK_SECRET   signature verification of incoming webhooks
 *   STRIPE_PUBLISHABLE_KEY  (client-side only — not used by this module)
 */
import Stripe from "stripe";
import { AppError } from "./errors";

/** THB ledger amounts (baht, 2 decimals) → Stripe minor units (satang). */
export function thbToStripe(amountThb: number): number {
  return Math.round((amountThb + Number.EPSILON) * 100);
}

/** Stripe minor units (satang) → THB ledger amounts (baht). */
export function stripeToThb(amountMinor: number): number {
  return amountMinor / 100;
}

/** True only when the server secret is configured (provider is live). */
export function stripeIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazily-built Stripe client — throws a clear error when not configured. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Stripe is not configured — set STRIPE_SECRET_KEY in the project Keys/API keys UI",
    );
  }
  return new Stripe(key);
}

export interface CreateCheckoutSessionInput {
  parentOrderId: string;
  orderNumber: string;
  /** Parent order total in THB (sum of every pending payment row). */
  total: number;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a hosted Stripe Checkout Session for a parent order. The session
 * accepts card + PromptPay (both THB payment methods); the amount is the
 * server-computed parent total — the client never sends a money number.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ sessionId: string; url: string; status: string }> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          unit_amount: thbToStripe(input.total),
          product_data: {
            name: `Velnox order ${input.orderNumber}`,
            description: `ชำระเงินออเดอร์ #${input.orderNumber} (Velnox Marketplace)`,
          },
        },
      },
    ],
    payment_method_types: ["card", "promptpay"],
    customer_email: input.customerEmail ?? undefined,
    metadata: {
      parentOrderId: input.parentOrderId,
      orderNumber: input.orderNumber,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  return {
    sessionId: session.id,
    url: session.url ?? "",
    status: session.status ?? "open",
  };
}

/** Re-read a checkout session from Stripe (status verification / refunds). */
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

/**
 * Refund an already-paid session's PaymentIntent at Stripe (satang amount,
 * idempotency key = our refund row id so retries cannot double-refund).
 * The local refund row is recorded separately by the commerce core.
 */
export async function refundStripePayment(input: {
  paymentIntentId: string;
  amountThb: number;
  reason?: string | null;
  idempotencyKey: string;
}): Promise<{ refundId: string; status: string }> {
  const refund = await getStripe().refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: thbToStripe(input.amountThb),
      reason: "requested_by_customer",
      metadata: { reason: input.reason ?? "" },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return { refundId: refund.id, status: refund.status ?? "pending" };
}

/**
 * Verify the `stripe-signature` header of a webhook payload and return the
 * typed event. Throws on ANY invalid input (tampered body, bad signature,
 * wrong secret) — callers must reject before touching state.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return getStripe().webhooks.constructEvent(payload, signatureHeader, webhookSecret);
}

/**
 * Extract the Velnox parent order reference from a checkout session event.
 * Returns null for events that did not come from a Velnox session (no
 * metadata) — those are acknowledged but never applied.
 */
export function sessionOrderRef(
  session: Stripe.Checkout.Session,
): { parentOrderId: string; orderNumber?: string } | null {
  const parentOrderId = session.metadata?.parentOrderId;
  if (!parentOrderId) return null;
  return { parentOrderId, orderNumber: session.metadata?.orderNumber };
}

/** Should a checkout session event mark our payments succeeded? */
export function sessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status === "paid";
}
