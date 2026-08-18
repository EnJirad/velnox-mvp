# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: server-side-upload
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core, `convex/` = shared Convex layer
- Stack: Bun · Vite · React 19 · TypeScript · Tailwind · shadcn/ui · Convex + Convex Auth · Neon PostgreSQL · Cloudinary

## COMPLETED
- VelShop storefront: catalog/detail, cart, checkout, orders, wishlist, categories, VelRepeat, notifications, search
- Profile: avatar + cover upload via **server-side Cloudinary upload** (no browser→Cloudinary), edit profile, logout
- Auth: Convex Auth, RequireAuth, login flash guard
- **cf223c47**: Fixed Cloudinary signature algorithm (SHA-1 not HMAC)
- **a547e6c3**: Toast shows real Cloudinary error on HTTP fail
- **Network diagnostics round**: Full STEP logging, error ID, preflight test, fetch timing
- **Mobile fix round**: crossOrigin on images, fetch timeout (30s), single retry
- **Precheck-removed round**: Removed misleading HEAD precheck, kept retry+timeout
- **Google avatar fix rounds**: Conditional crossOrigin, `||` chain, ShopAccount fallback, ShopHeader avatar
- **Cloudinary upload proxy (old)**: Convex HTTP proxy fallback for mobile browsers → replaced by server-side upload
- **Proxy FormData fix**: Fixed 404 by switching from ArrayBuffer to FormData forwarding → replaced by server-side upload
- **Visible debug panel (old)**: On-failure debug panel with copy-to-clipboard → removed in favor of server-side upload
- **Server-side Cloudinary upload (this round)**: Browser sends file to Convex HTTP → Convex uploads to Cloudinary → Neon DB → result

## PROFILE IMAGE UPLOAD — CURRENT ARCHITECTURE

### New Flow (server-side — PRODUCTION)

```
Mobile/Desktop Browser
  ↓
POST <convex-url>/cloudinary/upload-profile
  FormData: { file, uploadType: "avatar"|"cover" }
  ↓
Convex HTTP Action (edge runtime)
  ↓
1. Parse + validate file (type, size ≤10 MB)
2. ctx.runAction(api.customer.getProfileImageUploadSignature, { kind })
   → authenticates user (Convex Auth cookies)
   → rate limit check
   → generates Cloudinary signed params (server-side)
3. POST to api.cloudinary.com (server-side fetch — NO CORS)
   FormData: { file, api_key, timestamp, folder, public_id, signature, allowed_formats }
4. Parse Cloudinary response
5. ctx.runAction(api.customer.saveProfileImage, { kind, publicId, format, bytes, width, height })
   → validates format/size server-side
   → saves URL to Neon users table
   → cleans up old image on Cloudinary
6. Return { success: true, profile: { avatarUrl, coverUrl, ... } }
```

### Why This Architecture Works on Mobile

The old architecture failed because:
- Browser → Cloudinary direct upload triggered CORS preflight (OPTIONS)
- Mobile browsers/carrier proxies blocked or interfered with the multipart POST
- Convex HTTP proxy still had issues with Cloudflare Workers ArrayBuffer forwarding

The new architecture works because:
- Browser only needs to reach OUR Convex endpoint (no CORS issues — same-origin-like)
- Convex server uploads to Cloudinary server-side (no CORS — server to server)
- Cloudinary credentials stay server-side (never exposed to browser)

### Files Changed

| File | Change |
|------|--------|
| `convex/http.ts` | Replaced old proxy (`/cloudinary/upload`) with server-side upload endpoint (`/cloudinary/upload-profile`). Validates file, calls getProfileImageUploadSignature via ctx.runAction, uploads to Cloudinary server-side, calls saveProfileImage via ctx.runAction, returns result. |
| `apps/shop/src/components/shop/ProfileImageUpload.tsx` | Simplified from ~500 lines to ~170 lines. Removed: direct Cloudinary upload, proxy fallback, signature request, debug panel, FormData construction. Now just POSTs file + uploadType to Convex endpoint. |
| `apps/shop/src/pages/ShopProfile.tsx` | `||` chain for avatar resolution, conditional crossOrigin (from earlier round) |
| `apps/shop/src/pages/ShopAccount.tsx` | Google image fallback, `||` chain, conditional crossOrigin (from earlier round) |
| `apps/shop/src/components/shop/ShopHeader.tsx` | User avatar with onError fallback (from earlier round) |

