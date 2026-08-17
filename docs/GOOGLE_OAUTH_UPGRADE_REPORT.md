# Velnox — Google OAuth Authentication Rebuild (Production)

> สถานะ: **โค้ดเสร็จ + verify ครบทุกขั้น** — ยังต้องตั้งค่าภายนอก (Google Cloud + env) ตามหัวข้อด้านล่างก่อนใช้งานจริง
> วันที่: 2026-08-17 · ขอบเขต: แทนที่ Email OTP เป็นวิธีล็อกอินหลัก ด้วย Google OAuth จริง (Convex Auth)

---

## 1. AUTH ARCHITECTURE

```
Velnox Login (ทุกเว็บ: shop / seller / center)
   │
   ▼
[ ดำเนินการต่อด้วย Google ]          ← ปุ่มเดียว (ไม่มี email/password/OTP input)
   │
   ▼
Google Account Chooser (บัญชี Google จริงเป็นคนจัดการ selection/consent/auth)
   │
   ▼
https://<convex>.convex.site/api/auth/callback/google   ← OAuth callback (Convex Auth HTTP action)
   │
   ▼
Convex Auth: สร้าง/ค้นหา User + สร้าง Session (PKCE, state ลงนามฝั่ง server)
   │
   ▼
Browser กลับไป origin ที่เริ่มต้น (?code=...) → client แลก code → session cookie
   │
   ▼
Redirect ตาม role (server-side authorization ยังบังคับทุกจุด)
```

- **ไม่ใช่ UI หลอก** — ทุกขั้นผ่าน `signIn("google", …)` ของ Convex Auth (`@convex-dev/auth@0.0.95` ซึ่งรองรับ OAuth provider จาก `@auth/core`)
- **Identity เดียวกันทั้ง 4 เว็บ** (Convex backend เดียว) แต่ authorization แยกตาม role/สิทธิ์ฝั่ง server

## 2. GOOGLE OAUTH

| รายการ | ค่า |
|---|---|
| Provider | `Google` จาก `@auth/core/providers/google` (OIDC, issuer `https://accounts.google.com`) |
| ไฟล์ | `convex/auth.ts` — `Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })` |
| Callback URI | `https://strong-buffalo-427.convex.site/api/auth/callback/google` |
| OAuth ชนิด | Authorization Code + PKCE (Convex Auth จัดการ verifier/state เอง) — ฝั่ง client เก็บ verifier ใน sessionStorage |
| หลัง callback | ตรวจ allowlist origin (multi-frontend) → redirect กลับ frontend พร้อม `code` → client แลกเป็น session |

**Redirect allowlist (ใหม่):** `convex/auth_redirect.ts` — หลัง OAuth สำเร็จ browser จะถูกส่งกลับไปเฉพาะ origin ในรายการนี้เท่านั้น:

`https://velnox.com` · `https://shop.velnox.com` · `https://seller.velnox.com` · `https://center.velnox.com` + local dev (`localhost:5173/3000/4173`)
- ตั้ง `AUTH_ALLOWED_ORIGINS` (JSON array) เพื่อ override รายการนี้
- จุดปลอดภัยเมื่อ destination ไม่อยู่ในรายการ → `{SITE_URL}/auth` (ไม่ redirect ไป domain แปลกปลอม)

## 3. CONVEX AUTH

- ใช้ `convexAuth()` เดิม — **ไม่สร้าง auth system ใหม่**
- Provider ปัจจุบัน: `Google` (ON) · `Anonymous` (guest, ON) · `Password` (registered เพื่อรองรับ employeeAuth เดิม — ไม่มี UI) · `emailOtp` (OFF ผ่าน flag)
- `convex/auth.config.ts` — **ไม่ต้องแก้**: ใช้ OIDC ของ deployment เอง (`CONVEX_SITE_URL`) อยู่แล้ว; Google OAuth ใช้ callback ผ่าน HTTP actions (`convex/http.ts` มี `auth.addHttpRoutes(http)` อยู่แล้ว)

