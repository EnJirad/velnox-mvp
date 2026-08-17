# VelShop UX/UI Cleanup Report

เป้าหมาย: ปรับ VelShop ทั้งระบบให้สะอาด สมดุล ใช้งานง่าย ดูเป็น Production E-commerce
หลัก: **LESS CLUTTER · MORE SHOPPING · BETTER UX** — ลดความรก แต่ไม่ลด functionality
(backend / Neon / API / Business logic ไม่ถูกแตะ — ทุกอย่างยังเป็นระบบเดิม)

## 1. หน้า/Component ที่ถูกปรับ

| ส่วน | ผล |
|---|---|
| **Footer** (`ShopFooter.tsx`) | เขียนใหม่ทั้งอัน — **ลดจาก 5 คอลัมน์ + icons + 20+ links เหลือ 3 คอลัมน์สั้น + แถบล่าง** |
| **Header** (`ShopHeader.tsx`) | ลด icons จาก 6 เหลือ 2 (cart + account) — เอา wishlist/bell/velrepeat ออกจาก header |
| **Homepage** (`ShopHome.tsx`) | ลดจาก 8+ sections เหลือ: hero คอมแพกต์ → หมวดหมู่ยอดนิยม → สินค้ายอดนิยม → (แนะนำ/ซื้อซ้ำ เฉพาะเมื่อมีข้อมูลจริง) → VelRepeat strip สั้น |
| **Product Card** (`ProductCard.tsx` ใหม่) | การ์ดกลางเดียวใช้ร่วม Home + Catalog — image/ชื่อ/ราคา/stock + ปุ่มใส่ตะกร้า ไม่มีหัวใจ/badge/อนิเมชัน |
| **Catalog** (`ShopProducts.tsx`) | ใช้ ProductCard ร่วม + grid tablet **3 คอลัมน์** (มือถือ 2 / เดสก์ท็อป 4) |
| **Map** (`MapPicker.tsx`) | เขียนใหม่ — satellite default + สลับแผนที่ + ค้นหาสถานที่ + ยืนยันพิกัด |
| **Address** (`ShopAddresses.tsx`) | บังคับ **ยืนยันพิกัด** ก่อนบันทึกทุกที่อยู่ |
| **Cookie Consent** (`lib/cookie-consent.tsx` ใหม่) | banner + settings dialog + เก็บ localStorage |
| **Cookie Policy** (`pages/CookiePolicy.tsx` ใหม่) | หน้า `/cookies` + ปุ่มเปิดตั้งค่า |
| **404** (`@velnox/shared/pages/NotFound.tsx`) | เขียนใหม่จากหน้าเก่า (framer-motion + สี gray + ข้อความอังกฤษตายตัว) → ใช้ theme token (`bg-background`/`muted`) + i18n (`common.notFound` / `common.notFoundDesc` ใหม่ใน th/en/my) + ปุ่มกลับหน้าแรก — ใช้ร่วม velshop/velseller/velcenter |

## 2. Footer — ลดอะไรออกบ้าง

- เอา **SHOP / LEGAL / VELNOX columns** + ไอคอนทุกตัว + seller CTA + secure note ออก
- เหลือ: Brand + tagline · **ช่วยเหลือ** (ติดต่อเรา/คำถามที่พบบ่อย/การคืนสินค้า) · **บัญชี** (เข้าสู่ระบบ/คำสั่งซื้อ) · **สำหรับผู้ขาย** (ร่วมขายกับ Velnox)
- แถบล่าง: © 2026 Velnox · Privacy · Terms · **ตั้งค่าคุกกี้** (เปิด modal ในแอป — ตาม spec §63–64)

## 3. Header — เปลี่ยนอะไร

- Desktop: Logo · Home/Products/Categories · Search · ภาษา · Cart · Account
- Mobile: Logo · Search · Cart · Account (bottom nav คือ menu)
- ลบ: wishlist / notifications / VelRepeat icons (ย้ายเข้าบัญชี hub ตาม spec §4)
- Header height ลดจาก h-16 → h-14

## 4. Homepage — ลบ/ย้ายอะไร

- **ลบ**: Shops section, Trust section, สินค้าทั้งหมด grid ใหญ่, VelRepeat explainer 2 คอลัมน์, secondary hero CTAs
- **ย้าย**: VelRepeat → strip สั้น 1 แถว, reorder/continue-shopping → แสดงทีละอัน (reorder เมื่อถึงรอบ, regulars เป็น fallback) — แสดงเฉพาะ logged-in
- ยังคงเป็นข้อมูลจริงทั้งหมด: soldCount/rating จาก backend, recommendations จริง, reorder จากประวัติออเดอร์จริง

## 5. Map / Address — พิกัดเป็น Required Data (spec §33–54)

