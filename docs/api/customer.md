# Customer API

> VelShop Mobile primary API — profile, cart, orders, addresses

**File:** `convex/customer.ts`  
**Client:** VelShop (Mobile)  
**Auth:** Required (all endpoints)

## Endpoints

### Profile

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `myProfile()` | Get current user profile | — |
| `updateProfileAction(data)` | Update name, phone | — |
| `getProfileImageUploadSignature()` | Get Cloudinary upload signature | — |
| `saveProfileImage(data)` | Save avatar/cover image URL | — |

### Addresses

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `myAddresses()` | List user addresses | — |
| `saveAddress(data)` | Create or update address | — |
| `deleteAddressAction(id)` | Delete address | — |

### Cart

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `myCart()` | Get active cart | — |
| `addToCartAction(data)` | Add item to cart | `CART_ADD` |
| `updateCartItemAction(data)` | Update quantity | `CART_UPDATE` |
| `removeCartItemAction(id)` | Remove item | `CART_REMOVE` |

### Checkout

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `checkoutAction(data)` | Process checkout | `CHECKOUT_START`, `PURCHASE` |

### Orders

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `orderDetail(id)` | Get order details | — |
| `reorderAction(orderId)` | Reorder from past order | `REORDER` |
| `requestReturnAction(data)` | Request order return | — |

### Products & Search

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `productReviews(productId)` | Get product reviews | — |
| `reviewProduct(data)` | Submit product review | — |
| `categoryStatsAction()` | Get categories with counts | `CATEGORY_VIEW` |
| `publicShops()` | List active shops | `STORE_VIEW` |
| `shopDetail(shopId)` | Get shop details | `STORE_VIEW` |

### Wishlist

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `myWishlist()` | List wishlist items | — |
| `toggleWishlistAction(productId)` | Toggle wishlist | `WISHLIST_ADD` / `WISHLIST_REMOVE` |

### Notifications

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `myNotifications()` | List notifications | — |
| `markNotificationReadAction(id)` | Mark as read | `NOTIFICATION_OPEN` |
| `markAllNotificationsRead()` | Mark all as read | — |

## Brain Integration

Every customer action that represents meaningful behavior triggers a Brain event:

```
addToCartAction → CART_ADD (productId, price, quantity)
checkoutAction  → CHECKOUT_START → PURCHASE (orderId, total)
reorderAction   → REORDER (productId)
```

Events are fire-and-forget — they never block the user flow.