## 4. SESSION

- Convex Auth สร้าง session จริงหลัง OAuth สำเร็จ (ตาราง `authSessions` + token สุ่ม 32-byte)
- Session cookie ตั้งที่ origin ของ frontend หลัง client แลก `code` — validation ฝั่ง server ทุก request
- Logout: `signOut()` → invalidate session ฝั่ง Convex (ไม่ใช่แค่ลบ localStorage)
- Refresh/expiry จัดการโดย Convex Auth (`refreshSession`)

## 5. USER CREATION

- Google login → Convex Auth `upsertUserAndAccount`:
  - มี user อยู่แล้ว → login
  - ไม่มี → **สร้าง customer** (`role` เริ่มต้นจาก Convex user doc; ระบบ business role อยู่ Neon `users` — `syncUser` เดิมทำงานต่อ)
- **ห้าม**สร้าง seller/employee/admin อัตโนมัติจาก Google login — role เหล่านั้นต้องผ่าน flow ของระบบ (seller application → อนุมัติ; employee → เจ้าของบริษัทสร้าง)

## 6. ACCOUNT LINKING

- กัน duplicate: OAuth account ถูกค้นด้วย `(provider, providerAccountId)`; `shouldLinkViaEmail` = `email_verified` ของ Google profile → **อีเมลที่ verify แล้วจะ link กับ user เดิม** (ไม่สร้างซ้ำ)
- ไม่เก็บ access/refresh token ของ Google (Convex Auth ไม่เก็บ — ใช้แค่ profile)

## 7. SELLER AUTHORIZATION

- ยังบังคับฝั่ง server (Neon `sellers.status` ผ่าน `api.commerce.mySellerStatus`)
- `RequireRole seller` ทำงานเหมือนเดิม: ไม่ใช่ seller → หน้า "คุณยังไม่ได้เป็น Seller" + [สมัครเป็น Seller] → อนุมัติแล้วจึงเข้าถึง dashboard ได้
- ห้าม trust localStorage/URL/frontend state — ทุก query/mutation ตรวจ ownership + seller scope

## 8. CENTER AUTHORIZATION

- Google login อย่างเดียว **ไม่พอ** — ต้องมี staff profile ที่บริษัทสร้าง/อนุมัติ (Neon `staff_profiles` + `users.role IN (owner/admin/staff)`)
- `RequireRole center` + RBAC เดิมทำงานต่อ; ไม่มีการสร้าง employee อัตโนมัติจาก Google login

## 9. LOGOUT

- `signOut()` → Convex Auth invalidate session → client ล้าง token → redirect ไป `/auth`
- ไม่ได้ "logout" ด้วยการลบ localStorage อย่างเดียว

## 10. OTP STATUS

- **OFF** — `EMAIL_OTP_ENABLED=false` (ค่าเริ่มต้น; ตั้ง `"true"` เพื่อเปิดใหม่)
- UI: ไม่มี email input / OTP input / countdown / resend — ลบจาก `Auth.tsx` ทั้งหมด
- Backend `convex/auth/emailOtp.ts` เก็บไว้ (provider ไม่ถูก register เมื่อ flag ปิด)

## 11. RESEND STATUS

- ไม่ใช้ Resend ในการ auth ปัจจุบัน — ไม่มีการเรียก `FREEBUFF_EMAIL_API_KEY` / `EMAIL_FROM` ใน flow ล็อกอิน
- เก็บ integration เดิมไว้ใน `convex/auth/emailOtp.ts` สำหรับอนาคต (เปิดผ่าน flag)

## 12. SECURITY

