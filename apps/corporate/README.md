# apps/corporate — Velnox Group (velnox.com)

เว็บไซต์องค์กรของ Velnox Group — **public, content-only** (ไม่มี auth, ไม่มี dashboard,
ไม่มี cart/checkout — ตาม spec §5)

## จุดเชื่อม (mapping)

- Entry: `corporate.html`
- Bootstrap: `src/sites/corporate/main.tsx`
- Pages: `src/pages/corporate/` (Home, StaticPage data-driven, Contact)
- Layout/theme: `src/pages/corporate/CorporateLayout.tsx` + shared tokens (`src/index.css`)
- Cross-site links: `SITE_URLS` ใน `src/lib/sites.ts`

## Routes

`/` (home) · `/about` · `/vision` · `/business` · `/ecosystem` · `/technology`
· `/careers` · `/news` · `/privacy` · `/terms` · `/contact`

## Build & Deploy (Vercel)

```bash
bun run build:corporate      # vite build --config vite.config.corporate.ts
bun run dev:corporate        # vite --config vite.config.corporate.ts
```

- Vercel project: `velnox-corporate` · Root `/` · Domain `velnox.com`
- SEO: meta description + OpenGraph + JSON-LD Organization อยู่ใน `corporate.html`
- robots: corporate ต้อง **index ได้** (ห้ามใส่ noindex)
