# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: ดู commit ล่าสุดในประวัติของ branch main
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core (server-side business rules), `convex/` = shared Convex layer, `db/` = schema/migrations
- แต่ละ app เป็น Vite app อิสระ (Vercel Root Directory = `apps/<app>`), แชร์ Convex deployment เดียว, UI kit/auth อยู่ใน packages/shared
- Stack: Bun · Vite · React 19 · TypeScript · React Router v7 · Tailwind v4 · shadcn/ui · lucide-react · Convex + Convex Auth · Neon PostgreSQL · Cloudinary · Leaflet
- ห้าม: สร้าง backend/db/auth/storage ใหม่, เปลี่ยน schema โดยไม่จำเป็น, เปลี่ยน architecture

## COMPLETED (ตรวจสอบก่อนคิดว่า "ยังไม่มี")
- VelShop storefront (apps/shop): product catalog/detail, cart, checkout, orders + order detail/tracking, wishlist, categories, VelRepeat, notifications, search
- Home page de-clutter (task 2026-08-18): hero CTA ซ้ำออก, หมวดหมู่เป็น pills, section header เรียบ, grid สินค้าหน้าแรกเหลือชุดเดียว
- Profile (ShopProfile.tsx + ShopAccount.tsx): avatar + cover upload ผ่าน **Cloudinary signed upload** (reuse backend/storage.ts; client+server validate type/size, preview, fallback, skeleton), edit profile (name/phone), logout อยู่ล่างสุด + confirmation dialog
- Auth: Convex Auth (Google + guest), `use-auth.ts` แยก loading/authenticated/unauthenticated, `RequireAuth` guard, Auth page โชว์ loading เมื่อ `authLoading || isAuthenticated` (กัน login flash), redirect ตาม auth state (ไม่มี setTimeout)
- Cookie consent (apps/shop/src/lib/cookie-consent.tsx): Necessary/Preferences/Analytics/Marketing — ห้ามเพิ่ม analytics/marketing provider เอง
- Header/Footer (apps/shop) เป็นเวอร์ชัน compact แล้ว ใช้ร่วมทุกหน้า
- **Task 2026-08-18 — Profile image 10 MB + FIXED CENTER-PIN map picker:**
  - Profile avatar/cover max size = **10 MB ทุกชั้น**: client validation (`ProfileImageUpload.tsx` MAX_BYTES), backend signed-upload `max_bytes` + server re-validation (`backend/storage.ts` MAX_IMAGE_BYTES → `getSignedUploadParams` + `saveProfileImage`), ยังรองรับ JPG/PNG/WebP
  - Upload failure debug: frontend อ่าน **Cloudinary JSON error body** + log HTTP status (error จริงไม่ถูกกลบ), แยก error ระหว่าง Cloudinary upload (`profile.imageUploadFailed`) กับ profile DB save (`profile.imageSaveFailed` + backend throw `PROFILE_SAVE_FAILED`), revoke object URL หลัง upload เสร็จ/ล้มเหลว
  - Map picker เปลี่ยนเป็น **FIXED CENTER PIN**: หมุดเป็น HTML overlay ตรึงกลางจอ (`pointer-events-none`, z-450), ผู้ใช้ลากแผนที่, พิกัด = `map.getCenter()` จาก `moveend`, **ลบ map click select และ draggable marker ทิ้ง**, search/current location ใช้ `setView` (suppress moveend) แล้วรายงานพิกัดใหม่ → ผู้ใช้ต้องกด "ยืนยันตำแหน่งนี้" (`locationConfirmed=false` เสมอหลังเปลี่ยนตำแหน่ง)
  - Satellite (Esri World Imagery) เป็น default — **ตรวจแล้ว tile ใช้งานได้จริง (HTTP 200)**, เพิ่ม `invalidateSize()` หลัง mount (rAF + 250ms) เพราะ MapPicker อยู่ใน Dialog (กันแผนที่เทา/ว่างจาก container วัดขนาด 0)
  - Address save rule ไม่เปลี่ยน: ต้องมี lat/lng + locationConfirmed=true (backend ตรวจ `ADDRESS_GPS_REQUIRED` + `requireShippingAddress` ยังอยู่ครบ)
  - i18n อัปเดตครบ th/en/my — key parity ยังเท่ากัน (แก้เฉพาะข้อความ ไม่เพิ่ม/ลบ key)

