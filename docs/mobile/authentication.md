# VelShop Mobile — Authentication

## Overview

VelShop Mobile uses Convex Auth (email OTP) for authentication.
The mobile app is a client — it does NOT implement its own auth backend.

## Flow

```
1. User enters email
2. → POST /api/auth/send-otp (Convex Auth)
3. → OTP sent to email
4. User enters OTP
5. → POST /api/auth/verify-otp (Convex Auth)
6. → JWT token returned
7. Token stored in EncryptedSharedPreferences
8. All API requests include Bearer token
```

## Token Storage

- **EncryptedSharedPreferences** with AES-256-GCM
- Master key managed by Android Keystore
- Tokens never leave encrypted storage
- No tokens in logs, debug output, or network

## Session Management

- Anonymous users get a persistent anonymous ID (`anon_<uuid>`)
- Session ID created per app session (`sess_<uuid>`)
- Guest cart supported via session ID
- Cart merged on sign-in

## Implementation

```kotlin
// AuthRepository.kt
class AuthRepository(private val session: SessionManager) {
    suspend fun initialize() {
        val token = session.getAuthToken()
        if (token != null) {
            // Validate token with backend
            val response = VelShopApiClient.api.getProfile()
            if (response.success) {
                _authState.value = AuthState.Authenticated(response.data!!)
            } else {
                session.clearAuthToken()
                _authState.value = AuthState.Unauthenticated
            }
        }
    }

    suspend fun completeLogin(user: User, token: String) {
        session.saveLoginState(user._id, token)
        VelShopApiClient.setAuthToken(token)
        _authState.value = AuthState.Authenticated(user)
    }

    fun logout() {
        session.clearAll()
        VelShopApiClient.setAuthToken(null)
        _authState.value = AuthState.Unauthenticated
    }
}
```

## Security

- API secret keys NEVER in mobile app
- Convex deployment secrets NEVER in mobile app
- Stripe secret keys NEVER in mobile app
- All secrets remain on the server
