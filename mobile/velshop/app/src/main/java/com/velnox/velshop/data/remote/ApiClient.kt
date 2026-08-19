package com.velnox.velshop.data.remote

import retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.velnox.velshop.BuildConfig
import com.velnox.velshop.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Retrofit
import retrofit2.http.*
import java.util.UUID
import java.util.concurrent.TimeUnit

// ─── Convex HTTP API service ─────────────────────────────────────────────────

interface VelShopApi {

    // ── Products ──────────────────────────────────────────────────────────
    @GET("/api/products")
    suspend fun getProducts(
        @Query("categoryId") categoryId: String? = null,
        @Query("search") search: String? = null,
        @Query("sellerId") sellerId: String? = null,
        @Query("status") status: String = "ACTIVE",
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): ApiResponse<PaginatedResult<Product>>

    @GET("/api/products/{id}")
    suspend fun getProduct(@Path("id") id: String): ApiResponse<Product>

    @GET("/api/products/{id}/variants")
    suspend fun getProductVariants(@Path("id") id: String): ApiResponse<List<ProductVariant>>

    // ── Categories ────────────────────────────────────────────────────────
    @GET("/api/categories")
    suspend fun getCategories(): ApiResponse<List<Category>>

    // ── Cart ──────────────────────────────────────────────────────────────
    @GET("/api/cart")
    suspend fun getCart(): ApiResponse<CartSummary>

    @POST("/api/cart/items")
    suspend fun addToCart(@Body body: AddToCartRequest): ApiResponse<CartItem>

    @PATCH("/api/cart/items/{itemId}")
    suspend fun updateCartItem(
        @Path("itemId") itemId: String,
        @Body body: UpdateCartRequest,
    ): ApiResponse<CartItem>

    @DELETE("/api/cart/items/{itemId}")
    suspend fun removeFromCart(@Path("itemId") itemId: String): ApiResponse<Unit>

    // ── Checkout ──────────────────────────────────────────────────────────
    @POST("/api/checkout")
    suspend fun checkout(@Body body: CheckoutInput): ApiResponse<CheckoutResult>

    // ── Orders ────────────────────────────────────────────────────────────
    @GET("/api/orders")
    suspend fun getOrders(
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): ApiResponse<PaginatedResult<Order>>

    @GET("/api/orders/{id}")
    suspend fun getOrder(@Path("id") id: String): ApiResponse<Order>

    @PATCH("/api/orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: String): ApiResponse<Order>

    // ── Addresses ─────────────────────────────────────────────────────────
    @GET("/api/addresses")
    suspend fun getAddresses(): ApiResponse<List<Address>>

    @POST("/api/addresses")
    suspend fun createAddress(@Body body: Address): ApiResponse<Address>

    @PATCH("/api/addresses/{id}")
    suspend fun updateAddress(
        @Path("id") id: String,
        @Body body: Address,
    ): ApiResponse<Address>

    @DELETE("/api/addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: String): ApiResponse<Unit>

    // ── Wishlist ──────────────────────────────────────────────────────────
    @GET("/api/wishlist")
    suspend fun getWishlist(): ApiResponse<List<WishlistItem>>

    @POST("/api/wishlist")
    suspend fun addToWishlist(@Body body: WishlistRequest): ApiResponse<WishlistItem>

    @DELETE("/api/wishlist/{productId}")
    suspend fun removeFromWishlist(@Path("productId") productId: String): ApiResponse<Unit>

    // ── User Profile ──────────────────────────────────────────────────────
    @GET("/api/user/profile")
    suspend fun getProfile(): ApiResponse<User>

    @PATCH("/api/user/profile")
    suspend fun updateProfile(@Body body: Map<String, String>): ApiResponse<User>

    // ── Notifications ─────────────────────────────────────────────────────
    @GET("/api/notifications")
    suspend fun getNotifications(
        @Query("limit") limit: Int = 20,
    ): ApiResponse<List<Notification>>

    // ── Search ────────────────────────────────────────────────────────────
    @GET("/api/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("categoryId") categoryId: String? = null,
        @Query("limit") limit: Int = 20,
    ): ApiResponse<SearchResults>

    // ── Events ────────────────────────────────────────────────────────────
    @POST("/api/events")
    suspend fun trackEvent(@Body event: BehavioralEvent): ApiResponse<Unit>

    @POST("/api/events/batch")
    suspend fun trackEvents(@Body events: List<BehavioralEvent>): ApiResponse<Unit>
}

// ─── Request bodies ──────────────────────────────────────────────────────────

@Serializable
data class AddToCartRequest(
    val productId: String,
    val variantId: String? = null,
    val quantity: Int = 1,
)

@Serializable
data class UpdateCartRequest(val quantity: Int)

@Serializable
data class WishlistRequest(val productId: String)

// ─── Singleton API client ───────────────────────────────────────────────────

object VelShopApiClient {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    private var authToken: String? = null

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(AuthInterceptor { authToken })
        .addInterceptor(RequestIdInterceptor())
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL.trimEnd('/') + "/")
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val api: VelShopApi = retrofit.create(VelShopApi::class.java)

    fun setAuthToken(token: String?) {
        authToken = token
    }

    fun getAuthToken(): String? = authToken
}

// ─── Auth interceptor ────────────────────────────────────────────────────────

class AuthInterceptor(private val tokenProvider: () -> String?) : okhttp3.Interceptor {
    override fun intercept(chain: okhttp3.Interceptor.Chain): okhttp3.Response {
        val request = chain.request().newBuilder().apply {
            tokenProvider()?.let { token ->
                addHeader("Authorization", "Bearer $token")
            }
            addHeader("Content-Type", "application/json")
            addHeader("Accept", "application/json")
        }.build()
        return chain.proceed(request)
    }
}

class RequestIdInterceptor : okhttp3.Interceptor {
    override fun intercept(chain: okhttp3.Interceptor.Chain): okhttp3.Response {
        val request = chain.request().newBuilder()
            .addHeader("X-Request-Id", UUID.randomUUID().toString())
            .build()
        return chain.proceed(request)
    }
}

// ─── Direct OkHttp for raw endpoints (Convex actions) ───────────────────────

object RawApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    suspend fun post(path: String, body: Map<String, Any?>): String =
        withContext(Dispatchers.IO) {
            val requestBody = json.encodeToString(
                kotlinx.serialization.serializer<Map<String, kotlinx.serialization.json.JsonElement>>(),
                body.mapValues { (_, v) -> json.parseToJsonElement(v.toString()) }
            )
            val request = Request.Builder()
                .url("${BuildConfig.API_BASE_URL}$path")
                .post(okhttp3.RequestBody.create(
                    "application/json".toMediaType(),
                    requestBody,
                ))
                .build()
            val response = client.newCall(request).execute()
            response.body?.string() ?: "{}"
        }
}
