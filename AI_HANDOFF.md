# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: google-avatar-mobile-fix
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
- **Google avatar fix round (previous)**: Conditional crossOrigin for Cloudinary vs Google CDN images
- **Google avatar mobile fix (this round)**: Fixed `??` → `||` in avatar chains, added Google image fallback to ShopAccount, added avatar to ShopHeader

## GOOGLE AVATAR MOBILE FIX — THIS ROUND

### Problem
Google default profile image from OAuth still does NOT display on Mobile (Android + iPhone) even after the previous `crossOrigin` conditional fix.

### Root Causes Found (3 issues)

#### Issue 1: `??` vs `||` in avatar resolution chain (ShopProfile.tsx)
The avatar resolution chain used `??` (nullish coalescing):
```jsx
const avatarSrc = avatarPreview ?? profile?.avatarUrl ?? user?.image ?? null;
```

`??` only treats `null` and `undefined` as fallback triggers. If the backend returns an empty string `""` for `avatarUrl` (e.g. user has no profile image), then:
- `avatarSrc = ""` (empty string)
- `""` is falsy in JSX → shows initial letter, NOT the Google image
- The Google image fallback (`user?.image`) is **never reached**

**Fix:** Changed to `||` (logical OR):
```jsx
const avatarSrc = avatarPreview || profile?.avatarUrl || user?.image || null;
```

`||` treats all falsy values (null, undefined, empty string) as fallback triggers → Google image is correctly reached.

#### Issue 2: ShopAccount.tsx missing Google image fallback
ShopAccount.tsx did NOT import `useAuth()` and did NOT use `user?.image`. It only used `profile?.avatarUrl`:
```jsx
// BEFORE: no Google fallback
{profile?.avatarUrl ? (
  <img src={profile.avatarUrl} ... />
) : (
  // initial letter
)}
```

**Fix:** Import `useAuth()`, add `user?.image` to avatar resolution chain:
```jsx
const { user } = useAuth();
const avatarDisplaySrc = profile?.avatarUrl || user?.image || null;
// ...
{avatarDisplaySrc ? (
  <img src={avatarDisplaySrc} ... />
) : (
  // initial letter
)}
```

#### Issue 3: ShopHeader.tsx showing generic User icon, not avatar
The header profile link showed a generic `<User>` icon, never the user's actual avatar.

**Fix:** Added `user?.image` rendering with `onError` fallback to generic icon:
```jsx
{user?.image && !imgFailed ? (
  <img src={user.image} className="size-7 rounded-full object-cover" onError={() => setImgFailed(true)} />
) : (
  <User className="size-5" />
)}
```

### Image Priority Chain (all pages)
```
1. Custom uploaded avatar (Cloudinary avatarUrl)
2. Google profile image (user.image from OAuth)
3. Initial letter fallback
```

### Image Flow
```
Google OAuth → user.image (lh3.googleusercontent.com)
  ↓
useAuth() → user?.image
  ↓
avatarSrc = avatarPreview || profile?.avatarUrl || user?.image || null
  ↓
<img src={avatarSrc} crossOrigin={isCloudinary(avatarSrc) ? "anonymous" : undefined} />
```

### Files Changed (this round)
- `apps/shop/src/pages/ShopProfile.tsx` — Changed `??` to `||` in avatar/cover resolution chains
- `apps/shop/src/pages/ShopAccount.tsx` — Added `useAuth()` import, added `user?.image` fallback, used `||` chain, added `isCloudinary()` conditional crossOrigin
- `apps/shop/src/components/shop/ShopHeader.tsx` — Added `useEffect` import, `imgFailed` state, renders user avatar with `onError` fallback to `<User>` icon

### TypeScript Status
✅ `bun run typecheck` — PASS (no errors)

## STILL PENDING — REQUIRES USER BROWSER TESTING

### Mobile Google Avatar Test (Deploy → Try on Mobile)
After deploying, test on mobile:
1. Login with Google on mobile → check if Google default profile avatar shows in header, profile page, and account page
2. Upload a Cloudinary avatar → check if it shows
3. Check cover image

**Expected results:**
| Image Source | Desktop | Mobile (Android) | Mobile (iPhone) |
|---|---|---|---|
| Google default avatar | ✅ shows | ✅ should now show | ✅ should now show |
| Cloudinary uploaded avatar | ✅ shows | ✅ should show | ✅ should show |
| Cloudinary cover | ✅ shows | ✅ should show | ✅ should show |

### Mobile Upload Test
After deploying, test upload on mobile and check console:
```
[ProfileUpload] STEP 5 — Fetch attempt 1/2     → completed or FAILED?
```

## PREVIOUSLY FIXED (kept)
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Removed HEAD precheck, kept retry+timeout, improved diagnostics
- `apps/shop/src/pages/ShopProfile.tsx` — Added crossOrigin (now conditional) + `||` chain
- `apps/shop/src/pages/ShopAccount.tsx` — Added crossOrigin (now conditional) + Google image fallback + `||` chain
- `apps/shop/src/components/shop/ShopHeader.tsx` — Added user avatar with onError fallback

## VERIFICATION
- [x] TypeScript compiles clean
- [x] Cloudinary URL correct
- [x] FormData construction correct (no manual Content-Type)
- [x] Signature params match backend
- [x] Removed misleading precheck
- [x] Google avatar: conditional crossOrigin for non-Cloudinary URLs
- [x] Avatar chain uses `||` (handles empty strings from backend)
- [x] ShopAccount includes Google image fallback
- [x] ShopHeader shows user avatar with fallback
- [ ] Real mobile Google avatar display test — PENDING
- [ ] Real mobile upload test — PENDING
- [ ] Real mobile Cloudinary image display test — PENDING

## NEXT AI INSTRUCTIONS
1. If Google avatar still doesn't show on mobile after this fix: inspect browser Console → Network to see if `lh3.googleusercontent.com` request appears and what status it returns.
2. If the Google image request returns 403 on mobile: Google may require referrer. Add `referrerPolicy="no-referrer"` to the `<img>` tag as a test.
3. If upload still fails on mobile: the issue is CORS for `api.cloudinary.com` POST with FormData. Check Cloudinary Cloud Settings → Upload → Allowed origins.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
