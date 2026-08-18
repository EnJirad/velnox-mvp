# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: push รอบนี้ (ดู commit ล่าสุดบน main)
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core (server-side business rules), `convex/` = shared Convex layer, `db/` = schema/migrations
- แต่ละ app เป็น Vite app อิสระ, แชร์ Convex deployment เดียว, UI kit/auth อยู่ใน packages/shared
- Stack: Bun · Vite · React 19 · TypeScript · React Router v7 · Tailwind v4 · shadcn/ui · lucide-react · Convex + Convex Auth · Neon PostgreSQL · Cloudinary · Leaflet
- ห้าม: สร้าง backend/db/auth/storage ใหม่, เปลี่ยน schema โดยไม่จำเป็น, เปลี่ยน architecture

## COMPLETED (ตรวจสอบก่อนคิดว่า "ยังไม่มี")
- VelShop storefront: product catalog/detail, cart, checkout, orders/tracking, wishlist, categories, VelRepeat, notifications, search, home de-clutter
- Profile: avatar + cover upload ผ่าน Cloudinary signed upload, edit profile, logout ล่างสุด + confirmation
- Auth: Convex Auth, use-auth แยก loading/authenticated/unauthenticated, RequireAuth, กัน login flash (ไม่มี setTimeout)
- Cookie consent, header/footer compact, 10 MB limit, fixed center-pin map picker (รายละเอียดเดิมในประวัติ)
- **รอบนี้ — DEBUG REAL CLOUDINARY UPLOAD FAILURE: พบ ROOT CAUSE จริงแล้ว**
  - ดู section ROOT CAUSE ด้านล่าง — นี่คือสาเหตุที่แท้จริงที่ upload ล้มเหลวแม้ Convex action จะ SUCCESS

## ROOT CAUSE (เจอแล้ว — พิสูจน์ได้)
**Cloudinary signature ถูกสร้างด้วยอัลกอริทึมผิด**

- `backend/storage.ts` `sha1Sign()` ใช้ **HMAC-SHA1** (`createHmac("sha1", apiSecret).update(sorted)`)
- แต่ Cloudinary (และ SDK ทางการ cloudinary_npm `api_sign_request`) ใช้ **SHA-1 แบบธรรมดา**:
  `SHA1(alphabetically_sorted_params + api_secret)` — ต่อ secret ต่อท้าย string แล้ว hash
- ผลลัพธ์: signature ที่ Convex สร้าง **ไม่ตรงกับที่ Cloudinary คำนวณเสมอ** → Cloudinary ตอบ
  **401 Invalid Signature** ทุกรอบ → frontend โชว์ "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง"
- สอดคล้องกับอาการทุกจุดที่รายงานมา: `getProfileImageUploadSignature` (Convex) SUCCESS
  (มันแค่ "คำนวณ signature สำเร็จ" — ไม่ได้เอาไปตรวจกับ Cloudinary) แต่ Cloudinary reject ตอน POST จริง
- **พิสูจน์ด้วย test vector จาก docs ของ Cloudinary เอง**:
  params `eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510` + secret `abcd`
  → SHA1 ได้ `bfd09f95f331f558cbd1320e67aa8d488770583e` (ตรงกับ docs ✅)
  → HMAC-SHA1 ได้ `bf4af4c380b1d7a6a830a7a16fd9827c08e2b57d` (ไม่ตรง ❌)
- **Bug ซ้อน #2**: `max_bytes` **ไม่ใช่ parameter ของ Cloudinary Upload API** (ยืนยันจาก
  image_upload_api_reference.md + SDK ทางการ ไม่มี `max_bytes` เลย) — การส่ง `max_bytes` ใน request
  ทำให้ Cloudinary ตอบ **400 Unknown parameter** เพิ่มอีกชั้น
- **Bug ซ้อน #3 (old-image cleanup)**: `extractPublicId()` คืนแค่ **segment สุดท้าย** ของ public id —
  แต่ public id จริงมี folder prefix (`velnox/profiles/<userId>/avatar-xxx`) → `deleteFile` ลบผิด id
  ("not found") → รูปเก่าไม่ถูกลบจริง สะสมใน Cloudinary

## FIX
1. **`backend/storage.ts` `sha1Sign()`**: HMAC-SHA1 → `createHash("sha1").update(sorted + apiSecret).digest("hex")`
   (ตรงกับ cloudinary_npm เป๊ะ — comment เตือนห้ามเปลี่ยนกลับเป็น HMAC)
