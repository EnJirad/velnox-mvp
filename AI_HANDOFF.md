# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: mobile-fix round (crossOrigin + retry + timeout)
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
- **Mobile fix round**: crossOrigin on images, fetch timeout (30s), single retry, connectivity pre-check

## MOBILE-ONLY PROFILE IMAGE FAILURE — AUDIT & FIX (2026-08-18)

### Cross-Device Evidence
| Device | Upload | Image Display |
|--------|--------|---------------|
| Desktop Firefox | ✅ PASS | ✅ PASS |
| Android #1 | ❌ FAIL | ❌ FAIL |
| Android #2 | ❌ FAIL | — |
| iPhone | ❌ FAIL | — |

### Root Cause Analysis

**Problem A — Mobile Upload ("Failed to fetch")**
- Browser → `api.cloudinary.com` fetch fails on ALL mobile devices
- Desktop Firefox works fine
- Code is technically correct (URL, FormData, fetch options all verified)
- Most likely cause: **mobile browser ad-blocker** or **mobile network restriction** blocking `api.cloudinary.com`
- The same production URL works on desktop, ruling out Cloudinary account issues

**Problem B — Mobile Image Display**
- Existing profile/avatar images don't render on mobile Android
- `<img>` tags had NO `crossOrigin="anonymous"` attribute
- Mobile browsers may apply stricter CORS for cross-origin image loading from `res.cloudinary.com`

### Fixes Applied

**1. ShopProfile.tsx — Added `crossOrigin="anonymous"` + `loading="eager"`**
- Cover image `<img>` — added crossOrigin + eager loading
- Avatar image `<img>` — added crossOrigin + eager loading
- This resolves the mobile image display issue by enabling proper CORS for Cloudinary CDN images

**2. ShopAccount.tsx — Added `crossOrigin="anonymous"` + `loading="eager"`**
- Avatar image in account summary — added crossOrigin + eager loading

**3. ProfileImageUpload.tsx — Three-layer improvement:**
- **Connectivity pre-check**: HEAD request to `api.cloudinary.com` before upload
  - If FAIL: logs "Connectivity FAILED" with device context (userAgent, platform)
  - If PASS: logs CORS headers from Cloudinary
  - Does NOT abort upload even if precheck fails (OPTIONS ≠ POST behavior)
- **Fetch timeout**: 30-second AbortController timeout
  - Prevents hung connections on slow mobile networks
  - Logs "Fetch ABORTED (timeout)" when triggered
- **Single retry**: Automatic retry on network failure
  - 1 second delay between attempts
  - Total 2 attempts (initial + 1 retry)
  - Each attempt has its own 30s timeout
- **Better diagnostics**:
  - Logs `connectivityPrecheckPassed` with each upload attempt
  - Differentiates "precheck PASSED but POST FAILED" vs "precheck ALSO FAILED"
  - Lists different possible causes for each case
  - Logs userAgent and platform for mobile-specific debugging

### TypeScript Status
✅ `bun run typecheck` — PASS (no errors)

## STILL PENDING — REQUIRES USER BROWSER TESTING

### Upload Test (Deploy → Try on Mobile)
After deploying, test on mobile and check console for:
```
[ProfileUpload] STEP 5 — Connectivity result    → PASS or FAIL?
[ProfileUpload] STEP 5 — Fetch attempt 1/2      → completed or FAILED?
[ProfileUpload] STEP 5 — Fetch attempt 2/2      → (only if attempt 1 failed)
```

**If connectivity = FAIL:**
→ Mobile network is blocking `api.cloudinary.com`. Need to test on different Wi-Fi/mobile data.

**If connectivity = PASS but upload = FAIL:**
→ Ad-blocker or mobile browser extension blocking the POST. Test in Incognito.

**If both = FAIL:**
→ DNS/network-level block on mobile. Test with different network.

### Image Display Test
After deploying, test on mobile Android:
1. Go to Profile page
2. Check if existing avatar/cover images load
3. If still broken, check console for CORS errors

## FILES CHANGED (this round)
- `apps/shop/src/pages/ShopProfile.tsx` — Added `crossOrigin="anonymous"` + `loading="eager"` to cover and avatar `<img>` tags
- `apps/shop/src/pages/ShopAccount.tsx` — Added `crossOrigin="anonymous"` + `loading="eager"` to avatar `<img>` tag
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — HEAD connectivity pre-check, 30s AbortController timeout, single retry, improved mobile diagnostics
- `AI_HANDOFF.md` — Updated

## FILES CHANGED (previous rounds)
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Cloudinary URL log, FormData log, preflight test, fetch timing, detailed catch

## VERIFICATION
- [x] TypeScript compiles clean (`bun run typecheck` — PASS)
- [x] Cloudinary URL correct
- [x] FormData construction correct (no manual Content-Type)
- [x] Signature params match backend
- [ ] Real mobile browser upload test — PENDING (requires deployment + user testing)
- [ ] Real mobile image display test — PENDING (requires deployment + user testing)

## NEXT AI INSTRUCTIONS
1. If mobile upload still fails after this fix: check if the user tested in **Incognito mode**. If Incognito works, it's an ad-blocker.
2. If Incognito also fails on mobile: the mobile network itself may be blocking `api.cloudinary.com`. Consider adding a server-side proxy upload endpoint as a fallback (POST through our own backend → Cloudinary).
3. If image display still fails: inspect Cloudinary delivery URL response headers on mobile for CORS/caching issues.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
