# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: ดู commit ล่าสุดในประวัติของ branch main (รอบ verify นี้ push commit ใหม่บน main)
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core (server-side business rules), `convex/` = shared Convex layer, `db/` = schema/migrations
- แต่ละ app เป็น Vite app อิสระ (Vercel Root Directory = `apps/<app>`), แชร์ Convex deployment เดียว, UI kit/auth อยู่ใน packages/shared
- Stack: Bun · Vite · React 19 · TypeScript · React Router v7 · Tailwind v4 · shadcn/ui · lucide-react · Convex + Convex Auth · Neon PostgreSQL · Cloudinary · Leaflet
- ห้าม: สร้าง backend/db/auth/storage ใหม่, เปลี่ยน schema โดยไม่จำเป็น, เปลี่ยน architecture

## COMPLETED (ตรวจสอบก่อนคิดว่า "ยังไม่มี")
- VelShop storefront (apps/shop): product catalog/detail, cart, checkout, orders + order detail/tracking, wishlist, categories, VelRepeat, notifications, search
- Home page de-clutter (task 2026-08-18)
- Profile: avatar + cover upload ผ่าน Cloudinary signed upload (reuse backend/storage.ts), edit profile, logout ล่างสุด + confirmation
- Auth: Convex Auth (Google + guest), use-auth แยก loading/authenticated/unauthenticated, RequireAuth, Auth page โชว์ loading (กัน login flash, ไม่มี setTimeout)
- Cookie consent: Necessary/Preferences/Analytics/Marketing (ไม่มี provider เพิ่มเอง)
- Header/Footer compact ใช้ร่วมทุกหน้า
- Profile image 10 MB + FIXED CENTER-PIN map picker (task 2026-08-18) — ดูรายละเอียดเดิมในประวัติ AI_HANDOFF
- **รอบ FINAL VERIFY (2026-08-18):**
  - **พบและแก้ bug จริงจากรอบก่อน**: `convex/customer.ts` ใช้ `AppError("PROFILE_SAVE_FAILED", …)` แต่ `PROFILE_SAVE_FAILED` ไม่มีใน `ErrorCode` union ของ `backend/errors.ts` → **TypeScript fail** แก้โดยเพิ่ม code + Thai message ใน errors.ts (ห้ามใช้ @ts-ignore / any — แก้ type ให้ถูกต้อง)
  - เพิ่ม `tests/storage.test.ts` (6 tests): ล็อก MAX_IMAGE_BYTES = 10 MB, signature = HMAC-SHA1 เหนือ 5 params ที่ browser ส่งพอดี (timestamp/folder/public_id/allowed_formats/max_bytes — กัน Invalid Signature), allowed formats ครอบคลุม JPG/PNG/WebP, extractPublicId round-trip
  - `ProfileImageUpload.tsx`: ตอน save fail โชว์ข้อความจริงจาก backend (AppError message) แทน fallback generic — ตาม convention ของแอป
  - Verify จริงในเครื่อง: typecheck / tests / shop build / tile URLs / Nominatim search

## STILL PENDING (ต้อง test บน browser จริง — ยังทำไม่ได้ใน environment นี้)
- Upload avatar/cover จริง: 100KB / 1MB / 5MB / 9MB / 10MB / >10MB (JPG, PNG, WebP) + refresh → รูปยังอยู่
- Cloudinary runtime config: ต้อง confirm ว่า CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ตั้งอยู่ใน Convex deployment (Keys/API keys UI) แล้ว — environment นี้เข้าถึง deployment ไม่ได้
- Map บน browser: satellite แสดงจริง, ลากแผนที่ → พิกัด = center, แตะแผนที่ไม่เลือก, หมุดลากไม่ได้, confirm → save, search → center ไปผลค้นหา, responsive (mobile/tablet/desktop)
- Login flash verify บน deployed app

## KNOWN BUGS
- ~~TypeScript error: PROFILE_SAVE_FAILED ไม่อยู่ใน ErrorCode~~ → **แก้แล้ว** (เพิ่มใน backend/errors.ts) — verify ด้วย `tsc -b --noEmit` exit 0
- ไม่พบ bug ที่ยืนยันได้เหลือในโค้ด (static + unit test level)
- สิ่งที่ยังไม่ยืนยัน: พฤติกรรม runtime บน browser (upload จริง / satellite render จริง) — ต้อง deploy แล้ว test

