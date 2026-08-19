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
| `SITE_URL` | `convex/auth_redirect.ts` + Stripe return URL | `https://velshop.vercel.app` | fallback origin สำหรับ redirect หลัง OAuth (single URL — ไม่ใช่ multi-value; ต้องเป็น origin ที่อยู่ใน allowlist) |
| `GOOGLE_CLIENT_ID` | `convex/auth.ts` (Google OAuth) | `1234567890-abc.apps.googleusercontent.com` | **จำเป็นสำหรับ Google Sign-In** (วิธีล็อกอินหลัก) — Client ID เปิดเผยได้ (ตาม OAuth design) แต่ตั้งไว้ที่ Convex env ฝั่ง server |
| `GOOGLE_CLIENT_SECRET` | `convex/auth.ts` (Google OAuth) | `GOCSPX-...` | **จำเป็น** — secret ของ Google OAuth Client **ห้าม**ใส่ใน `VITE_*`/git; ตั้งที่ Keys/API keys UI เท่านั้น |
| `AUTH_ALLOWED_ORIGINS` | `convex/auth_redirect.ts` | `["https://velshop.vercel.app","https://velseller.vercel.app","https://velcenter.vercel.app"]` | ทางเลือก — **JSON array** (ไม่ใช่ comma-separated string — โค้ดใช้ `JSON.parse()`) ของ origins ที่ redirect ได้หลัง OAuth (ค่าเริ่มต้น = 3 domains prod ปัจจุบัน + localhost; env นี้ *แทนที่* defaults) |
| `EMAIL_OTP_ENABLED` | `convex/auth.ts` | `"false"` | **ค่าเริ่มต้น `"false"`** — Google OAuth = ON, Email OTP = OFF (backend เก็บไว้ เปิดได้ด้วย `"true"`) |
| `FREEBUFF_EMAIL_API_KEY` | `convex/auth/emailOtp.ts` | `re_...` | **เฉพาะเมื่อเปิด Email OTP** — ตั้งค่าเป็น **Resend API key** (ชื่อตัวแปรคงเดิมเพื่อความเข้ากันได้) ถ้าไม่มี key นี้ การส่ง OTP จะ fail และผู้ใช้เห็นข้อความ generic (รายละเอียด technical อยู่ใน server log เท่านั้น) |
| `EMAIL_FROM` | `convex/auth/emailOtp.ts` | `Velnox <no-reply@velnox.com>` | **จำเป็น (required)** ผู้ส่งอีเมล OTP — ต้องเป็น address ภายใต้ domain ที่ verify กับ Resend แล้ว (เช่น `velnox.com`) **ห้ามใช้ Gmail หรือ sandbox `onboarding@resend.dev`** (sandbox ส่งได้เฉพาะอีเมลเจ้าของ account — recipient อื่นเจอ HTTP 403). ถ้าไม่ตั้ง → server log configuration error อย่างปลอดภัย และผู้ใช้เห็นข้อความ generic (ไม่ expose secret) |
| `STRIPE_SECRET_KEY` | `backend/stripe.ts` | `sk_test_...` | **ชำระเงินออนไลน์ (วิธี "online" — บัตร/PromptPay)** — ถ้าไม่มี key นี้ วิธีชำระออนไลน์จะซ่อนใน checkout และทุกอย่าง fallback เป็น manual เหมือนเดิม |
| `STRIPE_WEBHOOK_SECRET` | `backend/stripeVerify.ts` | `whsec_...` | จำเป็นเมื่อเปิดชำระเงินออนไลน์ — ใช้ verify signature ของ webhook `/stripe/webhook` (ตั้ง webhook endpoint ใน Stripe Dashboard ชี้ `<convex-url>/stripe/webhook`, event: `checkout.session.completed` + `checkout.session.async_payment_succeeded/failed`) |
| `BOOTSTRAP_OWNER_SECRET` | `convex/users.ts` + `backend/bootstrap.ts` | `รหัสยาว ≥16 ตัวอักษร` | **รหัสเปิดใช้งานเจ้าของบริษัท (ครั้งเดียว)** — velcenter ยังไม่มี owner: คนแรกที่ป้อนรหัสนี้ได้เป็น COMPANY_OWNER แล้วกลไกถูกปิดถาวร (เจ้าของที่มีอยู่แล้ว = ใช้ซ้ำไม่ได้) ตั้งที่ Keys/API keys UI เท่านั้น ห้ามใส่ในซอร์ส |
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
4. **Google Sign-In (velshop/velseller/velcenter — วิธีหลัก)**: ตั้ง `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` ใน Keys/API keys UI (จาก Google Cloud OAuth Client — ดู `docs/GOOGLE_OAUTH_UPGRADE_REPORT.md` หัวข้อ Google Cloud Console) + เพิ่ม redirect URI `https://<deployment>.convex.site/api/auth/callback/google` ใน Google Cloud Console; ทางเลือก `AUTH_ALLOWED_ORIGINS` / `SITE_URL`
5. **Email OTP (สำรอง — ปิด default)**: ถ้าจะเปิด `EMAIL_OTP_ENABLED=true` ให้ตั้ง `FREEBUFF_EMAIL_API_KEY` (Resend API key `re_...`) + `EMAIL_FROM` (sender ที่ verify domain แล้ว เช่น `Velnox <no-reply@velnox.com>`) — คีย์อยู่ฝั่ง server เท่านั้น ห้ามขึ้น frontend/`VITE_*`
5. **ชำระเงินออนไลน์ (velshop checkout)**: ตั้ง `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `SITE_URL` (สำหรับ return URL หลังชำระเงิน) — ทั้งหมดอยู่ฝั่ง server เท่านั้น

   **VelCenter — ตั้งเจ้าของบริษัท**: ตั้ง `BOOTSTRAP_OWNER_SECRET` (รหัสเปิดใช้งานครั้งเดียว ≥16 ตัว) ใน Keys/API keys UI → คนแรกที่เข้าหน้า velcenter และป้อนรหัสถูกต้องได้สิทธิ์ COMPANY_OWNER (กลไกใช้ครั้งเดียว — ตั้ง owner แล้วรหัสใช้ไม่ได้อีก) เจ้าของสร้างพนักงาน/สิทธิ์ต่อที่หน้า "พนักงาน"

## 4. Checklist ก่อน Production

- [ ] `VITE_CONVEX_URL` ชี้ production deployment ใน 4 เว็บ
- [ ] `DATABASE_URL` = Neon production (ไม่ใช่ local)
- [ ] `CLOUDINARY_*` ตั้งครบ (ถ้าเปิด upload)
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` ตั้งแล้ว (Convex env) และ Google Cloud Console มี redirect URI `/api/auth/callback/google` ครบ
- [ ] (ถ้าเปิด Email OTP สำรอง) `FREEBUFF_EMAIL_API_KEY` + `EMAIL_FROM` ตั้งแล้ว และ domain ของ sender verify กับ Resend แล้ว (ไม่ใช้ sandbox `onboarding@resend.dev`)
- [ ] (ถ้าเปิดชำระเงินออนไลน์) `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `SITE_URL` ตั้งครบ และ webhook endpoint ลงทะเบียนใน Stripe Dashboard
- [ ] ไม่มี `.env*` ใน git (`git status` สะอาด)
- [ ] ไม่มี secret ใน git history (ถ้าเคย leak → rotate ทันที §35)
