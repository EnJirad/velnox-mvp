# AI_HANDOFF.md — Velnox Image Upload Rebuild

## OLD Architecture (BROKEN)

```
Browser → Cloudinary REST API (direct)
```

- The browser made direct HTTP requests to `api.cloudinary.com`
- Required client-side Cloudinary API key, signature, or token
- Failed on Android and iPhone (HTTP 404, CORS, mobile browser restrictions)

## NEW Architecture (FINAL)

```
Browser → Convex "use node" Action → Cloudinary Node.js SDK → Cloudinary
           ↓ (after success)
         Convex Mutation → Database
```

- The browser NEVER touches Cloudinary directly
- No Cloudinary credentials exposed to the client
- Server-side upload using the official `cloudinary` npm SDK (v2.10.0)
- Mobile-safe: all requests go through Convex, not direct to Cloudinary

---

## Implementation Details

### Backend

| Item | Detail |
|------|--------|
| **Upload action** | `src/convex/upload.ts` — Convex action with `"use node"` directive |
| **Runtime** | Node.js (via `"use node"` — accesses `process.env`, npm packages) |
| **SDK** | `cloudinary` v2.10.0 (official Node.js SDK) |
| **SDK config** | `cloudinary.v2.config()` using env vars |
| **Upload method** | `cloudinary.uploader.upload(dataUrl, options)` with `overwrite: true` |
| **Environment variables** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Auth** | `ctx.auth.getUserIdentity()` — extracts userId from JWT, never trusts browser |
| **DB mutations** | `users.updateProfileImage`, `users.updateCoverImage`, `sellers.updateStoreLogo`, `sellers.updateStoreBanner` |
| **DB update timing** | ONLY after Cloudinary upload succeeds (fail → no DB change) |

### Upload Paths (Cloudinary)

| Upload Type | Folder | Public ID | Overwrite |
|-------------|--------|-----------|-----------|
| `profile` | `velnox/profiles/<userId>` | `avatar` | Yes |
| `cover` | `velnox/covers/<userId>` | `cover` | Yes |
| `logo` | `velnox/sellers/<sellerId>/logo` | `logo` | Yes |
| `banner` | `velnox/sellers/<sellerId>/banner` | `banner` | Yes |

### Validation

| Rule | Value |
|------|-------|
| Max file size | 10 MB (server-side check) |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif` |
| Client compression | Canvas API → JPEG 85% quality, max 1200px dimension |
| Error code for oversized | `FILE_TOO_LARGE`, HTTP 413 |
| Thai message | `ไฟล์มีขนาดใหญ่เกิน 10 MB` |

### Frontend

| Item | Detail |
|------|--------|
| **Compression helper** | `src/lib/upload.ts` — `compressImage()` uses Canvas API |
| **Upload hook** | `src/hooks/use-image-upload.ts` — `useImageUpload()` wraps `useAction` |
| **Upload component** | `src/components/ImageUploadButton.tsx` — reusable with preview, progress, debug |
| **Dashboard integration** | `src/pages/Dashboard.tsx` — profile avatar + cover image |
| **Seller integration** | `src/pages/Seller.tsx` — store logo + store banner (Settings tab) |

### Image Priority (avatar)

```
1. Custom uploaded avatar (users.image)
2. Google profile image (user.image from OAuth)
3. Default fallback (initials)
```

### Error Response Structure

```json
{
  "success": false,
  "code": "CLOUDINARY_UPLOAD_FAILED",
  "message": "Cloudinary upload failed: ...",
  "debug": {
    "uploadRoute": "SERVER",
    "step": "CLOUDINARY_SERVER_UPLOAD",
    "cloudinaryErrorCode": "...",
    "cloudinaryErrorMessage": "..."
  }
}
```

### Debug Panel

- Temporarily visible in the upload component
- Shows: upload route, step, MIME type, file size, Cloudinary status
- Does NOT show: API secret, signature, tokens, authorization headers

---

## Schema Changes

### `users` table — added `coverUrl`

```typescript
coverUrl: v.optional(v.string()), // cover/banner image URL
```

### Existing fields used

- `users.image` — profile avatar URL (already existed)
- `sellers.logo` — store logo URL (already existed)
- `sellers.banner` — store banner URL (already existed)

---

## Files Changed/Created

| File | Action |
|------|--------|
| `src/convex/schema.ts` | Added `coverUrl` field to users table |
| `src/convex/upload.ts` | **NEW** — Node.js action with Cloudinary SDK |
| `src/convex/users.ts` | Added `updateProfileImage` and `updateCoverImage` mutations |
| `src/convex/sellers.ts` | Added `updateStoreLogo` and `updateStoreBanner` mutations |
| `src/lib/upload.ts` | Client-side compression + validation helpers |
| `src/hooks/use-image-upload.ts` | **NEW** — React hook wrapping Convex `useAction` |
| `src/components/ImageUploadButton.tsx` | **NEW** — Reusable upload UI with debug panel |
| `src/pages/Dashboard.tsx` | Added profile avatar + cover image upload UI |
| `src/pages/Seller.tsx` | Added store logo + store banner upload to Settings tab |
| `package.json` | Added `cloudinary` v2.10.0 dependency |

---

## Environment Variables Required

Set these in **Convex Dashboard → Settings → Environment Variables**:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

⚠️ **Do NOT expose `CLOUDINARY_API_SECRET` to the browser, frontend bundle, or public variables.**

---

## Testing Status

| Platform | Profile | Cover | Logo | Banner |
|----------|---------|-------|------|--------|
| Desktop Chrome | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING |
| Android Chrome | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING |
| iPhone Safari | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING | ⬜ PENDING |

**Status: MOBILE REAL DEVICE TEST: PENDING**

Reason: Cannot perform real device testing in this environment. The architecture eliminates the known mobile failure points (direct browser→Cloudinary requests, CORS issues, mobile browser upload restrictions) by routing everything through the Convex server. All validation, type checking, and Convex deployment have passed.

---

## Removed Old Code

- No `getProfileImageUploadSignature` endpoint existed (was not yet implemented)
- No direct `api.cloudinary.com` browser requests existed (was not yet implemented)
- The old proxy/signature approach was never deployed — this is a fresh implementation
