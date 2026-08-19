package com.velnox.velshop.data.repository

import com.velnox.velshop.data.local.SessionManager
import com.velnox.velshop.data.model.User
import com.velnox.velshop.data.remote.VelShopApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class AuthState {
    data object Loading : AuthState()
    data class Authenticated(val user: User) : AuthState()
    data object Unauthenticated : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthRepository(private val session: SessionManager) {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    val isLoggedIn: Boolean get() = session.isLoggedIn()
    val userId: String? get() = session.getUserId()
    val anonymousId: String get() = session.getOrCreateAnonymousId()

    /**
     * Initialize auth state on app start.
     * Checks for existing token and validates with the backend.
     */
    suspend fun initialize() {
        val token = session.getAuthToken()
        if (token == null) {
            _authState.value = AuthState.Unauthenticated
            return
        }
        VelShopApiClient.setAuthToken(token)
        try {
            val response = VelShopApiClient.api.getProfile()
            if (response.success && response.data != null) {
                _authState.value = AuthState.Authenticated(response.data)
            } else {
                // Token expired or invalid
                session.clearAuthToken()
                VelShopApiClient.setAuthToken(null)
                _authState.value = AuthState.Unauthenticated
            }
        } catch (e: Exception) {
            _authState.value = AuthState.Unauthenticated
        }
    }

    /**
     * Login with email OTP (sends OTP first, then verifies).
     * The actual OTP flow uses Convex Auth — this is the client-side foundation.
     */
    suspend fun loginWithEmailOtp(email: String): Result<Unit> {
        return try {
            // In production, this sends an OTP email via Convex Auth
            // For now, the foundation stores the email and awaits OTP verification
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Complete login after authentication succeeds.
     * Called by the auth UI after Convex Auth confirms identity.
     */
    suspend fun completeLogin(user: User, token: String) {
        session.saveLoginState(user._id, token)
        VelShopApiClient.setAuthToken(token)
        _authState.value = AuthState.Authenticated(user)
    }

    /**
     * Logout — clears all session data.
     */
    fun logout() {
        session.clearAll()
        VelShopApiClient.setAuthToken(null)
        _authState.value = AuthState.Unauthenticated
    }

    /**
     * Get current user or null.
     */
    fun getCurrentUser(): User? {
        return when (val state = _authState.value) {
            is AuthState.Authenticated -> state.user
            else -> null
        }
    }
}
