# apps/shop — VelShop (shop.velnox.com)

หน้าร้านค้าสาธารณะของ Velnox — จุดเข้าหลักของลูกค้า (spec §6)

## จุดเชื่อม (mapping)

- Entry: `velshop.html`
- Bootstrap: `src/sites/velshop/main.tsx` (15 routes + MobileTabBar แบบ app)
- Pages: `src/pages/Shop*.tsx`, `MyOrders`, `ShopOrderDetail`, `ShopTracking`, `VelRepeatPage`, ...
- Cart state: `src/lib/cart.tsx` (CartProvider)
- Customer Memory: `src/lib/track.ts` (events + IdentityMerge), `src/lib/customer-memory-core.ts`

## Routes

`/shop` · `/shop/products` · `/shop/categories` · `/shop/products/:productId` · `/shop/shops/:shopId`
· `/shop/cart` · `/shop/checkout` (auth) · `/shop/orders` (auth) · `/shop/orders/:orderId` (auth)
· `/shop/orders/:orderId/tracking` (auth) · `/shop/velrepeat` (auth) · `/shop/wishlist` (auth)
· `/shop/addresses` (auth) · `/shop/profile` (auth) · `/shop/notifications` (auth) · `/auth`

## Build & Deploy (Vercel)

```bash
bun run build:shop      # vite build --config vite.config.velshop.ts
bun run dev:shop
```

- Vercel project: `velnox-shop` · Root `/` · Domain `shop.velnox.com`
- Env: `VITE_CONVEX_URL` · `VITE_VELSELLER_URL` · `VITE_VELCENTER_URL` · `VITE_CORPORATE_URL` · `VITE_SITE_BASENAME=""`
- SEO: เปิดใช้ meta/OG/structured data ต่อสำหรับ product/category/shop (Blueprint ใน `src/lib/seo.ts`)
