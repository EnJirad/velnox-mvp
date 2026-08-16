# ENVIRONMENT — Velnox Environment Variables

Version: 1.0 · Phase 7

> ห้าม commit: `.env`, `.env.local`, `.env.production`, private keys, JWT secrets, API secrets (§35/§52)
> `.gitignore` มี `.env.local` อยู่แล้ว — secret ทั้งหมดตั้งผ่าน hosting platform (Keys/API keys UI) เท่านั้น

---

## 1. แยกตาม Environment

| Env | ใช้กับ | Convex deployment | หมายเหตุ |
|---|---|---|---|
| Development | Local + Freebuff preview | `convex dev` (local) หรือ deployment พรีวิว | env จาก Keys UI ของ platform |
| Staging | PR preview / staging deployment | deployment staging | แยกจาก prod ผ่าน Convex project |
| Production | `velnox.com`, `shop/seller/center.velnox.com` | production deployment | ห้ามใช้ dev secret |

## 2. ตัวแปรต่อ Application

### Frontend (Vite — ส่งให้ client ได้เฉพาะ public เท่านั้น)
| ตัวแปร | App | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `VITE_CONVEX_URL` | main/velshop/velseller/velcenter | `https://xxx.convex.cloud` | URL ของ Convex deployment — ต้องชี้ไป deployment เดียวกันทั้ง 4 เว็บ |

### Backend (Convex node actions — ตั้งใน Keys/API keys UI ของ Convex deployment)
| ตัวแปร | ใช้ที่ | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `DATABASE_URL` | `src/backend/db.ts` (Neon) | `postgresql://...` | **ห้ามขึ้น frontend** — node action เท่านั้น |
| `CLOUDINARY_CLOUD_NAME` | `src/backend/storage.ts` | `velnox` | product image storage |
| `CLOUDINARY_API_KEY` | `src/backend/storage.ts` | `123...` | |
| `CLOUDINARY_API_SECRET` | `src/backend/storage.ts` | `abc...` | |
| `SITE_URL` | (auth/SEO อนาคต) | `https://velnox.com` | ตั้งที่ hosting platform |
| `FREEBUFF_EMAIL_API_KEY` | `src/convex/auth/emailOtp.ts` | `fb_email_...` | **จำเป็นสำหรับ OTP email** — key จาก Keys/API keys UI ของ Freebuff; ถ้าไม่มี key นี้ การส่ง OTP จะ fail ทันที (ไม่ silent) |
| `VLY_APP_NAME` | `src/convex/auth/emailOtp.ts` | `velnox` | แสดงใน OTP email (มี default แล้ว) |
| `STRIPE_SECRET_KEY` | `backend/stripe.ts` | `sk_test_...` | **ชำระเงินออนไลน์ (วิธี "online" — บัตร/PromptPay)** — ถ้าไม่มี key นี้ วิธีชำระออนไลน์จะซ่อนใน checkout และทุกอย่าง fallback เป็น manual เหมือนเดิม |
| `STRIPE_WEBHOOK_SECRET` | `backend/stripeVerify.ts` | `whsec_...` | จำเป็นเมื่อเปิดชำระเงินออนไลน์ — ใช้ verify signature ของ webhook `/stripe/webhook` (ตั้ง webhook endpoint ใน Stripe Dashboard ชี้ `<convex-url>/stripe/webhook`, event: `checkout.session.completed` + `checkout.session.async_payment_succeeded/failed`) |
| `STRIPE_PUBLISHABLE_KEY` | (client อนาคต) | `pk_test_...` | ยังไม่จำเป็น (ใช้ hosted Checkout) — เตรียมไว้ |

### Convex Auth (จัดการโดย Convex/Freebuff — ไม่ต้องตั้งเอง)
| ตัวแปร | หมายเหตุ |
|---|---|
| `JWT_PRIVATE_KEY` | Convex Auth สร้าง/จัดการให้ — ไม่ต้อง copy ลง frontend |
| `JWKS` | จัดการโดย Convex — ไม่ต้องตั้งเอง |

## 3. วิธีตั้งค่า

1. **Convex env (backend)**: หน้า Keys/API keys UI ของโปรเจกต์ → paste `DATABASE_URL`, `CLOUDINARY_*`
2. **Frontend env**: hosting platform (Vercel project env) → `VITE_CONVEX_URL` ต่อโปรเจกต์ทั้ง 4
3. **อย่าแก้ `.env.example` ผ่าน code** — platform ล็อกไฟล์ (ตัวแปรทั้งหมดอธิบายไว้ใน `INSTALL_AND_USAGE.md` §6.7)
4. **OTP email (velshop sign-in)**: ตั้ง `FREEBUFF_EMAIL_API_KEY` ใน Keys/API keys UI — คีย์นี้อยู่ฝั่ง server เท่านั้น ห้ามขึ้น frontend/`VITE_*`
5. **ชำระเงินออนไลน์ (velshop checkout)**: ตั้ง `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `SITE_URL` (สำหรับ return URL หลังชำระเงิน) — ทั้งหมดอยู่ฝั่ง server เท่านั้น

## 4. Checklist ก่อน Production

- [ ] `VITE_CONVEX_URL` ชี้ production deployment ใน 4 เว็บ
- [ ] `DATABASE_URL` = Neon production (ไม่ใช่ local)
- [ ] `CLOUDINARY_*` ตั้งครบ (ถ้าเปิด upload)
- [ ] `FREEBUFF_EMAIL_API_KEY` ตั้งแล้ว (OTP email ทำงาน)
- [ ] (ถ้าเปิดชำระเงินออนไลน์) `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `SITE_URL` ตั้งครบ และ webhook endpoint ลงทะเบียนใน Stripe Dashboard
- [ ] ไม่มี `.env*` ใน git (`git status` สะอาด)
- [ ] ไม่มี secret ใน git history (ถ้าเคย leak → rotate ทันที §35)
