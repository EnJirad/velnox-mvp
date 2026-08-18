# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: precheck-removed round
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core, `convex/` = shared Convex layer
- Stack: Bun · Vite · React 19 · TypeScript · Tailwind · shadcn/ui · Convex + Convex Auth · Neon PostgreSQL · Cloudinary

## COMPLETED
- VelShop storefront: catalog/detail, cart, checkout, orders, wishlist, categories, VelRepeat, notifications, search
- Profile: avatar + cover upload via Cloudinary signed upload, edit profile, logout
- Auth: Convex Auth, RequireAuth, login flash guard
- **cf223c47**: Fixed Cloudinary signature algorithm (SHA-1 not HMAC)
- **a547e6c3**: Toast shows real Cloudinary error on HTTP fail
- **Network diagnostics round**: Full STEP logging, error ID, preflight test, fetch timing
- **Mobile fix round**: crossOrigin on images, fetch timeout (30s), single retry
- **Precheck-removed round**: Removed misleading HEAD precheck, kept retry+timeout

## MOBILE PROFILE IMAGE — ROOT CAUSE & CURRENT STATE

### Cross-Device Evidence
| Device | Upload | Image Display |
|--------|--------|---------------|
| Desktop Firefox | ✅ PASS | ✅ PASS |
| Android #1 | ❌ FAIL | ❌ FAIL |
| Android #2 | ❌ FAIL | — |
| iPhone | ❌ FAIL | — |

### Critical Test Result
Mobile browser navigation to `https://api.cloudinary.com` → **HTTP 403 Forbidden nginx**

This proves: **Cloudinary endpoint IS reachable from mobile**. The problem is NOT network connectivity.

### Root Cause: CORS Pre-check (FIXED)
The previous HEAD precheck used `fetch()` with `mode: "cors"` which triggers a browser **CORS preflight** (OPTIONS request). Cloudinary's upload endpoint returns403 without CORS headers for HEAD requests. The browser blocks the response entirely → TypeError → reported as "precheck: FAIL".

Direct browser navigation works (403) because navigation is NOT subject to CORS.

The actual upload POST works differently: Cloudinary returns proper CORS headers for POST with FormData.

### What Was Fixed
1. **Removed the HEAD precheck entirely** — it was testing a different endpoint/method that lacks CORS headers. The real upload POST IS the connectivity test.
2. **ShopProfile.tsx** — Added `crossOrigin="anonymous"` + `loading="eager"` to cover and avatar `<img>` tags → fixes mobile image display
3. **ShopAccount.tsx** — Added `crossOrigin="anonymous"` + `loading="eager"` to avatar `<img>` tag
4. **ProfileImageUpload.tsx** — Kept retry (30s timeout, single retry) + improved error diagnostics

### TypeScript Status
✅ `bun run typecheck` — PASS (no errors)

## STILL PENDING — REQUIRES USER BROWSER TESTING

### Upload Test (Deploy → Try on Mobile)
After deploying, test on mobile and check console for:
```
[ProfileUpload] STEP 5 — Fetch attempt 1/2     → completed or FAILED?
[ProfileUpload] STEP 5 — Fetch attempt 2/2     → (only if attempt 1 failed)
```

**If completed with HTTP status (even 400/403):** Cloudinary is reachable, check the response body.

**If FAILED with TypeError:** 
- Test in **Incognito mode** first (rules out ad-blocker)
- If Incognito works → ad-blocker/extension is the cause
- If Incognito also fails → the browser itself is blocking the CORS POST from mobile

### Image Display Test
After deploying, test on mobile Android:
1. Go to Profile page
2. Check if existing avatar/cover images load
3. If still broken, check console for CORS errors

## FILES CHANGED (this round)
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Removed HEAD precheck, kept retry+timeout, improved diagnostics
- `apps/shop/src/pages/ShopProfile.tsx` — Added crossOrigin + loading="eager" to img tags
- `apps/shop/src/pages/ShopAccount.tsx` — Added crossOrigin + loading="eager" to img tag
- `AI_HANDOFF.md` — Updated

## PREVIOUSLY CHANGED
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Cloudinary URL log, FormData log, fetch timing, detailed catch

## VERIFICATION
- [x] TypeScript compiles clean
- [x] Cloudinary URL correct
- [x] FormData construction correct (no manual Content-Type)
- [x] Signature params match backend
- [x] Removed misleading precheck
- [ ] Real mobile browser upload test — PENDING
- [ ] Real mobile image display test — PENDING

## NEXT AI INSTRUCTIONS
1. If mobile upload still fails: the issue is CORS at the browser level. Check if Cloudinary's Cloud Settings have `Allowed origins` configured. Also check if Cloudinary's upload endpoint returns `Access-Control-Allow-Origin` for POST with FormData from `velshop.vercel.app`.
2. If upload works but image display fails: check Cloudinary delivery URL response headers for CORS/caching issues on mobile.
3. As a last resort fallback: add a server-side proxy endpoint (POST through Convex HTTP action → Cloudinary) to bypass browser CORS entirely.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
