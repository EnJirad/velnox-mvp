# Velnox Corporate

Velnox Group corporate website (velnox.com) — company information, vision,
business, ecosystem, careers, news and contact. Public and informational only:
**no** Convex client, **no** auth, **no** dashboards. It links out to the real
applications (VelShop / VelSeller / VelCenter) via `SITE_URLS`.

**Production domain:** https://velnox.com

## What's here

| Piece | Location |
|---|---|
| Entry HTML | `index.html` |
| Bootstrap / router | `src/main.tsx` |
| Corporate pages | `src/pages/corporate/` (`CorporateHome`, `CorporateLayout`, `StaticPage`, `Contact`, `content`) |
| Shared UI/lib | `@velnox/shared` → `../../packages/shared/src/` (Logo, `lib/utils`, `lib/sites`, theme CSS) |

## Development

```bash
bun install                # at the repo root (Bun workspace)
bun run dev:corporate      # from the repo root → http://localhost:5173
# or, from this folder:
bun run dev
```

## Build

```bash
bun run build              # from this folder → static output in apps/corporate/dist
```

## Deploy (Vercel)

- Repository: `EnJirad/velnox-mvp`
- **Root Directory:** `apps/corporate`
- **Framework:** Vite · **Build:** `bun run build` · **Install:** `bun install` · **Output:** `dist`
- `vercel.json` applies security headers + SPA rewrite to `index.html`.

## Environment variables (client / Vite)

- `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` — live domains for cross-site links
- `VITE_SITE_BASENAME` — empty for standalone domain deploy
