# VELNOX — Payments

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. Abstraction (`src/backend/payment.ts`)

```ts
interface PaymentProvider {
  createPayment(input): Promise<PaymentIntent>
  verifyPayment(ref): Promise<PaymentStatus>
  refundPayment(ref, amountMinor): Promise<RefundResult>
}
```

- **ManualPaymentProvider** (ใช้งานได้วันนี้): COD / transfer / promptpay / card / wallet — บันทึก **PENDING**; order เป็น paid **เมื่อเงินถึงจริง** (seller/center ยืนยัน) — ไม่ fake success
- Registry + TODO: Omise/Stripe (Phase 9.5 — พร้อมใช้ Gravity Index เลือก)
- Tests: `tests/providers.test.ts`

## 2. ตาราง

- `payments`: order_id · amount · currency · method (enum) · status (`pending/succeeded/failed/refunded`) · external_ref · paid_at
- `payment_transactions`: provider refs, type (PAYMENT/REFUND/PARTIAL_REFUND)
- `refunds`: order_id · payment_id · amount · status (`requested/approved/processed/rejected`)
- `commissions`: snapshot rate + amount ต่อ line item

## 3. หลัก

- **Frontend ตั้ง payment status เองไม่ได้** — status เปลี่ยนผ่าน backend เท่านั้น (recordPayment/refundPayment)
- เก็บเฉพาะ provider/transactionId/status/amount/currency — **ห้ามเก็บ card number/CVV** (spec §13)
- เงินคำนวณ backend เท่านั้น; ราคา order เป็น snapshot (ราคาเปลี่ยนทีหลังไม่กระทบ)

## 4. Payment status vs Order status

แยกกันชัดเจน: `orders.payment_status` (unpaid/pending/paid/partially_refunded/refunded/failed) ≠ `orders.status` (fulfillment)

## 5. สถานะปัจจุบัน

- COD/โอน/PromptPay ทำงานผ่าน manual provider (PENDING → paid เมื่อยืนยัน)
- **Gateway จริง (QR/บัตร) ยังไม่ติด** — ต้องเลือก provider + ตั้ง keys (ดู `docs/production/environment.md`) + webhook signature verification (spec §14/§52)
