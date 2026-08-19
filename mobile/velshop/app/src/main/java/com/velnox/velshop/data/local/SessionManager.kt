package com.velnox.velshop.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.UUID

class SessionManager(context: Context) {

    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        "velshop_secure_prefs",
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val prefs: SharedPreferences =
        context.getSharedPreferences("velshop_prefs", Context.MODE_PRIVATE)

    // ── Auth token ────────────────────────────────────────────────────────

    fun saveAuthToken(token: String) {
        securePrefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun getAuthToken(): String? = securePrefs.getString(KEY_AUTH_TOKEN, null)

    fun clearAuthToken() {
        securePrefs.edit().remove(KEY_AUTH_TOKEN).apply()
    }

    // ── User ID ───────────────────────────────────────────────────────────

    fun saveUserId(userId: String) {
        securePrefs.edit().putString(KEY_USER_ID, userId).apply()
    }

    fun getUserId(): String? = securePrefs.getString(KEY_USER_ID, null)

    // ── Anonymous ID ──────────────────────────────────────────────────────

    fun getOrCreateAnonymousId(): String {
        var id = prefs.getString(KEY_ANONYMOUS_ID, null)
        if (id == null) {
            id = "anon_${UUID.randomUUID()}"
            prefs.edit().putString(KEY_ANONYMOUS_ID, id).apply()
        }
        return id
    }

    // ── Session ID ────────────────────────────────────────────────────────

    fun createSessionId(): String {
        val id = "sess_${UUID.randomUUID()}"
        prefs.edit().putString(KEY_SESSION_ID, id).apply()
        return id
    }

    fun getSessionId(): String? = prefs.getString(KEY_SESSION_ID, null)

    // ── Logged in state ───────────────────────────────────────────────────

    fun isLoggedIn(): Boolean = getAuthToken() != null && getUserId() != null

    fun saveLoginState(userId: String, token: String) {
        saveUserId(userId)
        saveAuthToken(token)
    }

    fun clearAll() {
        securePrefs.edit().clear().apply()
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_ANONYMOUS_ID = "anonymous_id"
        private const val KEY_SESSION_ID = "session_id"
    }
}
