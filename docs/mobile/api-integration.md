# VelShop Mobile — API Integration

## Overview

The VelShop Mobile app communicates with the Velnox backend via HTTP REST API.
All business logic (prices, totals, stock, payments) is computed server-side.

## API Client

Located at: `data/remote/ApiClient.kt`

- Uses Retrofit + OkHttp + KotlinX Serialization
- Bearer token authentication via `AuthInterceptor`
- Request ID tracking via `RequestIdInterceptor`

## Endpoints

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (with filters) |
| GET | `/api/products/{id}` | Get product detail |
| GET | `/api/products/{id}/variants` | Get product variants |
| GET | `/api/categories` | List categories |
| GET | `/api/search?q=...` | Search products |

### Cart

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart items |
| POST | `/api/cart/items` | Add item to cart |
| PATCH | `/api/cart/items/{id}` | Update quantity |
| DELETE | `/api/cart/items/{id}` | Remove item |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checkout` | Place order |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/{id}` | Get order detail |
| PATCH | `/api/orders/{id}/cancel` | Cancel order |

### Addresses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/addresses` | List addresses |
| POST | `/api/addresses` | Create address |
| PATCH | `/api/addresses/{id}` | Update address |
| DELETE | `/api/addresses/{id}` | Delete address |

### Wishlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishlist` | Get wishlist |
| POST | `/api/wishlist` | Add to wishlist |
| DELETE | `/api/wishlist/{id}` | Remove from wishlist |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get user profile |
| PATCH | `/api/user/profile` | Update profile |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events` | Track single event |
| POST | `/api/events/batch` | Track batch of events |

## Authentication

1. User enters email → OTP sent via Convex Auth
2. OTP verified → JWT token returned
3. Token stored in EncryptedSharedPreferences
4. All subsequent requests include `Authorization: Bearer <token>`

## Error Handling

All API responses follow the pattern:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "code": null
}
```

Errors are surfaced to UI via `RepoResult.Error` with Thai language messages.
