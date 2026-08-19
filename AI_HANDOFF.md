# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core, `convex/` = shared Convex layer, `db/` = schema/migrations
- Stack: Bun · Vite · React 19 · TypeScript · React Router v7 · Tailwind v4 · shadcn/ui · lucide-react · Convex + Convex Auth · Neon PostgreSQL · Cloudinary · Leaflet
- ห้าม: สร้าง backend/db/auth/storage ใหม่, เปลี่ยน schema โดยไม่จำเป็น, เปลี่ยน architecture

## COMPLETED (ตรวจสอบก่อนคิดว่า "ยังไม่มี")
- VelShop storefront (apps/shop): product catalog/detail, cart, checkout, orders, wishlist, categories, notifications, search
- Home page de-clutter: hero CTA ซ้ำออก, หมวดหมู่เป็น pills, section header เรียบ
- Profile: edit profile, orders, addresses, account settings, logout at bottom with confirmation
- Auth: Convex Auth (Email OTP + Anonymous), `use-auth.ts` แยก loading/authenticated/unauthenticated, `RequireAuth` guard
- Cookie consent, compact Header/Footer
- Map picker: fixed center-pin UX (drag map, not marker), satellite default, invalidateSize in dialog
- **Server-side image upload (task 2026-08-18):**
  - Profile avatar/cover upload moved to **server-side** — browser → Convex HTTP action → Cloudinary REST API
  - Browser NEVER communicates directly with Cloudinary — no `api.cloudinary.com` in client code
  - No Cloudinary SDK dependency — uses `fetch()` + Web Crypto API (SHA-1 signature) to avoid Node.js builtin issues with Convex bundler
  - `src/convex/upload.ts` — Convex HTTP action at `/upload/image`, handles auth, file validation (10 MB max, JPEG/PNG/WebP/AVIF/GIF), Cloudinary upload with stable public IDs + overwrite
  - `src/convex/http.ts` — registers `/upload/image` route
  - `src/convex/users.ts` — `updateProfile` accepts Cloudinary URL strings (no more storage IDs for new uploads)
  - `src/pages/Profile.tsx` — uploads via `uploadViaBackend()` using `useAuthToken()` for auth, backward-compat resolves legacy storage IDs via `getImageUrl`
  - `cloudinary` npm package installed (available but not imported by frontend)
  - File size limit: 10 MB (validated at both frontend and backend)
  - Supported types: JPEG, PNG, WebP, AVIF, GIF
  - Cloudinary folders: `velnox/profiles/<userId>/avatar`, `velnox/covers/<userId>/cover` (overwrite, no accumulation)

## STILL PENDING
- Browser/device testing of new upload flow:
  - Android Chrome/Firefox: avatar upload, cover upload
  - iPhone Safari/Chrome: avatar upload, cover upload
  - Desktop Chrome: avatar upload, cover upload
  - >10 MB rejection
  - Refresh after upload → image persists
  - Google avatar fallback when no custom image
- Login flash verification on deployed app
- Full regression test of all profile features

## KNOWN BUGS
- ไม่พบ bug ที่ยืนยันได้ในโค้ด
- Mobile upload testing NOT VERIFIED (no real device access from this environment)

## FILES CHANGED (ล่าสุด)
- `src/convex/upload.ts` — **NEW**: Convex HTTP action for server-side Cloudinary upload
- `src/convex/http.ts` — updated: registers `/upload/image` route
- `src/convex/users.ts` — updated: `updateProfile` accepts string URLs, removed `generateUploadUrl` and `assertValidImage`
- `src/pages/Profile.tsx` — updated: `uploadViaBackend()`, `useAuthToken()`, backward-compat image URL resolution, 10 MB limit text

## DATABASE / BACKEND CHANGES
- Convex: `updateProfile` mutation now accepts `v.string()` URLs instead of `v.id("_storage")` for `image`/`coverImage`
- New Convex HTTP route: `POST /upload/image` (server-side Cloudinary upload)
- Neon: no schema change
- Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` required in Convex deployment env (set via Keys UI)

## VERIFICATION
- TypeScript: **PASS** (tsc -b --noEmit, exit 0)
- Convex functions: **PASS** (convex dev --once, functions ready)
- Build: **PASS** (vite build, ✓ built in 13.6s)
- Lint: NOT RUN
- Client-side Cloudinary check: **PASS** — `api.cloudinary.com` only in `src/convex/upload.ts` (server-side), zero in `src/pages/` or `src/components/`
- API secret check: **PASS** — `CLOUDINARY_API_SECRET` only in `src/convex/upload.ts` via `process.env`, never exposed to client
- Browser upload test: **NOT VERIFIED** (no real device in this environment)
- Mobile test: **NOT VERIFIED**

## UPLOAD ARCHITECTURE (NEW)

```
Browser (React)
    ↓  FormData(file, kind) + Authorization header
Convex HTTP Action  (src/convex/upload.ts)
    ↓  validate type/size → compute SHA-1 signature → POST to Cloudinary
Cloudinary REST API
    ↓  secure_url
Convex HTTP Action
    ↓  return URL to browser
Browser
    ↓  save URL via updateProfile mutation
Convex Mutation (src/convex/users.ts)
    ↓  patch user document with Cloudinary URL
Neon Database
```

Key properties:
- Browser NEVER talks to Cloudinary directly
- API secret NEVER leaves the server
- Stable public IDs (`avatar`/`cover` per folder) = overwrite, no manual cleanup needed
- Auth via JWT (`useAuthToken` → Authorization header → `ctx.auth.getUserIdentity()`)

## NEXT AI INSTRUCTIONS
- AI ตัวถัดไป: test upload flow จริงบน browser (Android, iPhone, Desktop)
- ตรวจสอบว่า Cloudinary env vars ตั้งค่าใน Convex deployment แล้ว ( Keys UI → CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Map center-pin UX, footer/header
- ห้ามเพิ่ม client-side Cloudinary calls — ทุกอย่างต้องผ่าน backend endpoint
