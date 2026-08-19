# Payment API

> Payment processing — Stripe integration

**Files:** `convex/stripe.ts`, `backend/payments.ts`, `backend/stripe.ts`  
**Client:** VelShop  
**Auth:** Required

## Payment Methods

| Method | Status | Notes |
|--------|--------|-------|
| COD (Cash on Delivery) | ✅ Active | No external provider needed |
| Bank Transfer | ✅ Active | Manual verification |
| Stripe Card | ✅ Active | Requires Stripe setup |
| PromptPay | ⏳ Planned | — |
| Wallet | ⏳ Planned | — |

## Stripe Endpoints

| Action | Purpose |
|--------|---------|
| `stripeConfiguredAction()` | Check if Stripe is set up |
| `createStripeCheckoutAction(data)` | Create Stripe checkout session |
| `stripePaymentStatusAction(sessionId)` | Check payment status |

## Payment Flow

```
Customer checkout
    ↓
Payment method selected
    ↓
  ├── COD → Order created (unpaid)
  ├── Transfer → Order created (pending)
  └── Stripe → Checkout session → Redirect → Webhook → Paid
    ↓
Order status updated
    ↓
PURCHASE event tracked
```

## Security

- Payment secrets never exposed to client
- Stripe webhook signature verified server-side
- Payment status always determined server-side
- Never trust client-reported payment status