- Secret อยู่ฝั่ง Convex env เท่านั้น: `GOOGLE_CLIENT_SECRET` — **ห้าม**ใน `VITE_*`/git
- PKCE + signed state (Convex Auth) · redirect allowlist (open-redirect guard) · ตรวจ `redirectTo` ฝั่ง server
- ไม่ trust role จาก client · account linking ผ่าน verified email เท่านั้น
- Error ที่ user เห็น: 3 ข้อความที่กำหนด ("ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่" / "การเข้าสู่ระบบถูกยกเลิก" / "บัญชีนี้ไม่มีสิทธิ์เข้าถึงส่วนนี้" + network) — ไม่รั่ว request id / stack / secret / provider detail

## 13. I18N

- 3 ภาษา (th / en / my) — key ใหม่ 9 อัน (`welcome`, `googleDesc`, `googleContinue`, `signingInGoogle`, `googleError`, `googleCancelled`, `noAccess`, `terms`, `termsLink`, `privacyLink`) — parity test ผ่าน
- Thai/English แก้ใน `locales/th.ts` · `locales/en.ts`; Burmese ผ่าน patch ใน `locales/index.ts` (my.ts เกิน safe edit window — คงวิธีเดิมที่บันทึกไว้)

## 14. MOBILE

- หน้าจอเดียวกับการ์ดที่ปรับ responsive — ปุ่ม Google สูง 48px (touch target ≥44px), safe-area padding, ไม่มี overflow/scroll แนวนอน, loading state บนปุ่ม
- ไม่มี bottom nav/desktop layout ปนบนมือถือ — เป็น card ที่ขยายเต็มความกว้างจอ

## 15. DESKTOP

- Centered auth card (max 400px) บนพื้นหลัง clean — logo, headline "ยินดีต้อนรับสู่ Velnox", ปุ่ม Google, ข้อความยอมรับข้อกำหนด, guest link, footer links (Terms/Privacy/Secured by)

## 16. TESTS

- `tests/auth-google.test.ts` (ใหม่ 21 ข้อ): `buildGoogleRedirectTo` (open-redirect guard) · `classifyGoogleError` · cancellation marker · `resolveOAuthRedirect`/`allowedOAuthOrigins` (allowlist, env override, fallback)
- รวมทั้งหมด: **180 passed / 0 failed** (`bunx vitest run`)
- OTP/password UI ถูกถอดออกจาก `Auth.tsx` — การตรวจเป็น structural (ไม่มี `email-otp`/`InputOTP`/`employeePassword` อ้างอิงในหน้า auth)

## 17. BUILD

| ตรวจ | ผล |
|---|---|
| `bunx convex dev --once` | ✅ Convex functions ready (Google provider push ผ่าน) |
| `bunx tsc -b --noEmit` | ✅ 0 error |
| `bunx vitest run` | ✅ 180/180 |
| `bun run build:apps` (shop/seller/center/corporate) | ✅ ทั้ง 4 build ผ่าน |
| `bun run build` (full) | ✅ ผ่าน |

---

## ไฟล์ที่แก้/เพิ่ม

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `convex/auth.ts` | +Google provider, `callbacks.redirect` (multi-origin), `EMAIL_OTP_ENABLED` flag |
| `convex/auth_redirect.ts` | **ใหม่** — pure OAuth redirect policy (allowlist + fallback) |
| `packages/shared/src/pages/Auth.tsx` | เขียนใหม่ — Google-only login (+guest, terms), ลบ OTP/email/password UI |
| `packages/shared/src/lib/auth-flow.ts` | +Google helpers (`buildGoogleRedirectTo`, `classifyGoogleError`, cancellation marker) |
| `packages/shared/src/lib/i18n/locales/th.ts` · `en.ts` · `index.ts` | +9 auth keys (th/en/my) |
| `tests/auth-google.test.ts` | **ใหม่** — 21 test cases |

## Environment Variables ที่ต้องตั้ง (Convex deployment — Keys/API keys UI)

| ตัวแปร | จำเป็น | ค่า |
|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google Cloud OAuth Client Secret (secret — ห้ามใน VITE_*/git) |
| `AUTH_ALLOWED_ORIGINS` | ทางเลือก | JSON array ของ frontend origins (ค่าเริ่มต้น = 4 domains prod + localhost) |
| `SITE_URL` | ทางเลือก | fallback origin สำหรับ relative redirect (ถ้าไม่ตั้ง → shop.velnox.com) |
| `EMAIL_OTP_ENABLED` | ทางเลือก | `"true"` เพื่อเปิด Email OTP ใหม่ (default OFF) |