### Convex Environment Status

```
CLOUDINARY_CLOUD_NAME  = ✅ present in Convex deployment
CLOUDINARY_API_KEY     = ✅ present in Convex deployment
CLOUDINARY_API_SECRET  = ✅ present in Convex deployment
```

These are Convex deployment env vars. The server-side upload reads them via `process.env` in `backend/storage.ts`.

### Authentication Flow

1. Browser sends file + uploadType to Convex HTTP endpoint
2. Convex Auth session cookie is included in the request
3. `ctx.runAction(api.customer.getProfileImageUploadSignature, ...)` propagates auth
4. `requireIdentity(ctx)` inside the action verifies the user via Convex Auth identity
5. If not authenticated → 401 returned to browser
6. If rate limited → 429 returned to browser

### Error Handling

The endpoint returns structured JSON:

```json
{
  "success": false,
  "code": "CLOUDINARY_ERROR",
  "message": "อัปโหลดไม่สำเร็จ (HTTP 400)"
}
```

Error codes:
- `INVALID_FORM_DATA` — multipart parse failure
- `MISSING_FILE` — no file in request
- `INVALID_FILE_TYPE` — unsupported MIME/extension
- `FILE_TOO_LARGE` — > 10 MB
- `SIGNATURE_FAILED` — backend signature generation failed
- `RATE_LIMITED` — too many uploads
- `AUTH_REQUIRED` — not signed in
- `CLOUDINARY_NETWORK_ERROR` — couldn't reach Cloudinary
- `CLOUDINARY_ERROR` — Cloudinary rejected the upload
- `DATABASE_ERROR` — Cloudinary succeeded but DB save failed
- `UPLOAD_FAILED` — unexpected error

## GOOGLE AVATAR FIX (kept)

- `ShopProfile.tsx`: `||` chain (not `??`) — empty string from backend treated as "no image"
- `ShopAccount.tsx`: `useAuth()` + `user?.image` fallback
- `ShopHeader.tsx`: User avatar with `imgFailed` state + `onError` fallback
- `crossOrigin="anonymous"` only on Cloudinary images (conditional via `isCloudinary()`)

## STILL PENDING — REQUIRES REAL DEVICE TESTING

### Mobile Upload Test
After deploying:
1. **Android:** Login → Profile → Upload JPG → Should succeed ✅
2. **iPhone:** Login → Profile → Upload JPG → Should succeed ✅
3. **Desktop:** Login → Profile → Upload JPG → Should succeed ✅

### What to look for in console
```
[ProfileUpload] File validated
[ProfileUpload] POST to Convex endpoint
[ProfileUpload] Response { status: 200, success: true }
[ProfileUpload] SUCCESS
```

### Verification Checklist
- [ ] Mobile: profile avatar upload works
- [ ] Mobile: cover image upload works
- [ ] Desktop: profile avatar upload works
- [ ] Desktop: cover image upload works
- [ ] Google avatar displays on mobile
- [ ] Cloudinary avatar displays on mobile
- [ ] Old image cleanup works (upload B → B visible → A deleted from Cloudinary)
- [ ] No TypeScript errors
- [ ] AI_HANDOFF.md updated ✅

## PREVIOUSLY FIXED (kept)
- `apps/shop/src/pages/ShopProfile.tsx` — `||` chain for avatar resolution, conditional crossOrigin
- `apps/shop/src/pages/ShopAccount.tsx` — Google image fallback, `||` chain, conditional crossOrigin
- `apps/shop/src/components/shop/ShopHeader.tsx` — User avatar with onError fallback

## NEXT AI INSTRUCTIONS
1. If upload fails with `SIGNATURE_FAILED`: check that `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are set in Convex deployment env.
2. If upload fails with `AUTH_REQUIRED`: the user is not signed in — check Convex Auth session.
3. If upload fails with `CLOUDINARY_ERROR`: check Cloudinary dashboard for error details (signature mismatch, format rejected, etc.).
4. If upload succeeds but profile doesn't update: check `saveProfileImage` in `convex/customer.ts` for DB errors.
5. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
6. Do NOT revert to browser→Cloudinary direct upload — it doesn't work on mobile.
