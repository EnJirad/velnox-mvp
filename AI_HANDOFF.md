# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)
## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: push รอบนี้ (ดู commit ล่าสุดบน main — ต่อจาก a547e6c3)
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
- Cookie consent, header/footer compact, 10 MB limit, fixed center-pin map picker
- **cf223c47**: แก้ root cause signature (SHA-1+secret ไม่ใช่ HMAC) + ลบ `max_bytes` + extractPublicId full-path
- **a547e6c3**: toast โชว์ Cloudinary error จริง (status + message) ใน branch HTTP fail
- **รอบนี้ — TRACE ERROR PATH + STEP LOG + ERROR ID**: ทุก failure มี error ID + detail จริงขึ้นถึง UI (ห้าม generic ล้วน)
## ROOT CAUSE (เดิม — แก้แล้วใน cf223c47)
**Cloudinary signature ถูกสร้างด้วยอัลกอริทึมผิด** (`sha1Sign` ใช้ HMAC-SHA1 แต่ Cloudinary ใช้
`SHA1(sorted_params + api_secret)`) → Cloudinary ตอบ **401 Invalid Signature** ทุกรอบ ทั้งที่ Convex
action SUCCESS — พิสูจน์ด้วย test vector จาก docs ทางการ (`bfd09f95…`) และแก้แล้ว
## TRACE ERROR PATH (รอบนี้) — ข้อความ generic "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" มาจากที่เดียว
- grep ทั้ง repo: `อัปโหลดรูปไม่สำเร็จ` / `อัปโหลดไม่สำเร็จ` / `Upload failed` / `UPLOAD_FAILED` /
  `PROFILE_SAVE_FAILED` → ใน **profile flow** ข้อความนี้เกิดจาก `t("profile.imageUploadFailed")`
  ใน `apps/shop/src/components/shop/ProfileImageUpload.tsx` **3 จุดเท่านั้น**:
  1. Cloudinary HTTP fail (`!res.ok`) — รอบก่อน (a547e6c3) append `(status: message)` แล้ว
  2. Cloudinary 200 แต่ไม่มี `public_id`
  3. outer catch (stage signature/network) — รอบก่อนยังกรอง `"Failed to fetch"` → generic ล้วน
  (seller flow มีข้อความคล้ายกันคนละไฟล์ `ImageUploader.tsx` — ไม่ใช่ profile flow)
- **ไม่มี Error Boundary / toast wrapper / helper อื่นแปลง error เป็น generic** — ตรวจแล้ว
- ข้อสรุป: ถ้ายังเห็น "generic ล้วน" หลัง deploy a547e6c3 → failure มาจาก **outer catch**
  (fetch ไม่สำเร็จ — network/CORS — หรือ Convex transport error) หรือ **deploy/frontend ยังเป็น build เก่า**
## FIX (รอบนี้)
- **`ProfileImageUpload.tsx`**:
  - **STEP log ครบทุกขั้น** `[ProfileUpload] STEP 1..10` (Started / File validated / Requesting
    signature / Signature received / Starting Cloudinary upload / Cloudinary response received /
    Cloudinary parsed / Saving profile / Profile saved / Cleanup old image (server-side)) + `SUCCESS`
  - **ทุก failure**: `[ProfileUpload] FAILED AT STEP X` + **unique error ID** `PROFILE_UPLOAD_YYYYMMDD_XXXX`
    (log + แสดงใน toast) → เทียบกับ Convex logs ได้
  - **`inspectError()`**: log `typeof` / `name` / `message` / `cause` / `stack` / enumerable keys /
    `JSON.stringify(err, Object.getOwnPropertyNames(err))` — รองรับ Convex error ที่ไม่ใช่ `Error` instance
  - **toast โชว์ detail เสมอ**: base message + safe detail (ข้อความจริงจาก Cloudinary/backend หรือ
    `"Failed to fetch"` ถ้า network) + `รหัสข้อผิดพลาด: PROFILE_UPLOAD_...` — **ไม่มีกรณี generic ล้วนอีก**
    (ยกเลิกการกรอง "Failed to fetch" ของรอบก่อน — ตอน debug ต้องเห็น error จริง)
- **i18n**: เพิ่ม key `profile.errorIdLabel` ครบ 3 ภาษา (th `รหัสข้อผิดพลาด` / en `Error code` /
  my `အမှားကုဒ์` ใน myShopPatch) — key parity คงเดิม (locale-parity test ผ่าน)
