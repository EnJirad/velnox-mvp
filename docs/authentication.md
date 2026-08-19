# VELNOX — Authentication

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. ระบบ

- **Convex Auth** (Email OTP + anonymous guest + **Password** สำหรับพนักงาน velcenter) — provider เดียวทั้ง 4 เว็บ (main, velshop, velseller, velcenter)
- Session = httpOnly cookie จัดการโดย Convex backend — **ไม่เก็บ token ใน localStorage**
- OTP: อายุ 15 นาที, 6 หลัก, built-in rate limit สำหรับ sign-in/OTP
- **Password (velcenter, spec §9–§11)**: `Password` provider ใน `convex/auth.ts` — hash scrypt เก็บใน `authAccounts` เท่านั้น; การสร้าง/รีเซ็ตพนักงาน + บังคับตั้งรหัสใหม่ (`mustChangePassword`) อยู่ใน `convex/employeeAuth.ts`; policy อยู่ใน `backend/passwords.ts`
- `convex/auth.ts` + `convex/auth/emailOtp.ts` มีการปรับแล้ว (เพิ่ม Password provider, OTP key ผ่าน env `FREEBUFF_EMAIL_API_KEY`) — secret ยังห้าม commit; ตั้งผ่าน Keys/API keys UI เท่านั้น

## 2. Environment (Convex deployment env — ต้องครบใน prod)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `SITE_URL` | auth redirects |
| `JWT_PRIVATE_KEY` | sign session JWTs |
| `JWKS` | public keys สำหรับ verify |

## 3. ฝั่ง frontend

- `ConvexAuthProvider` (`@convex-dev/auth/react`) + `useConvexAuth`/`useAuthActions` — ทุก entry
- Protected routes: `RequireAuth` wrapper (`src/components/RequireAuth.tsx`) — redirect `?returnTo=...`
- Guest browsing: ดูสินค้าได้โดยไม่ login; ต้อง login ก่อน cart/checkout/order/wishlist/review/address (§4)

## 4. ระดับการเข้าถึง (ดูเพิ่ม: `authorization.md`)

| หน้า | ไม่ login | login |
|---|---|---|
| shop browse/search/product/shop | ✅ | ✅ |
| cart/checkout/orders/profile/addresses/wishlist/notifications | ❌ → /auth | ✅ |
| seller dashboard/velseller | ❌ | ต้องเป็น seller |
| velcenter | ❌ | ต้อง staff/admin/owner |

## 5. Account sync (Convex → Neon)

- `src/backend/identity.ts` `requireIdentity()`: ตรวจ `getUserIdentity()` → ตรวจ/สร้าง row ใน `users` (Neon) โดย `convex_id`
- role จริง (customer/seller/staff/admin/owner) อยู่ที่ Neon — frontend ไม่เคยเป็นผู้ตัดสิน

## 6. สิ่งที่ยังไม่มี (ระบุตรง ๆ)

- Email verification / password reset แยก (OTP คือ recovery ในตัว — decision D6)
- MFA สำหรับ VelCenter (Phase 12 / auth provider)
- Session timeout/revocation UI (Convex จัดการ session อัตโนมัติ)