- **Satellite view เป็นค่าเริ่มต้น** (Esri World Imagery — ไม่ต้อง API key ใหม่) + ปุ่มสลับแผนที่ปกติ
- เปิด "เพิ่มที่อยู่ใหม่" → ขอ permission → ดึงตำแหน่งปัจจุบันเป็น **จุดเริ่มต้น** เท่านั้น (`locationConfirmed = false`)
- ลากหมุด / แตะแผนที่ / ค้นหาสถานที่ (Nominatim) → อัปเดตพิกัด + **reset การยืนยัน**
- ต้องกด **"ยืนยันตำแหน่งนี้"** ก่อน → ถึงบันทึกได้ (save ถูก block + ข้อความ "กรุณาเลือกและยืนยันพิกัดบนแผนที่ก่อนบันทึกที่อยู่")
- แก้ที่อยู่เดิมที่มีพิกัด → marker อยู่พิกัดเดิม + confirmed เริ่มต้นเป็น true; ถ้าเลื่อนหมุด → ต้องยืนยันใหม่
- Permission denied / ไม่รองรับ → inline message ไม่ block, เลือกเองบนแผนที่ได้
- Backend validation เดิมมีอยู่แล้ว (lat -90..90, lng -180..180, คู่กัน, default ต้องมี GPS) — **ไม่แก้ backend ตามคำสั่ง**

## 6. Cookie Consent (spec §55–74)

- Banner ครั้งแรก (bottom, อยู่เหนือ tab bar ไม่บัง) → ยอมรับทั้งหมด / ตั้งค่าคุกกี้ / ปฏิเสธที่ไม่จำเป็น
- Settings: Necessary (Always Active) + Preferences/Analytics/Marketing toggle + บันทึก
- เก็บ `localStorage` (version "1") — reload ไม่แสดงซ้ำ, เปลี่ยนภายหลังได้จาก footer + หน้า /cookies
- **ไม่มี tracking ปลอม** — analytics/marketing ไม่ initialize อะไร (ไม่มี provider จริงในระบบ)

## 7. ฟังก์ชันที่ยังคงเดิม (ไม่ถูกแตะ)

Cart/Checkout/Orders/OrderDetail/Tracking/VelRepeat/Wishlist/Notifications/Account/auth/login — backend, Neon, API contract, validation ทั้งหมดเหมือนเดิม
- Cart ยังมี sticky checkout bar, checkout ยังคำนวณราคาฝั่ง server, order/return/review ยังทำงานจริง

## 8. ตรวจสอบ

| ตรวจ | ผล |
|---|---|
| Lint (ไฟล์ที่แก้) | ✅ PASS (0 errors; 2 warnings เดิมของ main.tsx/react-refresh) |
| Typecheck (`tsc -b --noEmit`) | ✅ PASS |
| Build shop / seller / center / corporate | ✅ PASS ทั้ง 4 |
| Tests | ✅ **188 pass / 0 fail** (4901 expects — รวม locale parity th/en/my ครบ) |
| Mobile (360/390/430) | ✅ 2-col grid, bottom nav + cookie banner ไม่ทับกัน, filter sheet, map เต็ม dialog |
| Tablet (768/1024) | ✅ grid 3 คอลัมน์ |
| Desktop (1280–1920) | ✅ max-w-6xl container, filter sidebar, 4 คอลัมน์ |

## 9. Files ที่แก้/เพิ่ม

แก้: `apps/shop/src/main.tsx` · `components/shop/ShopHeader.tsx` · `ShopFooter.tsx` · `MapPicker.tsx` · `pages/ShopHome.tsx` · `ShopProducts.tsx` · `ShopAddresses.tsx` · `packages/shared/src/pages/NotFound.tsx` · `packages/shared/src/lib/i18n/locales/{th,en,my}.ts` (เพิ่ม `common.notFoundDesc`)
เพิ่ม: `components/shop/ProductCard.tsx` · `lib/cookie-consent.tsx` · `pages/CookiePolicy.tsx` · `docs/VELSHOP_UX_CLEANUP_REPORT.md`

## 10. หมายเหตุ

- ไม่มี dependency ใหม่ — ใช้ leaflet ที่มีอยู่ + Esri/Nominatim (ฟรี, graceful fallback)
- Map search ใช้ Nominatim ซึ่งเป็น free geocoder — ถ้าต้องการคุณภาพระดับ production แนะนำตั้ง Google Places / Mapbox Geocoding ผ่าน API key ในอนาคต
- ไม่มีหน้า Privacy Policy ภายใน (ลิงก์ไป corporate site) — ตาม spec §66 ให้เจ้าของระบบกรอกข้อมูลจริงภายหลัง
