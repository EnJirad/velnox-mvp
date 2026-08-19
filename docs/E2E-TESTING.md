# E2E-TESTING — Velnox End-to-End Test Scenarios

Version: 1.0 · Phase 7 · แผน E2E ตาม spec §48/§49 — เทียบกับ route/action จริงในระบบ

> หมายเหตุ: unit tests รันอัตโนมัติ (`bun test` — 180 ตัว) ครอบ logic ที่สำคัญ (commission, return penalty, GPS, state machine, IDOR, auth-flow, Google OAuth redirect) — E2E ข้างล่างเป็น **manual browser test** (ยังไม่มี Playwright ใน repo) ที่ต้องรันหลัง deploy ตาม `docs/PRODUCTION.md`
>
> Auth: วิธีหลักคือ **Google OAuth** (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — ดู `docs/GOOGLE_OAUTH_UPGRADE_REPORT.md`) · Email OTP ถูกปิด default (`EMAIL_OTP_ENABLED=false`) และไม่มี UI password

---

## TEST 1–16: Customer Flow (§48)

| # | Scenario | Route / Action | ผลลัพธ์ที่คาด |
|---|---|---|---|
| 1 | Google Sign-In (register/login เดียวกัน) | `/auth` → [ดำเนินการต่อด้วย Google] | Google Account Chooser → กลับมา + session สร้าง (account ใหม่ = customer, account เดิม = login) |
| 2 | Login + returnTo | `/auth?returnTo=...` | หลัง login สำเร็จ กลับมาหน้าเดิม (seller/center ตรวจ role ฝั่ง server ก่อนเข้าถึง) |
| 3 | Create address | `/shop/addresses` → `saveAddress` | บันทึกได้, default ต้องมี GPS |
| 4 | Set GPS | `MapPicker` (current location / map / drag) | lat/long ถูกบันทึก |
| 5 | Browse product | `/shop/products?q=&category=&min=&max=` | กรอง + sort + pagination ถูกต้อง |
| 6 | Add cart | `api.customer.addToCartAction` | badge อัปเดต, stock ตรวจ |
| 7 | Checkout | `/shop/checkout` | เลือก address + payment → review |
| 8 | Create order | `checkoutAction` | ได้ order number, multi-shop แยก order |
| 9 | Seller receives | VelSeller `/seller/orders` (SellerOrders) | เห็น order + items ของร้านตัวเอง |
| 10 | Seller processes | `api.commerce.setOrderStatus` confirmed/packed | status อัปเดต, audit log เขียน |
| 11 | Shipping | `api.sellerOps.createShipmentAction` + tracking event | carrier + tracking no + timeline |
| 12 | Delivery | tracking event delivered | customer เห็น delivered |
| 13 | Order complete | status completed | review ได้ (delivered/completed เท่านั้น) |
| 14 | Seller earnings | `sellerIncomeReport` / Income page | gross − commission = net |
| 15 | Company commission | ledger / center revenue | commission 3% เข้า ledger |
| 16 | Customer review | `api.customer.reviewProduct` | แสดง Verified Purchase |

## Failure Tests (§49) — สิ่งที่ต้องไม่เกิด

| สถานการณ์ | พฤติกรรมที่ถูกต้อง |
|---|---|
| Payment failed | order ยัง pending payment — ไม่ถือว่า paid (§19) |
| Stock insufficient | checkout ปฏิเสธ — "สินค้าไม่เพียงพอ" (§41/§78) |
| Product disabled/unpublished | cart/checkout ปฏิเสธ — ไม่สร้าง order |
| Seller suspended | ไม่ซื้อสินค้าใหม่ได้ (order เก่ายังดูได้ §44) |
| Address ไม่มี GPS | checkout ปฏิเสธ — "กรุณาระบุตำแหน่งบนแผนที่" (§21/§62/§80) |
| Invalid coupon | (Phase 10 — ยังไม่มี coupon service) |
| Expired session | redirect /auth + returnTo |
| Unauthorized access | 403 / ปฏิเสธ (backend guard — §8/§9) |
| Network failure | error state + retry (ทุกหน้า) — ไม่สร้างข้อมูลครึ่งเดียว (transaction) |

## ตรวจด้วย tests อัตโนมัติ (เพิ่มเติมจาก unit)

```bash
bun run build        # build ผ่าน
bun test             # 180 tests
bunx convex dev --once && bunx tsc -b --noEmit   # convex + types
```

## Smoke Test หลัง Deploy (§62)

1. เปิด 4 เว็บ — homepage ขึ้น ไม่มี console error
2. Login Google (Gmail A) — `/auth` → [ดำเนินการต่อด้วย Google] → เลือกบัญชี → กลับมา + session; ยกเลิกที่ Google chooser → เห็น "การเข้าสู่ระบบถูกยกเลิก"
3. VelShop: product → cart → checkout (ทดสอบ seller ตัว test) → order
4. VelSeller: login Google (บัญชี seller) → เห็น order → ship → tracking; บัญชีที่ยังไม่เป็น seller → เห็น "คุณยังไม่ได้เป็น Seller"
5. VelCenter: login Google (บัญชีที่ไม่มี staff profile) → Access Denied; owner/admin → dashboard เห็นตัวเลขตรงกับ order ที่เพิ่งสร้าง
6. `GET <convex-url>/health` → 200

## TODO

- [ ] เพิ่ม Playwright E2E (test 1–16 อัตโนมัติ) — งานหลัง deploy เฟสแรก
- [ ] Test matrix แยก dev/staging/prod data (ห้าม E2E แตะ production data จริง)