## STILL PENDING
- ยังไม่ได้ test บนเบราว์เซอร์จริง (ต้อง deploy/run `cd apps/shop && bun run dev`):
  - Upload avatar/cover: 100KB / 1MB / 5MB / 10MB / >10MB (JPG, PNG, WebP) → 10MB ผ่าน, >10MB reject
  - Refresh หลัง upload → รูปยังอยู่
  - Map: เปิด Add Address → satellite แสดงจริง, ลากแผนที่ → พิกัด = center, แตะแผนที่ไม่เลือก, หมุดลากไม่ได้, confirm → save, search → center ไปผลค้นหา
- Login flash: โค้ดกันไว้แล้ว — ยังไม่ได้ verify บน deployed app

## KNOWN BUGS
- ไม่พบ bug ที่ยืนยันได้ในโค้ด
- สาเหตุ "อัปโหลดรูปไม่สำเร็จ" เดิมที่ user เจอ: frontend เดิมอ่าน error จาก Cloudinary ไม่ได้ (โยน generic message) — แก้ให้อ่าน error body แล้วแล้ว; ถ้ายัง fail หลัง deploy ให้ดู console.error "Cloudinary upload failed (HTTP …)" / "Profile image save error" เพื่อระบุ stage จริง (signature / Cloudinary / DB save)
- Satellite เดิมอาจแสดงไม่เต็มเพราะ Leaflet init ใน Dialog โดยไม่ invalidateSize — เพิ่มแล้ว ต้อง verify จริงบน browser

## FILES CHANGED (ล่าสุด)
- apps/shop/src/components/shop/MapPicker.tsx — rewrite: fixed center-pin UX (ไม่มี marker/click select)
- apps/shop/src/components/shop/ProfileImageUpload.tsx — rewrite: 10 MB + อ่าน Cloudinary error body + แยก save error + revoke URL
- backend/storage.ts — MAX_IMAGE_BYTES 5 MB → 10 MB (signature `max_bytes` + server check)
- convex/customer.ts — error ข้อความ 10 MB + wrap DB update เป็น `PROFILE_SAVE_FAILED`
- packages/shared/src/lib/i18n/locales/th.ts, en.ts, index.ts (myShopPatch) — ข้อความ 10 MB + center-pin hint
- AI_HANDOFF.md — อัปเดต

## DATABASE / BACKEND CHANGES
- Convex: ไม่มี function ใหม่ — แก้ error message + wrap DB update ใน `saveProfileImage`
- Neon: ไม่มีการเปลี่ยน schema
- Env: ไม่มีการเปลี่ยน (Cloudinary keys เดิม; ห้าม hardcode API secret)

## VERIFICATION
- Transpile check (`bun build --no-bundle`): MapPicker.tsx, ProfileImageUpload.tsx, backend/storage.ts — **PASS**
- TypeScript เต็มรูปแบบ / tests / build / manual test: **ยังไม่ได้ run** ใน environment นี้ (repo ไม่ได้ checkout — แก้ผ่าน GitHub API) — ต้อง run หลัง deploy:
  - `bun install` → `bun run typecheck` → `bun test` → `cd apps/shop && bun run build`
  - Manual: upload avatar/cover 100KB/1MB/5MB/10MB/>10MB (JPG/PNG/WebP) + refresh, drag map → confirm → save, satellite แสดงจริง
- locale parity: แก้เฉพาะข้อความ ไม่เพิ่ม/ลบ key → `tests/locale-parity.test.ts` ควรผ่าน (ยังไม่ได้ run)

## NEXT AI INSTRUCTIONS
- AI ตัวถัดไป: deploy/run shop app แล้ว test ตาม VERIFICATION; ถ้า upload ยัง fail ให้ดู console.error จาก ProfileImageUpload (Cloudinary stage = HTTP status + error body, save stage = backend error) แล้วแก้ที่ stage นั้นจริง — ห้ามปิด validation หรือ swallow error
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Cloudinary system, Map center-pin UX ใหม่ (ลากแผนที่ = เลือกตำแหน่ง, หมุดกลางจอ), save rule (lat/lng + locationConfirmed=true), footer/header ที่ลดรกแล้ว
