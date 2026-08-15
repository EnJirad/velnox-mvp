# VELNOX — Testing (production reference)

Version: 1.0 · Phase 9 — รายละเอียด E2E: [`../E2E-TESTING.md`](../E2E-TESTING.md)

## 1. Automated checks (ทุก PR / ก่อน deploy)

```bash
bun run typecheck          # tsc -b --noEmit
bun test                   # vitest — 53 tests (business rules, RBAC, GPS, state machine, providers, errors, velrepeat)
bun run build              # tsc -b && vite build (ไม่ต้อง login Convex)
```

## 2. Data consistency + financial reconciliation (spec §69–71) — **ใหม่ Phase 9**

```bash
DATABASE_URL=<prod-conn> bun run db:consistency
```

ตรวจ (SELECT-only, exit 1 ถ้ามี error):
- stock ติดลบ / available < 0
- orphan order_items / payments / refunds / returns / ledger
- orders ที่ไม่มี user
- order subtotal ≠ sum(line items)
- commission ≠ order_amount × rate
- order marked paid แต่ไม่มี succeeded payment
- **reconciliation**: GMV vs orders · settled commissions vs ledger platform_commission · seller_balances vs ledger sales
- return rate > 10% ต่อ seller (warn)

> รันหลัง migration ทุกครั้ง + ก่อน/หลัง deploy ทุกครั้ง

## 3. E2E scenarios (spec §57–59, §65)

`../E2E-TESTING.md` — 16 scenarios:
- Customer: register → login → address+GPS → product → cart → checkout → order → tracking → return/review
- Seller: register → shop → GPS → product → publish → receive order → process → ship → revenue
- Admin: login → dashboard → sellers → products → orders → revenue → returns → settings → audit

**Smoke test หลัง deploy ทุกครั้ง (spec §65)**: เปิด 3 เว็บ → login → หน้าแรก → product → cart → checkout (จนถึง payment step) → seller dashboard → center dashboard → `/health` → `db:consistency`

## 4. สิ่งที่ยังต้องทำก่อน go-live

- [ ] E2E browser test จริง (Playwright) ตาม scenario — ยังไม่มี
- [ ] Payment sandbox test (เมื่อมี gateway): success/failed/timeout/duplicate
- [ ] Mobile test จริง (320/375/390/430) — ดู spec §39
- [ ] Failure test: payment failed / stock insufficient / seller suspended / GPS missing / network หลุดกลาง checkout (spec §49)
