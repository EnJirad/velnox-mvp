# Velnox Shared Package

Shared frontend code for all four apps lives in one Bun workspace package:

`packages/shared` (imported as `@velnox/shared`, source under `packages/shared/src`)

| Area | Location | Contents |
|---|---|---|
| UI kit | `packages/shared/src/components/ui/` | 60+ shadcn/ui primitives (button, dialog, table, form, …) — no business logic |
| App shell & shared components | `packages/shared/src/components/` | `AppHeader`, `RequireAuth`, `RequireRole`, `UserMenu`, `MobileTabBar`, seller/goals/reorder dialogs |
| Hooks | `packages/shared/src/hooks/` | `use-auth`, `use-mobile` |
| Lib | `packages/shared/src/lib/` | `sites` (SITE_URLS / basename), `utils` (cn), `commerce` types, `shop`/`goals`/`reorder` helpers, `customer-memory-core`, `track`, `monitoring`, `app-shell`, `vly-integrations` |
| Auth pages | `packages/shared/src/pages/` | `Auth`, `NotFound` |
| Theme | `packages/shared/src/index.css` | global Tailwind v4 theme CSS (imported by every app entry) |

## Rules

- **No duplication:** shared code is imported as `@velnox/shared/...` from a single
  location — never copied into an app.
- **No business logic in `ui`:** UI primitives stay free of app logic.
- Apps must not import each other's source; they communicate through the
  production domains (`SITE_URLS` in `packages/shared/src/lib/sites.ts`).

## Shared infrastructure (not packages)

The shared backend stays centralized at the repo root:

| Piece | Location |
|---|---|
| Convex backend (one deployment for all apps) | `convex/` |
| Neon commerce core (business rules) | `backend/` |
| Database schema & migrations | `db/` |
| Unit tests | `tests/` |