## Google Cloud Console configuration (ต้องทำ)

1. เปิด Google Cloud → **APIs & Services → OAuth consent screen** → สร้าง/เลือก project → App name "Velnox", External, เพิ่ม test users (ตอนทดสอบ)
2. **Credentials → Create credentials → OAuth client ID → Web application**
3. **Authorized redirect URIs** (สำคัญที่สุด):
   - `https://strong-buffalo-427.convex.site/api/auth/callback/google`
   - เพิ่ม custom domain ของ Convex deployment (ถ้ามี Pro) → `https://<custom-domain>/api/auth/callback/google`
4. **Authorized JavaScript origins** (เผื่อใช้ GIS ในอนาคต):
   - `https://velnox.com` · `https://shop.velnox.com` · `https://seller.velnox.com` · `https://center.velnox.com` · `http://localhost:5173`
5. คัดลอก Client ID / Client Secret → ตั้ง env ข้างบน

## Convex configuration (ต้องทำ)

- ตั้ง env 4 ตัวข้างบนผ่าน Keys/API keys UI (หรือ `npx convex env set GOOGLE_CLIENT_ID ...`)
- ไม่ต้องแก้ `convex/auth.config.ts` / `convex/http.ts` (มี `auth.addHttpRoutes` อยู่แล้ว)

## Vercel configuration (ต้องทำ)

- 4 projects (`velnox-shop` / `velnox-seller` / `velnox-center` / `velnox-corporate`) ใช้ repo เดียวกัน — Root Directory `apps/<app>` ตามเดิม
- Client env (public เท่านั้น): `VITE_CONVEX_URL` = deployment เดียวกันทั้ง 4 แอป (platform จัดการให้) + `VITE_VEL*_URL` สำหรับ cross-site links
- **ห้าม**ใส่ `GOOGLE_CLIENT_SECRET` หรือ env ฝั่ง Convex ใด ๆ ที่ Vercel

## Production test checklist (หลังตั้งค่า)

1. **Gmail A**: shop → [ดำเนินการต่อด้วย Google] → เลือกบัญชี → กลับมาที่ shop → session สร้าง → ดู profile
2. สั่งซื้อ/สมัคร seller ด้วยบัญชีเดิม → ไป seller.velnox.com → login Google → เห็น "รอตรวจสอบ" (หรือ approved)
3. **Gmail B**: login Google → สร้าง customer ใหม่ (ไม่ซ้ำ account)
4. Seller → เปิด seller.velnox.com → เข้าได้; เปิด center.velnox.com → ถูกปฏิเสธ
5. center: บัญชีที่ไม่มี staff profile → Access denied; staff/admin/owner → เข้าได้
6. ยกเลิกที่ Google chooser → กลับมาเห็น "การเข้าสู่ระบบถูกยกเลิก"
7. Logout → session invalidated → กลับ /auth

## Known limitations

- Google OAuth ต้องตั้งค่า Google Cloud + env จริงก่อนใช้งาน (ตอนนี้ code พร้อม แต่ backend ยังไม่มี credentials → การกดปุ่มจะแสดงข้อความ generic ฝั่ง client)
- Consent screen ของ Google ใช้ domain `strong-buffalo-427.convex.site` (Convex deployment) — ใช้ custom domain ต้องอัปเกรด Convex Pro + เพิ่ม redirect URI
- `Password` provider ยัง register อยู่เพื่อให้ `convex/employeeAuth.ts` (create/reset ผ่านเจ้าของบริษัท) ทำงาน — UI ไม่แสดง password form แล้ว
- ไม่มี Google button ใน corporate site (public website, ไม่มี auth ตาม design)
