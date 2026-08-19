# AI HANDOFF — Velnox MVP

> Last Updated: August 19, 2026  
> Phase: 2 — Commerce API Foundation COMPLETE  
> Latest Commit: pending push
> APK Build Status: BLOCKED

---

## 1. CURRENT PROJECT STATUS

| Area | Status |
|------|--------|
| Phase 0 — Architecture Audit | ✅ COMPLETE |
| Phase 1 — Brain Foundation | ✅ COMPLETE |
| Phase 1.1 — Brain Stabilization | ✅ COMPLETE |
| Phase 2 — Commerce API Foundation | ✅ COMPLETE |
| Phase 3 — VelShop Mobile App | ⏳ NEXT |

## 2. CURRENT ARCHITECTURE

```
VelShop (Mobile App)  ← Future (Phase 3)
VelSeller (Web)       ← Existing
VelCenter (Web)       ← Existing
        │
        └── Velnox Backend (Convex + Neon)
              ├── Commerce Core (Neon — source of truth)
              ├── Customer Memory / Brain (Convex + Neon)
              ├── Authentication (Convex Auth — email OTP)
              ├── Image Upload (Convex → Cloudinary, server-side)
              └── Payment (Stripe integration)
```

### Package Manager
- **Bun** — use `bun install`, `bun run`, NOT npm or pnpm
- Lock file: `bun.lock` (no `package-lock.json`)

### Backend Architecture
- **Convex** — node actions ("use node") for all business logic
- **Neon** — source of truth for commerce data
- **Identity** — `backend/identity.ts` → centralized auth guards
- **Errors** — `backend/errors.ts` → `AppError` with stable codes

## 3. COMMERCE API — COMPLETE

### API Modules

| Module | File | Client | Status |
|--------|------|--------|--------|
| Customer API | `convex/customer.ts` | VelShop | ✅ |
| Commerce API | `convex/commerce.ts` | All | ✅ |
| Seller API | `convex/sellerOps.ts` | VelSeller | ✅ |
| Admin API | `convex/centerAdmin.ts` | VelCenter | ✅ |
| Brain API | `convex/brain.ts` | All | ✅ |
| Memory API | `convex/memory.ts` | All | ✅ |
| Auth API | `convex/auth.ts` | All | ✅ |
| Stripe API | `convex/stripe.ts` | VelShop | ✅ |

### Authorization Model

| Helper | Purpose |
|--------|---------|
| `requireIdentity(ctx)` | Any authenticated user |
| `requireRoles(ctx, roles)` | User with specific role(s) |
| `requireSeller(ctx)` | Active seller with shop |
| `requireSellerForShop(ctx, shopId)` | Seller who owns specific shop |
| `requirePermission(ctx, perm)` | Granular staff permission |
| `requireCenter(ctx)` | Owner, admin, or staff |

### Error Model

Stable error codes in `backend/errors.ts`:
- `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, `OUT_OF_STOCK`
- `PRICE_CHANGED`, `PAYMENT_FAILED`, `RATE_LIMITED`, etc.

### Order State Machine

```
pending → confirmed → shipped → delivered → completed
  ↓         ↓          ↓          ↓
cancelled cancelled  cancelled  cancelled
```

### Shared Types

`packages/shared/src/api/types.ts` — API response contracts for all clients:
- `ApiResponse<T>`, `PaginatedResponse<T>`
- `ProductDTO`, `CartDTO`, `OrderDTO`, `AddressDTO`
- `SearchParams`, `CheckoutRequest`
- `RecommendationItemDTO`, `CustomerMemoryDTO`
- `ERROR_CODES`, `EVENT_SOURCES`

## 4. FILES CREATED IN PHASE 2

| File | Purpose |
|------|---------|
| `packages/shared/src/api/types.ts` | Shared API response contracts & DTOs |
| `docs/api/README.md` | Main API documentation index |
| `docs/api/customer.md` | Customer API docs |
| `docs/api/commerce.md` | Commerce API docs |
| `docs/api/seller.md` | Seller API docs |
| `docs/api/admin.md` | Admin API docs |
| `docs/api/brain.md` | Brain API docs |
| `docs/api/memory.md` | Memory API docs |
| `docs/api/auth.md` | Auth API docs |
| `docs/api/payments.md` | Payment API docs |
| `docs/api/addresses.md` | Address API docs |
| `docs/api/stores.md` | Stores API docs |
| `docs/api/search.md` | Search API docs |
| `docs/api/categories.md` | Categories API docs |
| `docs/api/stripe.md` | Stripe API docs |
| `docs/architecture/order-state-machine.md` | Order state machine doc |
| `tests/commerce-api.test.ts` | 30 API contract tests |
| `tests/commerce-flow.test.ts` | 9 integration flow tests |

## 5. FILES MODIFIED IN PHASE 2

None — all changes were additive (new files only).

## 6. DATABASE CHANGES

None in Phase 2 — all existing tables preserved.

## 7. TEST RESULTS

```
Test Files:  23 passed (23)
Tests:       265 passed (265)
Duration:    ~7s
```

## 8. TYPECHECK & BUILD

- ✅ `tsc -b --noEmit` — PASS
- ✅ `bun run build:shop` — PASS
- ✅ `bun run test` — 265/265 PASS

## 9. APK BUILD STATUS

| Item | Status |
|------|--------|
| Android Project (`mobile/velshop/`) | ❌ NOT CREATED — does not exist |
| JDK | ❌ NOT INSTALLED in current environment |
| Android SDK | ❌ NOT INSTALLED in current environment |
| Gradle | ❌ NOT AVAILABLE |
| Debug APK | ❌ NOT BUILT |
| Release APK | ❌ NOT BUILT |
| ADB Device Test | ❌ BLOCKED — no device |
| GitHub Release | ❌ BLOCKED — no APK to release |
| `docs/mobile/APK_BUILD.md` | ✅ CREATED (documents requirements) |
| `docs/mobile/APK_INSTALLATION.md` | ✅ CREATED (documents installation) |

### Why APK Build is Blocked

The VelShop Android project does not exist yet. Phase 3 (VelShop Mobile App) has not been started. The repository currently only contains web applications.

To build an APK, the following must happen first:
1. Create `mobile/velshop/` Android project with Kotlin/Jetpack Compose
2. Implement the mobile app screens (Phase 3)
3. Have Android SDK + JDK in the build environment

See `docs/mobile/APK_BUILD.md` for full requirements.

## 10. KNOWN ISSUES

1. **ProfileImageUpload.tsx** — still makes direct browser → Cloudinary calls (LEGACY / DEFERRED)
2. **Neon migration 012** — must be run manually before signal computation works
3. **Convex legacy modules** — `convex/products.ts`, `convex/orders.ts`, `convex/center.ts` are marked `@deprecated` but still referenced by some queries
4. **Android APK** — BLOCKED: no Android project, no build environment

## 11. MUST NOT CHANGE

- Neon commerce schema (users, products, orders, etc.)
- Convex backend architecture
- Authentication system (Convex Auth)
- Cloudinary backend upload (server-side only)
- Event canonical names (28 types)
- Scoring weights (in `customer-memory-core.ts`)
- Order state machine transitions
- Existing frontend functionality (VelShop Web, VelSeller, VelCenter)

## 12. NEXT PHASE

**Phase 3 — VelShop Mobile App**

Build the mobile app using the standardized Commerce API:
- Login / Register
- Home (personalized feed + recommendations)
- Search / Categories
- Product Detail
- Cart / Checkout
- Orders / Order Detail
- Profile / Addresses
- Notifications
- VelRepeat (subscriptions)
- Brain event tracking integration
