# Commerce API

> Shared commerce operations — products, shops, seller management

**File:** `convex/commerce.ts`  
**Clients:** VelShop, VelSeller  
**Auth:** Varies by endpoint

## Product Endpoints

| Action | Auth | Purpose | Brain Event |
|--------|------|---------|-------------|
| `listProducts(data)` | None | Public catalog | — |
| `getProductDetail(id)` | None | Product detail | `PRODUCT_VIEW` |
| `catalogProductsAction(data)` | None | Search/filter catalog | `SEARCH` |
| `categoryStatsAction()` | None | Categories with counts | — |

### Product Fields Returned

```typescript
{
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  currency: string;
  images: ProductImage[];
  status: string;
  averageRating: number | null;
  reviewCount: number;
  stockAvailable: number;
  createdAt: number;
  updatedAt: number;
}
```

## Shop Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `publicShops()` | None | List active shops |
| `shopDetail(shopId)` | None | Shop details |

## Seller Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `mySellerProfile()` | Seller | Seller profile |
| `openShop(data)` | Seller | Create shop |
| `listProducts()` | Seller | Seller's products |
| `createProductAction(data)` | Seller | Create product |
| `updateProductAction(data)` | Seller | Update product |
| `deleteProductAction(id)` | Seller | Delete product |
| `setProductStatusAction(data)` | Seller | Publish/archive |
| `setStockAction(data)` | Seller | Update stock |
| `setReorderLevelAction(data)` | Seller | Set reorder level |
| `sellerOrders()` | Seller | Seller's orders |
| `setOrderStatus(data)` | Seller | Update order status |
| `sellerIncomeReport()` | Seller | Income report |
| `sellerReorderSuggestionsAction()` | Seller | Reorder suggestions |

## Brain Integration

| Action | Event | Trigger |
|--------|-------|---------|
| `getProductDetail` | `PRODUCT_VIEW` | When customer views product |
| `catalogProductsAction` | `SEARCH` | When customer searches |
| `myOrders` | `REPEAT_PURCHASE` | When order completes |
