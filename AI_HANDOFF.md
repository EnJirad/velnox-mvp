# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: google-avatar-crossorigin-fix
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
- **Google avatar fix round**: Conditional crossOrigin for Cloudinary vs Google CDN images

## GOOGLE DEFAULT PROFILE IMAGE — ROOT CAUSE & FIX (THIS ROUND)

### Problem
Google default profile image from OAuth works on Desktop Firefox but does NOT display on Mobile (Android + iPhone).

### Root Cause
The previous fix added `crossOrigin="anonymous"` to ALL profile `<img>` tags. This works for Cloudinary CDN images but **breaks Google CDN images**.

**Why it fails:**
- Google profile images are hosted on `lh3.googleusercontent.com`
- Google's CDN requires a `Referer` header to serve images
- `crossOrigin="anonymous"` on `<img>` causes the browser to send a CORS request **without** the `Referer` header
- Google blocks the request → image is invisible → `onError` hides the element

**Why Desktop Firefox still works:**
- Desktop browsers are more lenient with `<img>` CORS enforcement
- Mobile browsers (Chrome Android, Safari iOS) strictly enforce CORS for `<img>` tags

### The Fix
Changed from unconditional `crossOrigin="anonymous"` to **conditional**:
```jsx
crossOrigin={isCloudinary(url) ? "anonymous" : undefined}
```

Where `isCloudinary` checks if the URL contains `cloudinary.com`:
- **Cloudinary** (`res.cloudinary.com`): supports CORS → `crossOrigin="anonymous"` → works ✅
- **Google** (`lh3.googleusercontent.com`): requires Referer → no crossOrigin → works ✅
- **Other CDNs**: no crossOrigin → default browser behavior → works ✅

### Image Flow (verified)
```
Google OAuth → user.image (lh3.googleusercontent.com URL)
  ↓
useAuth() → user?.image
  ↓
const avatarSrc = avatarPreview ?? profile?.avatarUrl ?? user?.image ?? null
  ↓
<img src={avatarSrc} crossOrigin={isCloudinary(avatarSrc) ? "anonymous" : undefined} />
```

For Cloudinary-uploaded images:
```
Browser → Cloudinary signed upload → secure_url (res.cloudinary.com)
  ↓
saveProfileImage → database avatar_url
  ↓
myProfile() → avatarUrl
  ↓
const avatarSrc = profile.avatarUrl
  ↓
<img src={avatarSrc} crossOrigin="anonymous" />  ← works because Cloudinary supports CORS
```

### Files Changed
- `apps/shop/src/pages/ShopProfile.tsx` — Added `isCloudinary()` helper; cover and avatar `<img>` use conditional `crossOrigin`
- `apps/shop/src/pages/ShopAccount.tsx` — Added `isCloudinary()` helper; avatar `<img>` uses conditional `crossOrigin`

### TypeScript Status
✅ `bun run typecheck` — PASS (no errors)

## STILL PENDING — REQUIRES USER BROWSER TESTING

### Mobile Upload Test (Deploy → Try on Mobile)
After deploying, test upload on mobile and check console:
```
[ProfileUpload] STEP 5 — Fetch attempt 1/2     → completed or FAILED?
```

### Mobile Image Display Test
After deploying, test on mobile:
1. Login with Google on mobile
2. Check if Google default profile avatar shows
3. Upload a Cloudinary avatar → check if it shows
4. Check cover image

**Expected results:**
| Image Source | Desktop | Mobile |
|---|---|---|
| Google default avatar | ✅ shows | ✅ should now show |
| Cloudinary uploaded avatar | ✅ shows | ✅ should show |
| Cloudinary cover | ✅ shows | ✅ should show |

## PREVIOUSLY FIXED
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Removed HEAD precheck, kept retry+timeout, improved diagnostics
- `apps/shop/src/pages/ShopProfile.tsx` — Added crossOrigin (now conditional)
- `apps/shop/src/pages/ShopAccount.tsx` — Added crossOrigin (now conditional)

## VERIFICATION
- [x] TypeScript compiles clean
- [x] Cloudinary URL correct
- [x] FormData construction correct (no manual Content-Type)
- [x] Signature params match backend
- [x] Removed misleading precheck
- [x] Google avatar: removed crossOrigin for non-Cloudinary URLs
- [ ] Real mobile Google avatar display test — PENDING
- [ ] Real mobile upload test — PENDING
- [ ] Real mobile Cloudinary image display test — PENDING

## NEXT AI INSTRUCTIONS
1. If Google avatar still doesn't show on mobile after this fix: test direct URL `https://lh3.googleusercontent.com/...` on the mobile device to verify Google CDN connectivity.
2. If upload still fails on mobile: the issue is CORS for `api.cloudinary.com` POST with FormData. Check Cloudinary Cloud Settings → Upload → Allowed origins.
3. As a last resort: add a Convex HTTP action proxy for Cloudinary uploads to bypass browser CORS.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
