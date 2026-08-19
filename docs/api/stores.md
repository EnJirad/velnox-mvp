# Stores API

> Public store/shop information

**File:** `convex/customer.ts`, `convex/commerce.ts`  
**Client:** VelShop, VelSeller  
**Auth:** Public for reads, seller for writes

## Public Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `publicShops()` | None | List active shops |
| `shopDetail(shopId)` | None | Shop details |
| `storefront.settings()` | None | Storefront configuration |

## Seller Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `openShop(data)` | Seller | Create shop |
| `updateShopAction(data)` | Seller | Update shop info |

## Shop Fields

| Field | Public | Seller Only |
|-------|:------:|:-----------:|
| id | ✅ | ✅ |
| name | ✅ | ✅ |
| slug | ✅ | ✅ |
| description | ✅ | ✅ |
| imageUrl | ✅ | ✅ |
| phone | ✅ | ✅ |
| address | ✅ | ✅ |
| latitude | ✅ | ✅ |
| longitude | ✅ | ✅ |
| status | ✅ | ✅ |
| productCount | ✅ | ✅ |
| orderCount | ❌ | ✅ |
| commissionRate | ❌ | ✅ |
| sellerId | ❌ | ✅ |
