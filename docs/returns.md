# VELNOX — Returns & Refunds

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. Return flow (`src/backend/returns.ts`)

Customer request → seller/center review → approve/reject → return shipping → received → refund

State machine: `REQUESTED → UNDER_REVIEW → APPROVED / REJECTED → RETURN_SHIPPING → RECEIVED → REFUNDING → REFUNDED / CANCELLED`

- บันทึก: reason (enum: damaged/wrong_item/missing_item/not_as_described/customer_changed_mind/other) · description · evidenceUrls (≤6) · timestamps
- สิทธิ์: customer ส่ง request สำหรับ order ของตัวเอง (`requestReturnAction`); seller/center ตัดสินใจ; audit log ทุกขั้น
- Rate limit: 10/h ต่อ user

## 2. Refund (`src/backend/payments.ts` — refundPayment)

- `refunds` row: order_id · payment_id · amount · reason · status (`requested/approved/processed/rejected`)
- เมื่อ approve → สร้าง ledger `refund` entry (ห้ามแก้ตัวเลขย้อนหลัง — ใช้ adjustment) → กลับสถานะ payment/commission ตาม flow

## 3. Business rule — return rate (§13)

```
return_rate = returned orders / eligible (delivered/completed) orders × 100
threshold = platform_settings.return_rate_threshold (default 10%)
เกิน threshold → seller รับผิดชอบส่วนเกิน (คำนวณ backend — calcReturnRatePercent/calcSellerReturnCost)
```

- Tests: `tests/businessRules.test.ts` (§61 — 8%, 15%, no division by zero)
- ตรวจย้อนหลัง: `bun run db:consistency` รายงาน seller ที่ return rate > 10%

## 4. หลัง refund

- commission: void (`commissions.status='voided'`) ตาม flow
- ledger: `refund` / `return_cost` entries — เงินทุกบาทมี record (ดู `docs/financial.md`)

## 5. สถานะ

flow ครบใน backend + UI (customer request / seller review); refund สลิปเงินจริงต้องต่อ payment gateway (Phase 9.5)
