# Velnox API Documentation

> Phase 2: Commerce API Foundation

## Overview

The Velnox API is a single backend powering three clients:

- **VelShop** (Mobile App) — Customer-facing
- **VelSeller** (Web) — Seller-facing
- **VelCenter** (Web) — Admin-facing

All clients use the same Convex node actions backed by Neon (source of truth).

## Architecture

```
Client (React / future Kotlin)
    ↓
Convex Node Actions ("use node")
    ↓
Backend Services (src/backend/*.ts)
    ↓
Neon Database (source of truth)
    ↓
Response → Client
```

## Authentication

All protected endpoints require a valid Convex Auth session.

- **Auth Provider:** Convex Auth (email OTP + anonymous)
- **Identity Resolution:** `backend/identity.ts` → `requireIdentity()`
- **Roles:** customer, seller, staff, admin, owner
- **Never trust client-provided userId/role**

## Authorization Helpers

| Helper | Purpose |
|--------|---------|
| `requireIdentity(ctx)` | Any authenticated user |
| `requireRoles(ctx, roles)` | User with specific role(s) |
| `requireSeller(ctx)` | Active seller with shop |
| `requireSellerForShop(ctx, shopId)` | Seller who owns specific shop |
| `requirePermission(ctx, perm)` | Granular staff permission |
| `requireCenter(ctx)` | Owner, admin, or staff |

## API Modules

| Module | File | Purpose | Client |
|--------|------|---------|--------|
| [Customer API](./customer.md) | `convex/customer.ts` | Profile, cart, orders, addresses | VelShop |
| [Commerce API](./commerce.md) | `convex/commerce.ts` | Products, shops, seller operations | All |
| [Seller API](./seller.md) | `convex/sellerOps.ts` | Shipments, returns, finance | VelSeller |
| [Admin API](./admin.md) | `convex/centerAdmin.ts` | Platform management | VelCenter |
| [Brain API](./brain.md) | `convex/brain.ts` | Intelligence, recommendations | All |
| [Memory API](./memory.md) | `convex/memory.ts` | Real-time memory, insights | All |
| [Auth API](./auth.md) | `convex/auth.ts` | Authentication | All |
| [Stripe API](./stripe.md) | `convex/stripe.ts` | Payment processing | VelShop |

## Shared Types

All API response types are shared across clients via `packages/shared/src/api/types.ts`.

Import from:
```typescript
import type {
  ProductDTO,
  CartDTO,
  OrderDTO,
  AddressDTO,
  ApiResponse,
} from "@velnox/shared/api/types";
```

## Error Model

All errors follow a consistent structure:

```typescript
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "ไม่พบสินค้านี้"
  }
}
```

See [Error Codes](#error-codes) below.

## Event Tracking

Every significant user interaction is tracked by the Velnox Brain:

| Action | Event | Source |
|--------|-------|--------|
| View product | `PRODUCT_VIEW` | VELSHOP |
| Search | `SEARCH` | VELSHOP |
| Add to cart | `CART_ADD` | VELSHOP |
| Purchase | `PURCHASE` | VELSHOP |
| Recommendation shown | `RECOMMENDATION_VIEW` | VELSHOP |

## Error Codes

| Code | HTTP Equivalent | Meaning |
|------|-----------------|---------|
| `UNAUTHENTICATED` | 401 | Not signed in |
| `FORBIDDEN` | 403 | No permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `PRODUCT_NOT_FOUND` | 404 | Product doesn't exist |
| `SHOP_NOT_FOUND` | 404 | Shop doesn't exist |
| `ORDER_NOT_FOUND` | 404 | Order doesn't exist |
| `OUT_OF_STOCK` | 409 | Product out of stock |
| `INSUFFICIENT_STOCK` | 409 | Not enough stock |
| `PRICE_CHANGED` | 409 | Price changed since cart |
| `PAYMENT_FAILED` | 422 | Payment processing failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `CONFLICT` | 409 | Duplicate operation |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

Rate limiting is enforced on sensitive endpoints:

- Authentication (login, OTP)
- Search
- Checkout
- Order creation
- Event ingestion
- Image upload

## Idempotency

Critical mutations support idempotency via `idempotencyKey`:

- Order creation (`checkoutAction`)
- Payment operations
- Event ingestion

The backend deduplicates on `(userId, idempotencyKey)` for a configurable window.

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection | Yes |
| `CLOUDINARY_CLOUD_NAME` | Image storage | Yes |
| `CLOUDINARY_API_KEY` | Image storage | Yes |
| `CLOUDINARY_API_SECRET` | Image storage (server only) | Yes |
| `STRIPE_SECRET_KEY` | Payment processing | Optional |
| `STRIPE_WEBHOOK_SECRET` | Payment webhooks | Optional |

## API Versioning

Current version: **v1**

All endpoints are implicitly v1. Future breaking changes will be versioned with a `/v2/` prefix.
