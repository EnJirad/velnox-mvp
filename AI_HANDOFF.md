# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)
## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: push รอบนี้ (ดู commit ล่าสุดบน main — ต่อจาก cf223c47)
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
- **รอบนี้ — TRACE ตรวจทั้ง flow กับ SDK ทางการของ Cloudinary แล้ว + ให้ UI โชว์ error จริงจาก Cloudinary**
## ROOT CAUSE (เดิม — แก้แล้วใน cf223c47)
**Cloudinary signature ถูกสร้างด้วยอัลกอริทึมผิด** (`sha1Sign` ใช้ HMAC-SHA1 แต่ Cloudinary ใช้
`SHA1(sorted_params + api_secret)`) → Cloudinary ตอบ **401 Invalid Signature** ทุกรอบ ทั้งที่ Convex
action SUCCESS — พิสูจน์ด้วย test vector จาก docs ทางการ (`bfd09f95…`) และแก้แล้ว (ดู FIX ด้านล่าง)
## ROUND 2 TRACE — ตรวจโค้ดปัจจุบัน (main=cf223c47) ทีละขั้นกับกฎ Cloudinary จริง
ตรวจเทียบกับ `cloudinary_npm` (SDK ทางการ, master) + docs ทุกจุด — **โค้ดปัจจุบันถูกต้องครบทุกขั้น**:
1. **Algorithm**: `sha1Sign` = sort params → `k=v` join `&` → ต่อ secret → SHA-1 hex — ตรง SDK
   `api_sign_request` เป๊ะ (SDK: `params.sort() → join("&") → hash(string + api_secret)`) ✓
2. **Signature version**: SDK ใหม่ default **v2** (encode `&`→`%26` ในค่า) แต่ค่าของเรา
   (`timestamp/folder/public_id/allowed_formats`) **ไม่มี `&`** → v1/v2 ได้ string เดียวกัน → digest เดียวกัน ✓
3. **Signed set == sent set**: backend sign `{timestamp, folder, public_id, allowed_formats}` —
   frontend ส่งชุดเดียวกันเป๊ะ (`file/api_key/signature` เป็น excluded params — ไม่ต้อง sign) ✓
   ยืนยันจาก SDK `build_upload_params()`: **รวม `allowed_formats` ใน params ที่ sign ด้วย** ✓
4. **Timestamp**: signed `String(ts)` == sent `String(sig.timestamp)` — ตัวเลขเดียวจาก response ✓
5. **folder/public_id**: ไม่มีอักขระผิดกฎ, ไม่ซ้ำ folder ใน public_id, `velnox/profiles/<userId>/…` ✓
6. **FormData/URL**: `POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload`, field
   `file/api_key/timestamp/folder/public_id/signature/allowed_formats` — multipart (ไม่มี custom header
   → ไม่มี CORS preflight) ✓
7. **Response**: อ่าน `res.text()` → JSON.parse → เช็ค `public_id` → เรียก `saveProfileImage` ✓
8. **saveProfileImage args** ตรง schema: `kind/publicId` (string) + `width/height/bytes` (number) ✓
### สรุป: failure จริงไม่ควรเกิดจากโค้ดบน main แล้ว เหลือ 2 สาเหตุระดับ environment:
- **E1: deployment ยังรันโค้ดเก่า** (Convex bundle/หน้าเว็บยังเป็นก่อน cf223c47 = signature แบบ HMAC)
- **E2: CLOUDINARY_API_SECRET ไม่ตรงกับ cloud/api_key** (secret ของ cloud/account อื่น → Invalid Signature
  เหมือนกัน) — ตรวจได้โดยเทียบ secret ใน Convex env กับคู่ cloud/api_key เดียวกันบน Cloudinary dashboard
## FIX (รอบนี้)
- **`ProfileImageUpload.tsx`** — ให้ **toast โชว์ error จริงจาก Cloudinary** เมื่อ upload HTTP fail:
  `"อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง (401: Invalid Signature)"` — แทนข้อความ generic ล้วน ๆ
  (Cloudinary error message ปลอดภัย ไม่มี secret) และ outer catch (stage A/network) โชว์ข้อความ
  AppError จริงจาก backend (ยกเว้น "Failed to fetch" = network/CORS → คง toast generic)
  → **รอบหน้าที่ test upload: ถ้ายัง fail จะรู้ทันทีว่า Cloudinary ตอบอะไรโดยไม่ต้องเปิด DevTools**
