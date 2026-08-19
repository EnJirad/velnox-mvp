# Seller API

> VelSeller Web — shipments, returns, finance, product management

**File:** `convex/sellerOps.ts` + `convex/commerce.ts`  
**Client:** VelSeller (Web)  
**Auth:** Required (seller role)

## Seller Operations (sellerOps.ts)

| Action | Purpose |
|--------|---------|
| `myShipments()` | List seller's shipments |
| `createShipmentAction(data)` | Create shipment for order |
| `myReturns()` | List seller's returns |
| `sellerReturnStats()` | Return statistics |
| `updateReturnStatus(data)` | Approve/reject return |
| `sellerFinancialReport(data)` | Income report |
| `requestPayout(data)` | Request payout |

## Seller Commerce (commerce.ts)

| Action | Purpose |
|--------|---------|
| `mySellerProfile()` | Seller profile |
| `openShop(data)` | Create shop |
| `listProducts()` | Seller's products |
| `createProductAction(data)` | Create product |
| `updateProductAction(data)` | Update product |
| `deleteProductAction(id)` | Delete product |
| `setProductStatusAction(data)` | Publish/archive |
| `sellerOrders()` | Seller's orders |
| `setOrderStatus(data)` | Update order status |
| `sellerIncomeReport()` | Income report |
| `sellerReorderSuggestionsAction()` | Reorder suggestions |

## Authorization

- Seller must own the shop
- Ownership checked server-side via `requireSellerForShop(ctx, shopId)`
- Cannot access other seller's data