2. **ลบ `max_bytes` ออกจากทั้ง signature และ request** (`UploadSignature` ไม่มี `maxBytes` แล้ว,
   frontend ไม่ส่ง `max_bytes` แล้ว) — ขนาด 10 MB ยังบังคับที่ client (`MAX_BYTES`) + server re-validation
   (`saveProfileImage`/`saveProductImage` ตรวจ `bytes > MAX_IMAGE_BYTES`)
3. **`extractPublicId()`**: คืน full public id path (รวม folder prefix), strip เฉพาะ transform/version segment
   → cleanup ลบรูปเก่าได้จริง
4. **`ProfileImageUpload.tsx`**: validate ฟิลด์ signature ครบก่อน POST (ถ้าขาด → toast ใหม่
   `imageSignatureError` "ไม่สามารถเตรียมการอัปโหลดรูปได้"), staged logging ปลอดภัย
   (`[ProfileUpload]` signature received / starting upload / Cloudinary response status+body / saved),
   อ่าน response body จริง (text → JSON) — root cause จะเห็นใน console ชัดเจน,
   แยก toast: signature stage / Cloudinary stage / DB save stage (ใช้ข้อความ AppError จาก backend)
5. **`convex/customer.ts`**: cleanup logging `[ProfileImageCleanup]` (เริ่ม/สำเร็จ/ล้มเหลว + publicId + kind
   — ไม่ log secret); ลำดับยังเป็น upload → save DB → delete old; guard `oldId !== args.publicId`; ownership
   มาจาก DB row ของ authenticated user เท่านั้น
6. **`packages/shared/.../seller/ImageUploader.tsx`**: เอาออก `max_bytes` (bug เดียวกัน), client limit
   5 MB → 10 MB ให้ตรงกับระบบ (fix typecheck ด้วย)
7. **`convex/commerce.ts`**: ข้อความ error เก่า "ใหญ่เกิน 5 MB" → "10 MB"

## FILES CHANGED (รอบนี้)
- backend/storage.ts — root cause fix (SHA-1), ลบ max_bytes, extractPublicId full-path
- apps/shop/src/components/shop/ProfileImageUpload.tsx — validate sig, staged logging, distinct toasts, ไม่ส่ง max_bytes
- packages/shared/src/components/seller/ImageUploader.tsx — ไม่ส่ง max_bytes, limit 10 MB
- convex/customer.ts — [ProfileImageCleanup] logging
- convex/commerce.ts — ข้อความ "5 MB" → "10 MB"
- packages/shared/src/lib/i18n/locales/{th,en,index}.ts — เพิ่ม key `profile.imageSignatureError` (3 ภาษา)
- tests/storage.test.ts — ใหม่: test vector SHA-1 จาก docs (กัน regression กลับไป HMAC), 4 signed params
  (ไม่มี max_bytes), extractPublicId full-path (folder/transform/version)
- AI_HANDOFF.md — อัปเดต

## VERIFICATION (ผลจริง — run บนเครื่องจาก tarball ของ main + แก้แล้ว)
- TypeScript (`bun run typecheck` = tsc -b --noEmit): **PASS** (exit 0)
- Tests (`bun run test` = vitest run): **PASS** — 194/194 (20 files) รวม locale-parity 2/2 + storage 6/6
- Lint (eslint เฉพาะไฟล์ที่เปลี่ยน): **PASS** (0 errors — commerce.ts มี lint error เดิม 2 จุด
  (unused vars บรรทัด 205/551) ที่ไม่ได้แตะ เพราะไม่เกี่ยวกับงานนี้)
- Shop Build (`bun run build:shop`): **PASS** (11.9s)
- **Signature algorithm**: **PASS** — unit test ใช้ test vector จาก docs ของ Cloudinary ตรงกัน
- **max_bytes removed**: **PASS** — ไม่มี `max_bytes`/`maxBytes` เหลือใน storage/uploaders/tests
- **extractPublicId folder path**: **PASS** — unit test ตรวจ full public id + strip transform/version
- Avatar/cover upload จริง (browser + Cloudinary): **NOT VERIFIED** — environment นี้ไม่มี browser/เข้า deployment ไม่ได้
  → แต่ root cause (signature ผิด) แก้แล้วและพิสูจน์ด้วย test vector; หลัง deploy ต้อง test จริงตาม checklist ด้านล่าง
