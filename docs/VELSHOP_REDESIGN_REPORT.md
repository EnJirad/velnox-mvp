# VELSHOP — PRODUCTION E-COMMERCE REDESIGN REPORT

Date: 2026-08-17
Scope: VelShop customer storefront (apps/shop) — production-ready marketplace UX, all features connected to the real backend (Convex node actions + Neon commerce core).

## 1. ไฟล์ที่แก้

| ไฟล์ | การแก้ไข |
|---|---|
| `apps/shop/src/pages/ShopHome.tsx` | เขียนใหม่: hero แบบแบรนด์ (ไม่มีชื่อร้านใหญ่ / ไม่มีนับสินค้า), popular categories, recommended, trending, continue shopping, Smart Reorder, VelRepeat explainer, trust section |
| `apps/shop/src/components/shop/ShopFooter.tsx` | เขียนใหม่: production footer 5 คอลัมน์ (SHOP/HELP/LEGAL/VELNOX/SELLER) — "เกี่ยวกับ Velnox" ใช้ `SITE_URLS.corporate` (config), seller เป็นลิงก์เล็ก, ไม่มีปุ่ม app ปลอม |
| `apps/shop/src/pages/ShopCart.tsx` | ลบปุ่ม Back ข้างหัวข้อ "ตะกร้า"; เพิ่ม mobile sticky checkout bar (total + checkout) เหนือ bottom nav |
| `apps/shop/src/pages/ShopProducts.tsx` | grid มือถือ 2 คอลัมน์ (2/2/3/4 ตาม breakpoint); filter sheet มี padding 20px + sticky footer Apply/Reset + badge นับตัวกรอง; การ์ดสินค้าแสดง rating/ยอดขายจริง |
| `apps/shop/src/pages/ShopProfile.tsx` | เขียนใหม่เป็น account hub แบบ app: identity header (avatar/name/email/member-since/status), แถว tappable ครบ (orders/velrepeat/wishlist/addresses/notifications/account/help) |
| `apps/shop/src/pages/ShopAccount.tsx` | **ใหม่**: หน้าแก้โปรไฟล์ (ชื่อ + เบอร์โทร + member since) ต่อ backend จริง |
| `apps/shop/src/main.tsx` | เพิ่ม route `/profile/account` (RequireAuth) |
| `apps/shop/src/components/shop/ShopHeader.tsx` | เพิ่ม wishlist icon ทุก breakpoint |
| `packages/shared/src/lib/commerce.ts` | เพิ่ม `soldCount` / `rating` / `reviewCount` ให้ `StoreProduct` |

## 2. Backend functions ที่เพิ่ม

`convex/customer.ts`:
- `myProfile` (action) — อ่านโปรไฟล์ลูกค้าจาก Neon users (name/email/phone/memberSince) ผ่าน identity ที่ authenticate แล้วเท่านั้น
- `updateProfileAction` (action) — แก้ชื่อ + เบอร์โทร (validate ฝั่ง server ด้วย `phoneSchema`, ความยาวชื่อ 2–80), เขียนเฉพาะแถวของตัวเอง + audit log

## 3. Backend ที่ปรับ (ข้อมูลจริงเพิ่มให้การ์ดสินค้า)

`backend/types.ts` + `backend/products.ts`:
- `Product` เพิ่ม `soldCount` / `rating` / `reviewCount` (optional)
- `listProducts` + `catalogProducts`: JOIN ยอดขายจริง (`order_items`) + คะแนน/จำนวนรีวิวจริง (`reviews` published) — ไม่มีตัวเลขปลอม; การ์ดแสดง "ขายแล้ว N" / "★ x.x (n)" เฉพาะเมื่อมีข้อมูลจริง

## 4. API / Database changes

- ไม่มีการ migration — schema เดิมรองรับอยู่แล้ว (order_items, reviews, users มีอยู่แล้ว)
- API: เพิ่ม 2 actions (myProfile, updateProfileAction) — ผ่าน Convex, ownership ตรวจจาก session

## 5. Authentication changes

- ไม่แตะ auth architecture (Google OAuth เดิมคงเดิม)
- หน้า account/email เป็น read-only จาก Google identity (ระบุใน UI ว่าเปลี่ยนได้ที่ Google)

## 6. Analytics events

- คงเดิมทั้งหมด (SEARCH, CATEGORY_VIEW, PRODUCT_CLICK, INTEREST, CART_ADD, RECOMMENDATION_CLICK, SHOP_VIEW) — home/search ใหม่ยัง track ครบ
- ไม่เพิ่ม event ที่ไม่มีข้อมูลจริง

## 7. VelRepeat / Responsive / Security / SEO

- **VelRepeat**: เพิ่ม explainer section บนหน้าแรก (ข้อมูลจริง — อธิบายฟีเจอร์จริง + CTA ไป `/velrepeat` สำหรับผู้ใช้, `/auth` สำหรับ guest); หน้า VelRepeat เดิมคงเดิม
- **Responsive**: grid สินค้า 2 คอลัมน์บนมือถือ (ตาม spec §5), sticky checkout bar บนมือถือ, filter sheet มี safe padding, bottom nav ไม่ทับ content (`pb-28` บน cart)
- **Security**: ไม่เชื่อค่าจาก frontend — profile ตรวจ ownership + validate ฝั่ง server; ราคา/stock ยังคำนวณ backend เดิม
- **SEO**: title/description ต่อหน้า (home/products) เดิมคงเดิม

## 8. Tests ที่ผ่าน

- `bunx tsc -b --noEmit` — 0 error
- `bun test` — **181 pass / 0 fail** (รวม locale parity: th/en/my key ครบเท่ากัน)
- `bun run build` (shop) / `build:seller` / `build:center` / `build:corporate` — ผ่านทั้งหมด
- `bunx convex dev --once` — functions ready (push ไป deployment dev `strong-buffalo-427`)

## 9. Remaining issues (พูดตรงไปตรงมา)

1. **Profile avatar**: รองรับเฉพาะอักษรย่อจากชื่อ (image จาก Google ยังไม่แสดง — user doc มี `image` field แต่ UI ยังไม่ใช้; ทำต่อได้ในรอบถัดไป)
2. **dob/gender/currency/language preferences**: ยังไม่มีใน schema — ต้องเพิ่ม migration + backend ก่อนจึงทำ UI ได้ (เลี่ยงไว้ตามกฎ "ห้าม UI ที่ backend ไม่รองรับ")
3. **Help Center / support ticket**: ยังเป็นแค่ลิงก์นำทาง (order-specific support ยังไม่มี backend ticket system)
4. **Location permission flow / map**: MapPicker มีอยู่แล้ว (MapLibre) แต่ยังไม่มีขั้นตอน "ขอ permission ก่อน" — address form เปิด map ได้โดยตรง
5. **Deployment**: ต้อง deploy Convex production (`unique-clownfish-66`) + Vercel ตาม runbook — dev push ผ่านแล้วเท่านั้น

## สรุป

VelShop เป็น storefront ที่ทำงานกับ backend จริงครบ flow: browse → search → filter (URL state) → detail → cart (server cart) → checkout (backend คำนวณราคา) → order → tracking → reorder → VelRepeat → profile/account → address (GPS) → wishlist → notifications ทุกปุ่ม action ต่อ API จริง ไม่มี UI mock