## FILES CHANGED (รอบนี้)
- backend/errors.ts — เพิ่ม `PROFILE_SAVE_FAILED` ใน ErrorCode + Thai message (fix typecheck)
- tests/storage.test.ts — **สร้างใหม่** 6 tests (upload contract: 10MB + signed params)
- apps/shop/src/components/shop/ProfileImageUpload.tsx — toast save-fail แสดงข้อความ backend จริง
- AI_HANDOFF.md — อัปเดต
- (รอบก่อน: MapPicker.tsx rewrite, ProfileImageUpload.tsx rewrite, backend/storage.ts 10MB, convex/customer.ts, i18n th/en/index)

## DATABASE / BACKEND CHANGES
- Convex: ไม่มี function ใหม่ (รอบก่อนแก้ error message + wrap DB update เป็น PROFILE_SAVE_FAILED)
- Neon: ไม่มีการเปลี่ยน schema
- Env: ไม่มีการเปลี่ยนในโค้ด — ต้อง confirm Cloudinary keys ใน Convex deployment

## VERIFICATION (ผลจริง รอบนี้ — run บนเครื่องจาก tarball ของ main)
- TypeScript (`bun run typecheck` = tsc -b --noEmit): **PASS** (exit 0 — หลังแก้ backend/errors.ts; ก่อนแก้ FAIL ด้วย PROFILE_SAVE_FAILED)
- Tests (`bun run test` = vitest run): **PASS** — 194/194 (20 files) รวม locale-parity 2/2 + storage ใหม่ 6/6
- Lint (`bunx eslint` เฉพาะไฟล์ที่เปลี่ยน): **PASS**
- Shop Build (`bun run build:shop` = vite build): **PASS** (10.9s)
- Tile URLs: Esri World Imagery satellite **HTTP 200** (15.6KB JPEG), OSM standard **HTTP 200** — ใช้ได้จริง
- Nominatim search: **HTTP 200 + JSON results** — ใช้ได้จริง
- Avatar/cover upload จริง (browser + Cloudinary): **NOT VERIFIED** — ไม่มี browser + เข้า Convex deployment/keys ไม่ได้ใน environment นี้
- 10 MB / >10MB rejection (real upload): **NOT VERIFIED** (ล็อกด้วย unit test แล้ว: constant 10MB ตรงกันทุกชั้น, >10MB ถูก reject ที่ client + `max_bytes` + server)
- Satellite map render บน browser: **NOT VERIFIED** (tile 200 แล้ว; invalidateSize อยู่ในโค้ด)
- Center pin / drag / click-selection-removed / marker-drag-removed: **code-level PASS** (ไม่มี `map.on("click")`, ไม่มี `L.marker`/draggable, moveend → getCenter) — browser test **NOT VERIFIED**
- Address save rule: **PASS** (addresses.test.ts 7/7 + backend ADDRESS_GPS_REQUIRED/requireShippingAddress intact)
- Cloudinary runtime env (CLOUDINARY_*): **NOT VERIFIED** — ต้อง check ใน Keys/API keys UI

## NEXT AI INSTRUCTIONS
- 1) deploy/run `cd apps/shop && bun run dev` 2) test checklist ด้านบน (upload จริง + map บน browser) 3) ถ้า upload fail ให้ดู console.error "Cloudinary upload failed (HTTP …)" (ตอนนี้อ่าน error body แล้ว — root cause จะเห็นชัด: signature/params/size) แล้วแก้ที่ stage นั้นจริง ห้ามปิด validation / swallow error
- ก่อน test ต้อง confirm: Cloudinary 3 keys อยู่ใน Convex deployment env แล้ว
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Cloudinary system, Map center-pin UX ใหม่ (ลากแผนที่ = เลือกตำแหน่ง), save rule (lat/lng + locationConfirmed=true), footer/header ที่ลดรกแล้ว
