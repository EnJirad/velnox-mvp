package com.velnox.velshop.data.tracking

import android.os.Build
import com.velnox.velshop.VelShopApp
import com.velnox.velshop.data.local.SessionManager
import com.velnox.velshop.data.model.BehavioralEvent
import com.velnox.velshop.data.remote.VelShopApiClient
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * VelShop Event Tracker — sends behavioral events to the Velnox Brain system.
 *
 * Design principles:
 * - NEVER blocks the shopping UI
 * - Queues events when offline
 * - Retries safely without duplicate submissions
 * - Batched to reduce network overhead
 * - Failure here must never become a commerce failure
 */
class EventTracker(
    private val session: SessionManager,
    private val scope: CoroutineScope,
) {

    private val eventQueue = ConcurrentLinkedQueue<BehavioralEvent>()
    private val sentEventIds = mutableSetOf<String>() // dedup guard
    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    private val appVersion: String
        get() = try {
            VelShopApp.instance.packageManager
                .getPackageInfo(VelShopApp.instance.packageName, 0).versionName ?: "unknown"
        } catch (_: Exception) { "unknown" }

    private val platform: String
        get() = "android_${Build.VERSION.SDK_INT}"

    private val sessionId: String
        get() = session.getSessionId() ?: session.createSessionId()

    private val userId: String?
        get() = session.getUserId()

    private val anonymousId: String
        get() = session.getOrCreateAnonymousId()

    // ─── Public API ───────────────────────────────────────────────────────

    /**
     * Track a single event. Non-blocking — queues for async delivery.
     */
    fun track(
        eventType: String,
        productId: String? = null,
        sellerId: String? = null,
        categoryId: String? = null,
        metadata: Map<String, String>? = null,
        value: String? = null,
    ) {
        val eventId = "${eventType}_${System.currentTimeMillis()}_${anonymousId}"
        if (eventId in sentEventIds) return // duplicate guard
        sentEventIds.add(eventId)

        val event = BehavioralEvent(
            eventType = eventType,
            sessionId = sessionId,
            anonymousId = anonymousId,
            userId = userId,
            productId = productId,
            sellerId = sellerId,
            categoryId = categoryId,
            metadata = metadata?.plus(mapOf(
                "platform" to platform,
                "appVersion" to appVersion,
                "value" to (value ?: ""),
            )),
            timestamp = System.currentTimeMillis(),
        )

        eventQueue.add(event)
        scheduleFlush()
    }

    // ─── Convenience methods for common events ────────────────────────────

    fun trackAppOpen() = track("APP_OPEN")
    fun trackSessionStart() = track("SESSION_START")
    fun trackSessionEnd() = track("SESSION_END")

    fun trackProductView(productId: String, sellerId: String? = null) =
        track("PRODUCT_VIEW", productId = productId, sellerId = sellerId)

    fun trackProductClick(productId: String, sellerId: String? = null) =
        track("PRODUCT_CLICK", productId = productId, sellerId = sellerId)

    fun trackCategoryView(categoryId: String) =
        track("CATEGORY_VIEW", categoryId = categoryId)

    fun trackStoreView(sellerId: String) =
        track("STORE_VIEW", sellerId = sellerId)

    fun trackSearch(query: String) =
        track("SEARCH", metadata = mapOf("query" to query), value = query)

    fun trackSearchResultClick(query: String, productId: String) =
        track("SEARCH_RESULT_CLICK", productId = productId, metadata = mapOf("query" to query))

    fun trackCartView() = track("CART_VIEW")

    fun trackCartAdd(productId: String, quantity: Int) =
        track("CART_ADD", productId = productId, value = quantity.toString(),
            metadata = mapOf("quantity" to quantity.toString()))

    fun trackCartRemove(productId: String) =
        track("CART_REMOVE", productId = productId)

    fun trackCheckoutStart() = track("CHECKOUT_START")
    fun trackPurchase(orderId: String) =
        track("PURCHASE", metadata = mapOf("orderId" to orderId))

    fun trackWishlistAdd(productId: String) =
        track("WISHLIST_ADD", productId = productId)

    fun trackWishlistRemove(productId: String) =
        track("WISHLIST_REMOVE", productId = productId)

    fun trackRecommendationView(productId: String) =
        track("RECOMMENDATION_VIEW", productId = productId)

    fun trackRecommendationClick(productId: String) =
        track("RECOMMENDATION_CLICK", productId = productId)

    // ─── Flush logic ──────────────────────────────────────────────────────

    private var flushJob: Job? = null

    private fun scheduleFlush() {
        if (flushJob?.isActive == true) return
        flushJob = scope.launch {
            delay(FLUSH_INTERVAL_MS)
            flush()
        }
    }

    private suspend fun flush() {
        if (eventQueue.isEmpty()) return
        val batch = mutableListOf<BehavioralEvent>()
        while (eventQueue.isNotEmpty() && batch.size < BATCH_SIZE) {
            eventQueue.poll()?.let { batch.add(it) }
        }
        if (batch.isEmpty()) return

        try {
            VelShopApiClient.api.trackEvents(batch)
        } catch (e: Exception) {
            // Re-queue on failure (but cap to prevent unbounded growth)
            if (eventQueue.size < MAX_QUEUE_SIZE) {
                batch.forEach { eventQueue.add(it) }
            }
            // Remove dedup IDs so they can be retried
            batch.forEach { sentEventIds.remove(it.eventType) }
        }
    }

    /**
     * Flush on app background / session end.
     */
    suspend fun flushNow() {
        while (eventQueue.isNotEmpty()) {
            flush()
        }
    }

    companion object {
        private const val FLUSH_INTERVAL_MS = 5_000L // 5 seconds
        private const val BATCH_SIZE = 20
        private const val MAX_QUEUE_SIZE = 200

        @Volatile
        private var instance: EventTracker? = null

        fun initialize(session: SessionManager, scope: CoroutineScope): EventTracker {
            return EventTracker(session, scope).also { instance = it }
        }

        fun get(): EventTracker = instance
            ?: throw IllegalStateException("EventTracker not initialized. Call initialize() first.")
    }
}
