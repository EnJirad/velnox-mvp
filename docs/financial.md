# VELNOX — Financial System

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. หลัก

> Financial Ledger = Source of Truth สำหรับเงิน. ห้ามคำนวณรายได้จาก order อย่างเดียว; ห้ามแก้ transaction เดิม (แก้ = adjustment)

## 2. `financial_ledger` (migration 008)

- `type`: sale · platform_commission · shipping_revenue · seller_payout · refund · return_cost · penalty · adjustment
- `amount` signed (+income/−expense) · currency · order_id/seller_id (ON DELETE SET NULL) · metadata JSONB
- **Append-only**: ห้าม UPDATE/DELETE — correction = เขียน adjustment ใหม่
- Indexes: order / seller / type / created_at

## 3. Commission (spec §12)

- rate จาก `platform_settings.platform_commission_percent` (default 3%) — **ไม่ hardcode**
- **Snapshot กลไก**: ตอน checkout backend อ่าน `shops.commission_rate` → เก็บลง `order_items.commission_rate` + `commissions(order_amount, commission_rate, commission_amount)` — config เปลี่ยนทีหลัง ไม่กระทบ order เก่า (test §39.10)
- seller net = gross − commission − fees − return deductions (`calcSellerNet`)

## 4. Shipping revenue split

`platform_settings.shipping_company_percent` (default 10%) — share ของ platform บันทึกใน transaction (snapshot หลักการเดียวกับ commission)

## 5. Balances & Payout (`src/backend/finance.ts`)

- `seller_balances` = **projection** — recompute จาก ledger (`recomputeSellerBalance`) ไม่ใช่ตารางหลัก
- `seller_payouts`: pending → processing → completed/failed/cancelled · method/destination
- `requestPayout` / `processPayout` — center approve; audit log ทุกขั้น
- รายงาน: `sellerFinancialReport` (gross/commission/penalty/refund/net/pending/available) · `platformRevenueReport` (GMV/commission/shipping/refunds)

## 6. Return penalty

return rate > 10% → `calcSellerReturnCost` ส่วนเกิน → ledger `penalty` entry (ไม่แก้ยอดย้อนหลัง)

## 7. Reconciliation

`bun run db:consistency` — ตรวจ: settled commissions == ledger platform_commission · seller_balances.total_earned == ledger sales · GMV == order totals · no orphan ledger

## 8. เงิน & หน่วย

- Neon: `NUMERIC(12,2)` + `round2()` server-side (decision D4 — ระบบใหม่ใช้ minor units integer)
- ระบบการเงินใหม่ (ledger/payout/penalty — Phase 10 เต็ม) ใช้ minor units ตามที่อนุมัติ