- (โค้ด signing/upload flow ตัวอื่นไม่แตะ — ตรวจแล้วถูกต้องอยู่แล้ว)
## FILES CHANGED (รอบนี้)
- apps/shop/src/components/shop/ProfileImageUpload.tsx — toast แสดง Cloudinary error จริง (status + message) + AppError ใน outer catch
- AI_HANDOFF.md — อัปเดต
## VERIFICATION (ผลจริง — run บนเครื่องจาก tarball ของ main)
- TypeScript (`bun run typecheck`): **PASS** (exit 0)
- Tests (`bun run test`): **PASS** — 194/194 (20 files) รวม locale-parity + storage contract
- Lint (eslint เฉพาะไฟล์ที่เปลี่ยน): **PASS** (0 errors)
- Shop Build (`bun run build:shop`): **PASS** (11.2s)
- Signing contract เทียบ SDK ทางการ: **PASS** (ตรวจจาก source cloudinary_npm: algorithm/params/version ตรงกัน)
- Avatar/cover upload จริงบน browser + Cloudinary จริง: **NOT VERIFIED** — environment นี้ไม่มี browser
  และไม่มีสิทธิ์เข้า Convex deployment/Cloudinary account → ไม่สามารถยืนยัน E1/E2 ได้จากที่นี่
## OLD IMAGE CLEANUP (cf223c47 — ยังค้าง browser test)
- ลำดับ: upload → save DB → delete old (หลัง DB สำเร็จเท่านั้น) — code PASS, browser **NOT VERIFIED**
- Ownership: old id อ่านจาก DB row ของ authenticated user เท่านั้น — PASS
## STILL PENDING (ต้อง test บน browser จริงหลัง deploy)
- **ขั้นแรกสุด**: deploy cf223c47 (Convex + frontend) แล้ว upload JPG ~100KB ดูผล:
  - toast โชว์ `(4xx: …)` → อ่านข้อความนั้น (เช่น "Invalid Signature" → เช็ค E2 secret;
    ถ้าเป็น `(401: Invalid Signature)` ทั้งที่ main ใหม่แล้ว → Convex ยังรันโค้ดเก่า E1)
  - toast ยังเป็นข้อความ generic + console มี `[ProfileUpload] Cloudinary response` → ดู status/body
  - ไม่มี log `[ProfileUpload]` เลย → frontend build เก่า (cache/deploy ยังไม่ทัน) E1
- upload ขนาด 1/5/9/10/>10 MB (JPG/PNG/WebP) + refresh → รูปยังอยู่
- เปลี่ยนรูปซ้ำ → Media Library เหลือแค่รูปปัจจุบัน (cleanup)
- Map บน browser, login flash, responsive — ตาม AI_HANDOFF รอบก่อน
## KNOWN BUGS
- ~~Invalid Signature (HMAC)~~ → แก้แล้ว cf223c47
- ~~max_bytes → 400 Unknown parameter~~ → แก้แล้ว (ลบออกจาก request)
- ~~extractPublicId ตัด folder prefix → ลบรูปเก่าไม่เจอ~~ → แก้แล้ว
- ยังไม่ยืนยัน: E1 (deploy เก่า) / E2 (secret ผิด) — เป็น environment ตรวจจากโค้ดไม่ได้
- commerce.ts: eslint unused vars บรรทัด 205/551 (มีอยู่ก่อน ไม่เกี่ยวกับงานนี้)
## DATABASE / BACKEND CHANGES
- Convex: ไม่มี function ใหม่/ลบรอบนี้ (รอบก่อนแก้ logic ใน saveProfileImage เท่านั้น)
- Neon: ไม่มีการเปลี่ยน schema
- Env: ไม่มีการเปลี่ยน — Cloudinary 3 keys อยู่ใน deployment แล้ว (action SUCCESS ยืนยันว่าอ่านได้)
## NEXT AI INSTRUCTIONS
- 1) deploy main ล่าสุด (Convex + frontend) แล้ว test 100KB JPG ตาม STILL PENDING — ผล toast/console
   จะบอกทันทีว่า E1 หรือ E2
- 2) ถ้า E2: แก้ที่ Convex env (เอา secret ที่ถูกต้องของ cloud/api_key ชุดเดียวกันมาใส่) — **ห้าม hardcode**
- 3) ถ้า E1: redeploy; ถ้า Convex deploy อัตโนมัติจาก repo ให้เช็คว่า function hash ตรง cf223c47
- ห้ามแก้/รื้อ: architecture, Neon schema, Convex auth, Cloudinary system, map center-pin UX,
  save rule (lat/lng + locationConfirmed=true), footer/header ที่ลดรกแล้ว
- **ห้ามเปลี่ยน `sha1Sign` กลับเป็น HMAC-SHA1** — Cloudinary ใช้ SHA-1 แบบต่อ secret ต่อท้ายเท่านั้น
- **ห้ามเพิ่ม `max_bytes` กลับเข้าไปใน request** — Cloudinary ตอบ 400 (ไม่ใช่ Upload API parameter)