- >10MB rejection จริง: **NOT VERIFIED** (ล็อกด้วย unit test + server re-validation ตรวจแล้ว)

## OLD IMAGE CLEANUP (spec §30–56)
- Avatar cleanup: **code-level PASS** (upload → save → delete old, log ครบ, guard id ซ้ำ) — browser test **NOT VERIFIED**
- Cover cleanup: **code-level PASS** (เดียวกัน) — browser test **NOT VERIFIED**
- Ownership validation: **PASS** (old id อ่านจาก DB row ของ authenticated user เท่านั้น — ไม่รับจาก client)
- Database ordering: **PASS** (ลบรูปเก่าหลัง DB UPDATE สำเร็จเท่านั้น; DB fail → ไม่ลบรูปเก่า)
- Delete failure handling: **PASS** (เก็บรูปใหม่ + log `[ProfileImageCleanup] Failed … orphan asset`)
- ลบรูปเก่าได้จริง (ไม่ "not found" อีก): **PASS** — extractPublicId คืน full id แล้ว (เดิมลบไม่เจอ)

## STILL PENDING (ต้อง test บน browser จริง)
- Upload avatar/cover จริง: 100KB / 1MB / 5MB / 9MB / 10MB / >10MB (JPG/PNG/WebP) + refresh → รูปยังอยู่
- เปลี่ยนรูปซ้ำ 2–3 ครั้ง → ตรวจ Cloudinary Media Library ว่ารูปเก่าถูกลบจริง (มีแค่รูปปัจจุบัน)
- Upload fail (ไฟล์เสีย/ขนาดเกิน) → รูปเก่ายังอยู่
- Map บน browser, login flash, responsive — ตาม AI_HANDOFF รอบก่อน (ยังค้างเหมือนเดิม)

## KNOWN BUGS
- ~~Cloudinary Invalid Signature ทุกรอบ (signature action SUCCESS แต่ upload fail)~~ → **แก้แล้ว** (SHA-1 + เอา max_bytes ออก — พิสูจน์ด้วย test vector)
- ~~extractPublicId ตัด folder prefix → ลบรูปเก่าไม่เจอ~~ → **แก้แล้ว** (คืน full path)
- commerce.ts: eslint unused vars บรรทัด 205/551 (มีอยู่ก่อน ไม่เกี่ยวกับงานนี้ — ใครแก้ commerce.ts ให้เคลียร์ด้วย)
- ยังไม่ยืนยัน: พฤติกรรม runtime บน browser (upload จริง / cleanup จริง)

## DATABASE / BACKEND CHANGES
- Convex: ไม่มี function ใหม่/ลบ — แก้ logic ใน saveProfileImage (logging) + ข้อความ error
- Neon: ไม่มีการเปลี่ยน schema
- Env: ไม่มีการเปลี่ยน — Cloudinary 3 keys อยู่ใน deployment แล้ว (ยืนยันโดย action SUCCESS)

## NEXT AI INSTRUCTIONS
- 1) deploy แล้ว test upload จริง: 100KB JPG ก่อน (ถ้ายัง fail ให้ดู console
  `[ProfileUpload] Cloudinary response` — ตอนนี้แสดง status + error body จริงแล้ว และ
  `[ProfileUpload] Signature received` — ใช้หาได้ทันทีว่า fail ขั้นไหน)
- 2) test เปลี่ยนรูปซ้ำ → ดูว่า Media Library เหลือรูปเก่าหรือไม่ (cleanup)
- 3) ถ้า signature ยัง fail อีกรอบ → เช็ค CLOUDINARY_API_SECRET ว่าตรงกับ cloud/account เดียวกับ
  CLOUDINARY_CLOUD_NAME/API_KEY (secret ไม่ตรงกัน = Invalid Signature เหมือนกัน)
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Cloudinary system, map center-pin UX,
  save rule (lat/lng + locationConfirmed=true), footer/header ที่ลดรกแล้ว
- **ห้ามเปลี่ยน `sha1Sign` กลับเป็น HMAC-SHA1** — Cloudinary ใช้ SHA-1 แบบต่อ secret ต่อท้ายเท่านั้น
