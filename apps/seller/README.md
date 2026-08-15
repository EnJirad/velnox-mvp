# apps/seller — VelSeller (seller.velnox.com)

แพลตฟอร์มเจ้าของร้าน (spec §7) — ต้อง auth + บทบาท seller; server-side ตรวจ ownership
ทุกครั้ง (Seller A ห้ามแตะข้อมูล Seller B)

## จุดเชื่อม (mapping)

- Entry: `velseller.html`
- Bootstrap: `src/sites/velseller/main.tsx` (ทุก route อยู่ใน `RequireRole role="seller"`)
- Pages: `Dashboard` (เป้าหมาย) · `MyShop` · `Reorder` (Smart Reorder) · `SellerOrders` · `Income` · `Auth`
- Seller logic (server): `src/convex/sellerOps.ts` + `src/backend/sellers.ts` + `src/backend/orders.ts` (sellerIncome)
- Image upload: `src/backend/storage.ts` (Cloudinary signed upload — secret ไม่ถึง browser)

## Build & Deploy (Vercel)

```bash
bun run build:seller     # vite build --config vite.config.velseller.ts
bun run dev:seller
```

- Vercel project: `velnox-seller` · Root `/` · Domain `seller.velnox.com`
- robots: `velseller.html` มี `<meta name="robots" content="noindex, nofollow">` (SEO ไม่ใช่ priority)
- เส้นทางเข้าจาก VelShop: ปุ่ม "สมัครเปิดร้านค้า" → `SITE_URLS.velseller`
