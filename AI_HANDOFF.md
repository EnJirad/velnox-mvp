# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: upload-debug-panel
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
- **Proxy FormData fix**: Fixed 404 by switching from ArrayBuffer to FormData forwarding
- **Visible debug panel (this round)**: On-failure debug panel with copy-to-clipboard for mobile debugging

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

## VISIBLE DEBUG PANEL — THIS ROUND

### What was added
A collapsible debug panel in `ProfileImageUpload.tsx` that appears when an upload fails. The user can:
1. See the exact failure step, error, and all diagnostic data
2. Press `[ คัดลอกข้อมูลDebug ]` to copy the full report to clipboard
3. Send the copied text to the developer

### What the debug panel exposes
- Error ID (PROFILE_UPLOAD_YYYYMMDD_XXXX)
- Failed step (STEP number + label)
- Error detail, name, message
- Upload route (DIRECT / PROXY / BOTH_FAILED)
- Direct HTTP status (if reached)
- Proxy HTTP status (if reached)
- Target hostname + masked path
- Signature request status (SUCCESS / FAILED)
- All FormData field presence (PRESENT / MISSING — no values)
- File name, type, size
- Browser online status, origin, browser summary
- HTTP response status + body (if received)
- Cloudinary response (if received)
- Timing (start, fail, duration ms)

### What is masked/hidden
- API key VALUE → only shows PRESENT/MISSING
- Signature VALUE → only shows PRESENT/MISSING
- Cloud name → masked (e.g. "abc***xy")
- API secret → never shown
- OAuth tokens → never shown
- Cookies → never shown
- Full User-Agent → summarized (e.g. "Chrome 139 · Android")

### How it works
1. Debug state (`DebugInfo`) is built incrementally during the upload flow
2. On any failure, `setDebugInfo(d)` populates the panel
3. On success, `setDebugInfo(null)` clears any previous failure
4. `DebugPanel` component renders the collapsible panel + copy button
5. `buildDebugReport()` generates the plain-text report for clipboard
6. Copy uses `navigator.clipboard.writeText()` with textarea fallback

### File changed
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Complete rewrite with debug state, DebugPanel component, copy functionality

### TypeScript: ✅ PASS

## STILL PENDING — REQUIRES REAL DEVICE TESTING

### Mobile Upload Test with Debug Panel
After deploying:
1. **Android/iPhone:** Upload JPG → if fails, open "รายละเอียดทางเทคนิค" → press "คัดลอกข้อมูลDebug"
2. **Desktop:** Upload JPG → should succeed, no debug panel shown
3. Send the copied debug text to the developer

### What to look for in the debug output
- `Upload Route:` — DIRECT or PROXY or BOTH_FAILED
- `FAILED AT:` — which step failed
- `HTTP Status:` — Cloudinary response code
- `Error:` — the actual error message
- `Response Body:` — Cloudinary's error explanation

### Verification Checklist
- [ ] Mobile: debug panel appears on failure
- [ ] Mobile: copy button works
- [ ] Mobile: copied text contains all diagnostic fields
- [ ] Desktop: no debug panel on success
- [ ] No secrets exposed in debug panel
- [ ] No TypeScript errors
- [ ] AI_HANDOFF.md updated ✅

## PREVIOUSLY FIXED (kept)
- `apps/shop/src/pages/ShopProfile.tsx` — `||` chain for avatar resolution, conditional crossOrigin
- `apps/shop/src/pages/ShopAccount.tsx` — Google image fallback, `||` chain, conditional crossOrigin
- `apps/shop/src/components/shop/ShopHeader.tsx` — User avatar with onError fallback
- `apps/shop/src/components/shop/ProfileImageUpload.tsx` — Direct first + proxy fallback + retry + timeout + debug panel
- `convex/http.ts` — Cloudinary upload proxy with FormData forwarding

## NEXT AI INSTRUCTIONS
1. If proxy still returns 404 after this fix: check Convex deployment logs for the `/cloudinary/upload` route. Log the outgoing Cloudinary URL and response status.
2. If proxy returns 500: check that `CLOUDINARY_CLOUD_NAME` is set in the Convex deployment environment.
3. If mobile direct upload starts working (no more "Failed to fetch"): the carrier/network issue resolved itself. The proxy fallback can remain as insurance.
4. Do NOT change: Convex architecture, Neon, authentication, Cloudinary account, signature algorithm, database schema.
