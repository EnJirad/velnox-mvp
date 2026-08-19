# Stripe API

> Stripe payment integration

**File:** `convex/stripe.ts`  
**Client:** VelShop  
**Auth:** Required (customer)

## Endpoints

| Action | Purpose |
|--------|---------|
| `stripeConfiguredAction()` | Check if Stripe is configured |
| `createStripeCheckoutAction(data)` | Create checkout session |
| `stripePaymentStatusAction(sessionId)` | Check payment status |

## Flow

```
1. Customer selects "Pay with Card"
2. Frontend calls createStripeCheckoutAction
3. Backend creates Stripe Checkout Session
4. Frontend redirects to Stripe hosted page
5. Customer completes payment
6. Stripe redirects back to success/cancel URL
7. Stripe webhook confirms payment
8. Order status updated to "paid"
```

## Environment Variables

| Variable | Required |
|----------|----------|
| `STRIPE_SECRET_KEY` | Yes |
| `STRIPE_WEBHOOK_SECRET` | Yes (for webhooks) |

## Security

- Stripe keys never exposed to client
- Webhook signature verified server-side
- Payment status always determined by Stripe, not client