## FILES CHANGED (รอบนี้)
- apps/shop/src/components/shop/ProfileImageUpload.tsx — STEP log, error ID, inspectError, toast มี detail+ID เสมอ
- packages/shared/src/lib/i18n/locales/th.ts — เพิ่ม `profile.errorIdLabel`
- packages/shared/src/lib/i18n/locales/en.ts — เพิ่ม `profile.errorIdLabel`
- packages/shared/src/lib/i18n/locales/index.ts — เพิ่ม `profile.errorIdLabel` (myShopPatch)
- AI_HANDOFF.md — อัปเดต
## VERIFICATION (ผลจริง — run บนเครื่องจาก tarball ของ main + แก้แล้ว)
- TypeScript (`bun run typecheck`): **PASS** (exit 0)
- Tests (`bun run test`): **PASS** — 194/194 (20 files) รวม locale-parity + storage contract
- Lint (eslint ไฟล์ที่เปลี่ยน 4 ไฟล์): **PASS** (0 errors)
- Shop Build (`bun run build:shop`): **PASS** (11.x s)
- Signing contract เทียบ SDK ทางการ: **PASS** (รอบก่อน ตรวจแล้ว — ไม่แตะ signing logic รอบนี้)
- Upload จริงบน browser + Cloudinary: **NOT VERIFIED** — environment นี้ไม่มี browser / ไม่มีสิทธิ์
  เข้า Convex deployment หรือ Cloudinary account
## STILL PENDING (ต้อง test บน browser จริงหลัง deploy)
- deploy main ล่าสุด (Convex + frontend) → upload JPG ~100KB → อ่าน **toast + console**:
  - toast แสดง `FAILED` detail + error ID → เอาข้อความนั้น + error ID มาเทียบ Convex logs
  - `(6xx/4xx: Cloudinary …)` → Cloudinary ตอบจริง — รายงานข้อความ
  - `Failed to fetch` + `FAILED AT STEP 5` → network/CORS ระหว่าง browser → api.cloudinary.com
  - `FAILED AT STEP 3` → Convex transport/action error (ดู inspectError log)
  - ไม่มี log `[ProfileUpload]` เลย → frontend ยังเป็น build เก่า (cache/deploy ไม่ทัน)
- upload ขนาด 1/5/9/10/>10 MB (JPG/PNG/WebP) + refresh → รูปยังอยู่
- เปลี่ยนรูปซ้ำ → Media Library เหลือแค่รูปปัจจุบัน (cleanup — server-side ใน saveProfileImage)
- Map บน browser, login flash, responsive — ตาม AI_HANDOFF รอบก่อน
## KNOWN BUGS
- ~~Invalid Signature (HMAC)~~ → แก้แล้ว cf223c47
- ~~max_bytes → 400 Unknown parameter~~ → แก้แล้ว
- ~~extractPublicId ตัด folder prefix~~ → แก้แล้ว
- ~~generic-only toast ซ่อน error จริง~~ → แก้แล้วรอบนี้ (error ID + detail เสมอ)
- ยังไม่ยืนยัน: E1 (deploy เก่า) / E2 (CLOUDINARY_API_SECRET ไม่ตรงกับ cloud/api_key) — environment
  ตรวจจากโค้ดไม่ได้; รอบนี้มีเครื่องมือ (toast detail + error ID + STEP log) ที่พิสูจน์ได้แล้ว
- commerce.ts: eslint unused vars บรรทัด 205/551 (มีอยู่ก่อน ไม่เกี่ยวกับงานนี้)
## DATABASE / BACKEND CHANGES
- Convex: ไม่มี function ใหม่/ลบรอบนี้
- Neon: ไม่มีการเปลี่ยน schema
- Env: ไม่มีการเปลี่ยน — Cloudinary 3 keys อยู่ใน deployment แล้ว (action SUCCESS ยืนยันว่าอ่านได้)
## NEXT AI INSTRUCTIONS
- 1) deploy main ล่าสุด แล้ว test 100KB JPG ตาม STILL PENDING — toast/console จะบอกขั้นที่ fail ทันที
- 2) ถ้า toast โชว์ `(401: Invalid Signature)` ทั้งที่ main ใหม่ → เช็ค E2: CLOUDINARY_API_SECRET
   ต้องเป็นของ cloud/api_key ชุดเดียวกัน (Convex env) — **ห้าม hardcode**
- 3) ถ้า toast โชว์ `Failed to fetch` ที่ STEP 5 → ตรวจ network/CORS/ภูมิภาค/ad-blocker
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Cloudinary system, map center-pin UX,
  save rule (lat/lng + locationConfirmed=true), footer/header ที่ลดรกแล้ว
- **ห้ามเปลี่ยน `sha1Sign` กลับเป็น HMAC-SHA1** — Cloudinary ใช้ SHA-1 แบบต่อ secret ต่อท้ายเท่านั้น
- **ห้ามเพิ่ม `max_bytes` กลับเข้าไปใน request** — Cloudinary ตอบ 400 (ไม่ใช่ Upload API parameter)
