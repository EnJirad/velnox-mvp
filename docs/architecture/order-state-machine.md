# Order State Machine

> Phase 2: Commerce API Foundation

## Overview

Orders follow a defined state machine. Each transition is server-side validated, audit-logged, and produces a Brain event.

## Order Statuses

| Status | Meaning | Consumer Can See | Seller Can Act | Admin Can Act |
|--------|---------|:---:|:---:|:---:|
| `pending` | Order placed, awaiting confirmation | ✅ | ✅ | ✅ |
| `confirmed` | Seller accepted the order | ✅ | ✅ | ✅ |
| `shipped` | Order shipped with tracking | ✅ | ✅ | ✅ |
| `delivered` | Customer received the order | ✅ | ✅ | ✅ |
| `completed` | Order fully completed | ✅ | ❌ | ✅ |
| `cancelled` | Order cancelled | ✅ | ✅ | ✅ |

## Allowed Transitions

```
pending ──────────→ confirmed ──────────→ shipped ──────────→ delivered ──────────→ completed
  │                    │                    │                    │
  │                    │                    │                    │
  └──→ cancelled       └──→ cancelled       └──→ cancelled       └──→ cancelled
```

### Transition Rules

| From | To | Who | Event |
|------|----|-----|-------|
| `pending` | `confirmed` | Seller / Admin | `ORDER_CONFIRMED` |
| `pending` | `cancelled` | Seller / Customer / Admin | `ORDER_CANCELLED` |
| `confirmed` | `shipped` | Seller / Admin | `ORDER_SHIPPED` |
| `confirmed` | `cancelled` | Seller / Admin | `ORDER_CANCELLED` |
| `shipped` | `delivered` | Seller / Admin | `ORDER_DELIVERED` |
| `shipped` | `cancelled` | Admin only | `ORDER_CANCELLED` |
| `delivered` | `completed` | Admin only / Auto | `ORDER_COMPLETED` |
| `delivered` | `cancelled` | Admin only | `ORDER_CANCELLED` |

### Validation Rules

1. **Forward-only** — Cannot go backwards (e.g., `shipped` → `confirmed`)
2. **Cancelled is terminal** — Once cancelled, no further transitions
3. **Completed is terminal** — Once completed, no further transitions
4. **Seller scope** — Seller can only transition their own orders
5. **Payment check** — `confirmed` → `shipped` requires payment status `paid` (for non-COD)

## Payment Status

| Status | Meaning |
|--------|---------|
| `unpaid` | No payment attempted |
| `pending` | Payment in progress |
| `paid` | Payment received |
| `partially_refunded` | Partial refund issued |
| `refunded` | Full refund issued |
| `failed` | Payment failed |

### Payment-Order Interaction

- `pending` → `confirmed`: Payment must be `paid` or `cod` method
- `confirmed` → `shipped`: Payment must be `paid`
- Cancellation with `paid` status: Triggers refund flow

## Shipping Status

| Status | Meaning |
|--------|---------|
| `not_shipped` | No shipment created |
| `processing` | Preparing for shipment |
| `shipped` | In transit |
| `delivered` | Delivered to customer |
| `returned` | Returned by customer |

## Return Flow

```
Customer requests return
    ↓
Return status: "requested"
    ↓
Seller/Admin reviews
    ↓
  ├──→ "approved" → Process refund → "processed"
  └──→ "rejected"
```

## Brain Events

| Transition | Event | Data |
|------------|-------|------|
| Create order | `PURCHASE` | orderId, items, total |
| Reorder | `REPEAT_PURCHASE` | orderId, originalOrderId |
| Cancel | `PURCHASE_CANCEL` | orderId, reason |
| Return requested | — | orderId, reason |

## Idempotency

Order creation supports idempotency via `idempotencyKey` in the checkout request. The backend deduplicates on `(userId, idempotencyKey)` within a 24-hour window.

```
Mobile network retry
    ↓
Same idempotencyKey
    ↓
Backend returns existing order (not duplicate)
```

## Audit Trail

Every state transition is audit-logged:

```typescript
{
  actorId: string;
  actorRole: string;
  action: "ORDER_STATUS_CHANGED";
  entityType: "order";
  entityId: string;
  before: { status: "pending" };
  after: { status: "confirmed" };
  ipAddress: string | null;
  userAgent: string | null;
}
```
