/**
 * Velnox Backend — Payment abstraction (spec §24, §58).
 *
 * The commerce core never talks to a gateway directly: every payment action
 * goes through a PaymentProvider. PHASE 6 ships the "manual" provider —
 * COD / bank transfer / PromptPay are recorded in the payments table and the
 * seller (or center finance) confirms the money received. No fake success:
 * `createPayment` records PENDING, and the order only becomes paid when a
 * payment is confirmed (status 'succeeded').
 *
 * Real online gateways (Omise, PromptPay partner banks, Stripe, ...) plug
 * into the registry below in the payment phase — the checkout, order and
 * finance services do NOT change.
 *
 * @see db/schema.sql (payments, refunds) · src/backend/payments.ts
 */
import { getDb } from "./db";
import type { Payment, PaymentMethod, Refund } from "./types";
import { getPaymentsForOrder, recordPayment, refundPayment } from "./payments";
import { stripeIsConfigured } from "./stripe";

// ---------------------------------------------------------------------------
// provider registry
// ---------------------------------------------------------------------------
export type PaymentProviderId = "manual" | "omise" | "stripe";

export interface PaymentMethodMeta {
  id: PaymentMethod;
  label: string;
  /** default provider that handles this method */
  provider: PaymentProviderId;
  /** short user-facing instruction shown at checkout/order detail */
  instructions: string;
}

/** All methods the platform can offer (enable/disable via platform settings). */
export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    id: "cod",
    label: "เก็บเงินปลายทาง (COD)",
    provider: "manual",
    instructions: "ชำระเงินเมื่อได้รับสินค้า",
  },
  {
    id: "transfer",
    label: "โอนเงินผ่านธนาคาร",
    provider: "manual",
    instructions: "โอนเงินแล้วแจ้งเลขที่ออเดอร์ — ร้านค้าจะยืนยันการชำระ",
  },
  {
    id: "promptpay",
    label: "PromptPay",
    provider: "manual",
    instructions: "สแกน QR PromptPay ของร้านค้าแล้วแจ้งยืนยัน",
  },
  {
    id: "card",
    label: "บัตรเครดิต / เดบิต",
    provider: "manual",
    instructions: "ร้านค้าจะส่งลิงก์ชำระเงิน หรือชำระเมื่อจัดส่ง (แล้วแต่ร้าน)",
  },
  {
    id: "wallet",
    label: "กระเป๋าเงิน",
    provider: "manual",
    instructions: "ชำระผ่านกระเป๋าเงินของร้านค้า",
  },
  {
    id: "online",
    label: "ชำระออนไลน์ (บัตร / PromptPay)",
    provider: "stripe",
    instructions: "ชำระด้วยบัตรเครดิต/เดบิต หรือ PromptPay ผ่าน Stripe — ตัดเงินทันที",
  },
];

export function paymentMethodMeta(method: PaymentMethod): PaymentMethodMeta {
  return PAYMENT_METHODS.find((m) => m.id === method) ?? PAYMENT_METHODS[0];
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly name: string;
  /**
   * Create a payment for an order. Returns the pending payment row; the order
   * is NOT marked paid here. `externalRef` can carry a gateway reference when
   * a real provider is plugged in.
   */
  createPayment(input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
    externalRef?: string | null;
  }): Promise<Payment>;
  /** Re-read payment state from the provider (or DB for manual). */
  verifyPayment(orderId: string): Promise<{ payments: Payment[]; paid: boolean }>;
  /** Refund a paid order (full → voids pending commissions). */
  refundPayment(input: { orderId: string; amount: number; reason?: string | null }): Promise<Refund>;
}

/**
 * Manual provider: records payments in Neon. Confirmation happens through
 * recordPayment(status='succeeded') — called by the seller or center finance
 * when money actually arrives. Real gateways implement the same interface.
 */
class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual" as const;
  readonly name = "Manual / offline payment";

  async createPayment(input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
    externalRef?: string | null;
  }): Promise<Payment> {
    return recordPayment({
      orderId: input.orderId,
      amount: input.amount,
      method: input.method,
      externalRef: input.externalRef ?? null,
      status: input.method === "cod" ? "pending" : "pending",
    });
  }

  async verifyPayment(orderId: string): Promise<{ payments: Payment[]; paid: boolean }> {
    const payments = await getPaymentsForOrder(getDb(), orderId);
    return { payments, paid: payments.some((p) => p.status === "succeeded") };
  }

  async refundPayment(input: {
    orderId: string;
    amount: number;
    reason?: string | null;
  }): Promise<Refund> {
    return refundPayment({ orderId: input.orderId, amount: input.amount, reason: input.reason ?? null });
  }
}

const providers = new Map<PaymentProviderId, PaymentProvider>([
  ["manual", new ManualPaymentProvider()],
]);

export function getPaymentProvider(id?: PaymentProviderId | string | null): PaymentProvider {
  return providers.get((id as PaymentProviderId) ?? "manual") ?? providers.get("manual")!;
}

/** True when a real online gateway (Stripe) is live for "online" payments. */
export function onlinePaymentsEnabled(): boolean {
  return stripeIsConfigured();
}

/**
 * Stripe gateway provider — implements the same PaymentProvider contract the
 * commerce core uses, but through the Stripe API (backend/stripe.ts). The
 * "create" step is a hosted Checkout Session (card + PromptPay) and the
 * success confirmation is driven by the /stripe/webhook (idempotent).
 */
class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;
  readonly name = "Stripe (card / PromptPay)";

  async createPayment(input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
    externalRef?: string | null;
  }): Promise<Payment> {
    // Orders paid online always go through the Checkout Session flow created
    // by convex/stripe.ts (createStripeCheckoutAction). This path records the
    // pending row the same way checkout() does — the session reference is
    // attached when the session is created.
    return recordPayment({
      orderId: input.orderId,
      amount: input.amount,
      method: input.method,
      externalRef: input.externalRef ?? null,
    });
  }

  async verifyPayment(orderId: string): Promise<{ payments: Payment[]; paid: boolean }> {
    const payments = await getPaymentsForOrder(getDb(), orderId);
    return { payments, paid: payments.some((p) => p.status === "succeeded") };
  }

  async refundPayment(input: {
    orderId: string;
    amount: number;
    reason?: string | null;
  }): Promise<Refund> {
    return refundPayment({ orderId: input.orderId, amount: input.amount, reason: input.reason ?? null });
  }
}

// Real gateway (Phase 14): the Stripe provider registers itself only when the
// server secret is configured (Convex deployment env). Without keys the
// platform keeps working exactly as before — everything falls back to manual.
if (stripeIsConfigured()) {
  providers.set("stripe", new StripePaymentProvider());
}
