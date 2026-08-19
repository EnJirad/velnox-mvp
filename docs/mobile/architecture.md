# VelShop Mobile — Architecture

## Overview

VelShop Mobile is a **client-only** Android application built with Kotlin and Jetpack Compose.
It connects to the Velnox backend via HTTP API and does NOT contain authoritative business logic.

## Architecture Pattern

```
                         VELNOX BACKEND
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        Commerce API       Brain API        Auth API
              │                │                │
              └────────────────┼────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    HTTP (Retrofit)   │
                    └─────────────────────┘
                               │
                    ┌─────────────────────┐
                    │    Repository Layer  │
                    └─────────────────────┘
                               │
                    ┌─────────────────────┐
                    │   Compose UI (State) │
                    └─────────────────────┘
```

**Pattern**: UI (Composable) → Repository → Retrofit API Client → Backend

## Key Principles

1. **Client-only**: No prices, totals, or business logic computed locally
2. **No local database**: All data comes from the API
3. **Secure storage**: Auth tokens in EncryptedSharedPreferences (AES-256-GCM)
4. **Event tracking**: Behavioral events sent async to Brain API
5. **No secrets in app**: No API keys, no database credentials

## Module Structure

```
mobile/velshop/app/src/main/java/com/velnox/velshop/
├── VelShopApp.kt              # Application singleton
├── MainActivity.kt            # Single-activity Compose entry
├── data/
│   ├── local/
│   │   └── SessionManager.kt  # Encrypted auth + session storage
│   ├── model/
│   │   └── Models.kt          # All data classes (kotlinx.serialization)
│   ├── remote/
│   │   └── ApiClient.kt       # Retrofit API + interceptors
│   ├── repository/
│   │   ├── AuthRepository.kt  # Auth state management
│   │   ├── CartRepository.kt  # Cart CRUD
│   │   ├── OrderRepository.kt # Checkout, orders, addresses
│   │   └── ProductRepository.kt # Products, categories, search
│   └── tracking/
│       └── EventTracker.kt    # Behavioral event queue + flush
└── ui/
    ├── components/
    │   └── CommonComponents.kt # ProductCard, LoadingState, ErrorState, etc.
    ├── navigation/
    │   ├── Screen.kt          # Route definitions
    │   └── VelShopNavHost.kt  # NavHost + bottom nav
    ├── screens/               # 15 screens (see below)
    └── theme/
        ├── Theme.kt           # Velnox dark/light color scheme
        ├── Typography.kt      # Custom typography
        └── Shapes.kt          # Rounded shapes
```

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Splash | `splash` | App launch animation |
| Login | `login` | Email OTP login (Convex Auth) |
| Home | `home` | Product catalog + categories |
| Search | `search?q={query}` | Full-text product search |
| Product Detail | `product/{id}` | Product info + add to cart |
| Category | `category/{id}` | Products filtered by category |
| Store | `store/{sellerId}` | Products from a specific seller |
| Cart | `cart` | Cart items + quantity management |
| Checkout | `checkout` | Address + payment + order summary |
| Orders | `orders` | Order history list |
| Order Detail | `orders/{orderId}` | Single order + cancel |
| Profile | `profile` | User info + menu |
| Settings | `settings` | Language + logout |
| Addresses | `addresses` | Shipping addresses |
| Wishlist | `wishlist` | Saved products |

## API Connection

The mobile app uses Retrofit with kotlinx.serialization to communicate with the Velnox backend.
All API calls go through authenticated HTTP requests with Bearer token.

**Base URL**: Configured via `BuildConfig.API_BASE_URL` (set in `build.gradle.kts`)

## Event Tracking

19 canonical event types sent to the Brain API:
- APP_OPEN, SESSION_START, SESSION_END
- PRODUCT_VIEW, PRODUCT_CLICK
- CATEGORY_VIEW, STORE_VIEW
- SEARCH, SEARCH_RESULT_CLICK
- CART_VIEW, CART_ADD, CART_REMOVE
- CHECKOUT_START, PURCHASE
- WISHLIST_ADD, WISHLIST_REMOVE
- RECOMMENDATION_VIEW, RECOMMENDATION_CLICK
