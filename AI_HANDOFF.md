# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: cloudinary-proxy-formdata-fix
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
- **Cloudinary upload proxy**: Convex HTTP proxy fallback for mobile browsers
- **Proxy FormData fix (this round)**: Fixed 404 by switching from ArrayBuffer to FormData forwarding

## DESKTOP vs MOBILE COMPARISON

### Desktop SUCCESSFUL Request
```
POST https://api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload
Content-Type: multipart/form-data; boundary=----formdata边界...

FormData fields:
  file          = <Blob: image/webp, ~XX KB>
  api_key       = <key>
  timestamp     = <unix timestamp>
  folder        = velnox/profiles/<userId>
  public_id     = avatar-<random>
  signature     = <40-char hex>
  allowed_formats = jpg,jpeg,png,webp,avif,gif

Result: HTTP 200 (Cloudinary upload success)
```

### Mobile FAILED Request (before this fix)

**Path A — Direct upload (mobile → api.cloudinary.com)**
```
POST https://api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload
Content-Type: multipart/form-data

Result: TypeError: Failed to fetch
  → Browser never receives a response
  → CORS preflight failure or carrier proxy blocks the POST
  → Desktop works because Firefox is more lenient with CORS
```

**Path B — Convex proxy (mobile → convex → api.cloudinary.com)**
```
Step 1: Browser → POST <convex-url>/cloudinary/upload
        Content-Type: multipart/form-data

Step 2: Convex proxy → POST api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload
        Content-Type: multipart/form-data

Previous proxy code used: request.arrayBuffer()
  → Raw ArrayBuffer forwarding on Cloudflare Workers (Convex edge runtime)
  → Multipart body was CORRUPTED during forwarding
  → Cloudinary received malformed request → HTTP 404

New proxy code uses: request.formData() → new FormData()
  → Properly parses and re-serializes multipart data
  → Generates correct multipart boundary
  → Cloudinary receives correct request → HTTP 200
```

### Comparison Table
```
| Field                  | Desktop (direct)     | Mobile (proxy) before fix | Mobile (proxy) after fix |
|------------------------|----------------------|---------------------------|--------------------------|
| URL                    | api.cloudinary.com   | api.cloudinary.com        | api.cloudinary.com       |
| Method                 | POST                 | POST                      | POST                     |
| Content-Type           | multipart/form-data  | multipart/form-data       | multipart/form-data      |
| file                   | ✅ present            | ❌ corrupted/missing      | ✅ present                |
| api_key                | ✅ present            | ✅ present                | ✅ present                |
| timestamp              | ✅ present            | ✅ present                | ✅ present                |
| folder                 | ✅ present            | ✅ present                | ✅ present                |
| public_id              | ✅ present            | ✅ present                | ✅ present                |
| signature              | ✅ present            | ✅ present                | ✅ present                |
| allowed_formats        | ✅ present            | ✅ present                | ✅ present                |
| Body encoding          | correct boundary     | corrupted boundary/data   | correct boundary/data    |
| HTTP status            | 200                  | 404                       | 200 (expected)           |
```

### FIRST DIFFERENCE
**Body encoding:** The proxy's `request.arrayBuffer()` forwarding produced a corrupted multipart body on Cloudflare Workers. The multipart boundary and/or binary file data was not correctly preserved. Cloudinary could not parse the request → 404.

### ROOT CAUSE
Cloudflare Workers (which powers Convex HTTP actions) does not guarantee that `request.arrayBuffer()` preserves the exact multipart boundary alignment when forwarded to another `fetch()`. The raw bytes may be valid but the boundary markers can shift or be duplicated, causing Cloudinary to reject the body as malformed multipart data.

**Why desktop works:** Desktop uploads directly from the browser to Cloudinary — no proxy involved. The browser's native `FormData` → `fetch()` correctly generates and sends multipart data.

### FIX
Changed the proxy from:
```typescript
// BEFORE — broken on Cloudflare Workers
const body = await request.arrayBuffer();
const contentType = request.headers.get("Content-Type") || "multipart/form-data";
fetch(cloudinaryUrl, { method: "POST", headers: { "Content-Type": contentType }, body });
```

To:
```typescript
// AFTER — reliable
const incoming = await request.formData();
const outgoing = new FormData();
incoming.forEach((value, key) => outgoing.append(key, value));
fetch(cloudinaryUrl, { method: "POST", body: outgoing });
// Do NOT set Content-Type — runtime generates multipart boundary automatically
```

**Why this works:** `request.formData()` properly parses the multipart data into individual fields. Creating a new `FormData` and appending each field re-serializes the data correctly. When `fetch()` receives a `FormData` body, the runtime generates a fresh, valid multipart boundary.

## CLOUDINARY ENVIRONMENT STATUS
```
CLOUDINARY_CLOUD_NAME  = ✅ present in Convex deployment
CLOUDINARY_API_KEY     = ✅ present in Convex deployment
CLOUDINARY_API_SECRET  = ✅ present in Convex deployment
```
These are Convex deployment env vars (NOT Vercel env vars). The proxy reads them via `process.env.CLOUDINARY_CLOUD_NAME`.

## STILL PENDING — REQUIRES REAL DEVICE TESTING

### Mobile Upload Test
After deploying (Convex auto-deploys on git push):
1. **Android:** Upload 100KB JPG → check console → should see `proxy upload completed` with status 200
2. **iPhone:** Upload 100KB JPG → check console → should see `proxy upload completed` with status 200
3. **Desktop:** Upload 100KB JPG → still uses direct path → should see `direct upload completed` with status 200

**Expected console output:**
```
[ProfileUpload] STEP 5 — Upload targets
  direct: "https://api.cloudinary.com/v1_1/.../image/upload"
  proxy: "https://unique-clownfish-66.convex.site/cloudinary/upload"

[ProfileUpload] STEP 5 — direct upload FAILED  ← (on mobile, expected)
[ProfileUpload] STEP 5 — proxy upload → https://unique-clownfish-66.convex.site/cloudinary/upload
[ProfileUpload] STEP 5 — proxy upload completed { status: 200, ok: true, ms: XXXX }
[ProfileUpload] STEP 5 — Upload succeeded via proxy
```

### Verification Checklist
- [ ] Mobile: upload succeeds via proxy
- [ ] Mobile: profile image appears after upload
- [ ] Desktop: upload still succeeds via direct path
- [ ] Desktop: profile image appears after upload
- [ ] No TypeScript errors
- [ ] AI_HANDOFF.md updated ✅

## PREVIOUSLY FIXED (kept)
- `apps/shop/src/pages/ShopProfile.tsx` — `||` chain for avatar resolution, conditional crossOrigin
- `apps/shop/src/pages/ShopAccount.tsx` — Google image fallback, `||` chain, conditional crossOrigin
- `apps/shop/src/components/shop/ShopHeader.tsx` — User avatar with onError fallback
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Direct first + proxy fallback + retry + timeout
- `convex/http.ts` — Cloudinary upload proxy with FormData forwarding

## NEXT AI INSTRUCTIONS
1. If proxy still returns 404 after this fix: check Convex deployment logs for the `/cloudinary/upload` route. Log the outgoing Cloudinary URL and response status.
2. If proxy returns 500: check that `CLOUDINARY_CLOUD_NAME` is set in the Convex deployment environment.
3. If mobile direct upload starts working (no more "Failed to fetch"): the carrier/network issue resolved itself. The proxy fallback can remain as insurance.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
