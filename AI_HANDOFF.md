# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: cloudinary-upload-proxy-fallback
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
- **Google avatar fix rounds**: Conditional crossOrigin, `||` chain, ShopAccount fallback, ShopHeader avatar
- **Cloudinary upload proxy (this round)**: Convex HTTP proxy fallback for mobile browsers

## CLOUDINARY UPLOAD PROXY — THIS ROUND

### Problem
Desktop Firefox: Cloudinary browser upload = WORKS
Android/iPhone: Cloudinary browser upload = FAILS with "Failed to fetch"

Mobile can reach `api.cloudinary.com` (403 from navigation = connectivity OK).
No CSP, no Service Worker, no Vercel headers blocking.

### Root Cause
The `fetch()` POST with `FormData` to `api.cloudinary.com` triggers a CORS preflight (OPTIONS request) on mobile browsers. Cloudinary's upload endpoint returns different CORS headers for the OPTIONS preflight from mobile browsers — or mobile carrier proxy/firewall intercepts the multipart POST. Desktop Firefox is more lenient with CORS enforcement.

**Evidence:**
- Desktop Firefox: POST works (lenient CORS)
- Mobile Chrome/Safari: `TypeError: Failed to fetch` (strict CORS / carrier proxy)
- Mobile navigation to `https://api.cloudinary.com` returns 403 (connectivity OK, server reachable)
- No CSP headers, no Service Worker, no `vercel.json`

### The Fix
Added a **Convex HTTP proxy** as a fallback. Upload flow is now:

```
1. Browser tries DIRECT upload to api.cloudinary.com
   → Works on desktop ✅
   → Fails on mobile with "Failed to fetch" ❌

2. On failure: falls back to Convex HTTP proxy
   → POST https://unique-clownfish-66.convex.site/cloudinary/upload
   → Convex forwards to api.cloudinary.com (server-side, no CORS)
   → Works on mobile ✅
```

**Architecture is preserved**: direct upload is still the primary path. The proxy is only used when the browser cannot reach Cloudinary directly.

### Files Changed

#### `convex/http.ts`
Added route:
```
POST /cloudinary/upload
```
- Receives the exact same FormData the browser would send to Cloudinary
- Forwards raw body (ArrayBuffer) to `api.cloudinary.com/v1_1/{cloudName}/image/upload`
- Returns Cloudinary response to browser
- No secrets logged, no binary through Convex DB

#### `apps/shop/src/components/shop/ProfileImageUpload.tsx`
- Added `getProxyUploadUrl()` helper (reads `VITE_CONVEX_URL`)
- Upload flow: try direct → on failure, try proxy → if both fail, show error
- Detailed logging: which path was used (direct vs proxy)
- Added `usedProxy` flag for diagnostics

### Upload Flow Diagram
```
Browser picks file
  ↓
Client validation (MIME type, size ≤ 10MB)
  ↓
getProfileImageUploadSignature → signed params
  ↓
FormData (file + api_key + timestamp + folder + public_id + signature + allowed_formats)
  ↓
┌─────────────────────────────────┐
│ 1. TRY DIRECT:                  │
│ fetch(api.cloudinary.com/...)   │
│                                 │
│ Desktop → SUCCESS ✅            │
│ Mobile  → "Failed to fetch" ❌  │
└─────────────────────────────────┘
  ↓ (on mobile failure)
┌─────────────────────────────────┐
│ 2. FALLBACK: Convex proxy       │
│ fetch(convex.site/cloudinary/   │
│        upload)                  │
│                                 │
│ Mobile  → SUCCESS ✅            │
│ (server-side: no CORS)          │
└─────────────────────────────────┘
  ↓
Cloudinary response (public_id, url, etc.)
  ↓
saveProfileImage → Neon DB
  ↓
Profile updated
```

### TypeScript Status
✅ `bun run typecheck` — PASS (no errors)

## STILL PENDING — REQUIRES USER BROWSER TESTING

### Mobile Upload Test (Deploy → Try on Mobile)
After deploying:
1. Upload a 100KB JPG on Android
2. Upload a 100KB JPG on iPhone
3. Check console logs:
   - `[ProfileUpload] STEP 5 — direct upload FAILED` → proxy was used
   - `[ProfileUpload] STEP 5 — Upload succeeded via proxy` → proxy worked ✅
4. Verify profile image appears after upload

**Expected behavior:**
| Device | Direct Upload | Proxy Fallback | Profile Image |
|---|---|---|---|
| Desktop | ✅ works | not needed | ✅ shows |
| Android | ❌ fails → proxy | ✅ works | ✅ shows |
| iPhone | ❌ fails → proxy | ✅ works | ✅ shows |

### IMPORTANT: Deploy Convex Functions
The proxy route is in `convex/http.ts`. After pushing to git:
1. Convex auto-deploys (if CI is configured)
2. Or manually: `npx convex deploy`
3. The proxy URL will be: `https://{deployment}.convex.site/cloudinary/upload`

### Verify Environment Variables
The proxy reads `VITE_CONVEX_URL` on the frontend to build the proxy URL.
Ensure this env var is set in Vercel:
- `VITE_CONVEX_URL=https://unique-clownfish-66.convex.cloud` (or the correct deployment URL)

## PREVIOUSLY FIXED (kept)
- `apps/shop/src/pages/ShopProfile.tsx` — `||` chain for avatar resolution, conditional crossOrigin
- `apps/shop/src/pages/ShopAccount.tsx` — Google image fallback, `||` chain, conditional crossOrigin
- `apps/shop/src/components/shop/ShopHeader.tsx` — User avatar with onError fallback
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Retry + timeout + proxy fallback

## VERIFICATION
- [x] TypeScript compiles clean
- [x] Cloudinary URL correct
- [x] FormData construction correct (no manual Content-Type)
- [x] Signature params match backend
- [x] Google avatar: conditional crossOrigin + `||` chain
- [x] Convex HTTP proxy route added
- [x] Frontend: direct first, proxy fallback
- [ ] Real mobile upload test — PENDING
- [ ] Real mobile proxy path verification — PENDING
- [ ] Real mobile profile image display — PENDING

## NEXT AI INSTRUCTIONS
1. After deploying, test upload on mobile. If proxy works: DONE. If proxy also fails: check Convex deployment logs for the `/cloudinary/upload` route.
2. If both direct AND proxy fail on mobile: the issue is NOT CORS. It's network-level (carrier firewall). In that case, consider: smaller file sizes, different upload timing, or retry with exponential backoff.
3. If you need to remove the proxy: revert `convex/http.ts` route and simplify `ProfileImageUpload.tsx` to only use direct upload.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
