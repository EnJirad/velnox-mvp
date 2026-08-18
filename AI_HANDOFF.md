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
- **Home page de-clutter (task 2026-08-18)**: เอา hero CTA ซ้ำ (Shop Now) ออก, หมวดหมู่เป็น pills กะทัดรัด, section header เรียบ (title-only), grid สินค้าหน้าแรกเหลือ **ชุดเดียว** (personal recommendations เมื่อ memory มีจริง, ไม่เช่นนั้นโชว์ popular grid) — ฟีเจอร์/การ track ครบเหมือนเดิม
- Profile (ShopProfile.tsx + ShopAccount.tsx): avatar + cover upload ผ่าน **Cloudinary signed upload** (reuse backend/storage.ts; client+server validate type/size, preview, fallback, skeleton), edit profile (name/phone), logout อยู่ล่างสุด + confirmation dialog
- Addresses: MapPicker (Leaflet, satellite, current location, marker, search, location confirmation) — **ห้าม save ถ้าไม่มี lat/lng + locationConfirmed=true** (backend ตรวจ)
- Auth: Convex Auth (Google + guest), `packages/shared/src/hooks/use-auth.ts` (isLoading = auth loading || user query loading), `RequireAuth` guard, Auth page โชว์ loading เมื่อ `authLoading || isAuthenticated` (กัน login flash), redirect ตาม auth state (ไม่มี setTimeout)
- Cookie consent (apps/shop/src/lib/cookie-consent.tsx): Necessary/Preferences/Analytics/Marketing — **ห้ามเพิ่ม analytics/marketing provider เอง**
- Header (ShopHeader.tsx) / Footer (ShopFooter.tsx) เป็นเวอร์ชัน compact แล้ว ใช้ร่วมทุกหน้า
- Seller / Center / Corporate apps ใช้งานได้
- Docs: docs/ มี ARCHITECTURE, GAP_ANALYSIS, IMPLEMENTATION_AUDIT_2026-08-15, PHASE-13-REPORT, FINAL_ARCHITECTURE_REPORT ฯลฯ

## STILL PENDING
- งาน polish/fix/verify ตาม task ที่ได้รับในแต่ละรอบ (ดู docs/GAP_ANALYSIS.md + docs/IMPLEMENTATION_AUDIT_2026-08-15.md สำหรับ gap/audit ล่าสุด)
- Login flash: โค้ดปัจจุบันกันไว้แล้ว (Auth.tsx gate) — ยังไม่ได้ test จริงบนเบราว์เซอร์กับ deployed app ควร verify ก่อนสรุป
- Home page ที่ลดรกแล้ว ยังไม่ได้ทดสอบ runtime บนเบราว์เซอร์ (ต้อง deploy/run `cd apps/shop && bun run dev`)

## KNOWN BUGS
- ไม่พบ bug ที่ยืนยันได้ในโค้ดปัจจุบัน

## FILES CHANGED (ล่าสุด)
- apps/shop/src/pages/ShopHome.tsx — ลดความรกหน้าแรก VelShop (ดู COMPLETED)
- AI_HANDOFF.md — อัปเดต

## VERIFICATION
- ShopHome.tsx: transpile check ผ่าน (bun build --no-bundle)
- TypeScript/build/test: ยังไม่ได้ run เต็มรูปแบบใน environment นี้ (repo ไม่ได้ checkout ไว้) — ก่อน ship: `bun install` → `bun run typecheck` → `bun test` → `cd apps/shop && bun run build`
