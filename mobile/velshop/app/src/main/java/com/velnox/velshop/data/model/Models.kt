package com.velnox.velshop.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─── Auth / Users ────────────────────────────────────────────────────────────

@Serializable
data class User(
    val _id: String = "",
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val image: String? = null,
    val role: String? = null,
    val accountType: String? = null,
    val status: String? = null,
    val locale: String? = null,
)

// ─── Products ────────────────────────────────────────────────────────────────

@Serializable
data class Product(
    val _id: String = "",
    val sellerId: String = "",
    val categoryId: String? = null,
    val name: String = "",
    val slug: String = "",
    val description: String = "",
    val price: Double = 0.0,
    val stock: Int = 0,
    val reserved: Int = 0,
    val images: List<String> = emptyList(),
    val weight: Double? = null,
    val shippingInfo: String? = null,
    val status: String = "ACTIVE",
    val totalSold: Int = 0,
    val updatedAt: Long = 0L,
    // Joined fields (from seller/category)
    val storeName: String? = null,
    val categoryName: String? = null,
    val shopId: String? = null,
    val rating: Double? = null,
    val soldCount: Int? = null,
) {
    val availableStock: Int get() = stock - reserved
    val isAvailable: Boolean get() = status == "ACTIVE" && availableStock > 0
    val primaryImage: String? get() = images.firstOrNull()
    val priceFormatted: String get() = "฿${String.format("%.2f", price)}"
}

@Serializable
data class ProductVariant(
    val _id: String = "",
    val productId: String = "",
    val name: String = "",
    val price: Double? = null,
    val stock: Int = 0,
    val reserved: Int = 0,
) {
    val availableStock: Int get() = stock - reserved
    fun effectivePrice(productPrice: Double): Double = price ?: productPrice
}

// ─── Categories ──────────────────────────────────────────────────────────────

@Serializable
data class Category(
    val _id: String = "",
    val name: LocalizedText = LocalizedText(),
    val slug: String = "",
    val image: String? = null,
    val active: Boolean = true,
    val sortOrder: Int = 0,
)

@Serializable
data class LocalizedText(
    val th: String = "",
    val en: String = "",
    val my: String = "",
) {
    fun display(locale: String = "th"): String = when (locale) {
        "en" -> en.ifEmpty { th }
        "my" -> my.ifEmpty { th }
        else -> th.ifEmpty { en }
    }
}

// ─── Cart ────────────────────────────────────────────────────────────────────

@Serializable
data class CartItem(
    val _id: String = "",
    val userId: String? = null,
    val sessionId: String? = null,
    val productId: String = "",
    val variantId: String? = null,
    val quantity: Int = 0,
    val updatedAt: Long = 0L,
    // Joined
    val productName: String? = null,
    val productPrice: Double? = null,
    val productImage: String? = null,
    val storeName: String? = null,
    val shopId: String? = null,
    val sellerId: String? = null,
    val availableStock: Int? = null,
    val unit: String? = null,
)

@Serializable
data class CartSummary(
    val items: List<CartItem> = emptyList(),
    val itemCount: Int = 0,
    val subtotal: Double = 0.0,
    val currency: String = "THB",
)

// ─── Orders ──────────────────────────────────────────────────────────────────

@Serializable
data class Order(
    val _id: String = "",
    val userId: String = "",
    val orderNumber: String = "",
    val status: String = "PENDING",
    val currency: String = "THB",
    val itemsSubtotal: Double = 0.0,
    val shippingFee: Double = 0.0,
    val discount: Double = 0.0,
    val total: Double = 0.0,
    val paymentMethod: String = "cod",
    val shippingAddress: ShippingAddress? = null,
    val notes: String? = null,
    val paidAt: Long? = null,
    val deliveredAt: Long? = null,
    val cancelledAt: Long? = null,
    val createdAt: Long = 0L,
    // Joined
    val items: List<OrderItem> = emptyList(),
)

@Serializable
data class OrderItem(
    val _id: String = "",
    val orderId: String = "",
    val sellerId: String = "",
    val productId: String = "",
    val variantId: String? = null,
    val productName: String = "",
    val variantName: String? = null,
    val image: String? = null,
    val unitPrice: Double = 0.0,
    val quantity: Int = 0,
    val subtotal: Double = 0.0,
    val status: String = "PENDING",
)

// ─── Addresses ───────────────────────────────────────────────────────────────

@Serializable
data class Address(
    val _id: String = "",
    val userId: String = "",
    val label: String = "",
    val type: String = "shipping",
    val name: String = "",
    val phone: String = "",
    val line1: String = "",
    val line2: String? = null,
    val district: String? = null,
    val subdistrict: String? = null,
    val province: String = "",
    val postalCode: String = "",
    val country: String = "TH",
    val isDefault: Boolean = false,
)

@Serializable
data class ShippingAddress(
    val name: String = "",
    val phone: String = "",
    val line1: String = "",
    val province: String = "",
    val postalCode: String = "",
)

// ─── Wishlist ────────────────────────────────────────────────────────────────

@Serializable
data class WishlistItem(
    val _id: String = "",
    val userId: String = "",
    val productId: String = "",
)

// ─── Sellers / Shops ────────────────────────────────────────────────────────

@Serializable
data class Seller(
    val _id: String = "",
    val userId: String = "",
    val storeName: String = "",
    val storeSlug: String = "",
    val logo: String? = null,
    val banner: String? = null,
    val description: String? = null,
    val status: String = "PENDING",
)

@Serializable
data class Shop(
    val _id: String = "",
    val sellerId: String = "",
    val name: String = "",
    val slug: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
    val status: String = "active",
)

// ─── Events / Tracking ──────────────────────────────────────────────────────

@Serializable
data class BehavioralEvent(
    val eventType: String,
    val sessionId: String,
    val anonymousId: String? = null,
    val userId: String? = null,
    val productId: String? = null,
    val sellerId: String? = null,
    val categoryId: String? = null,
    val metadata: Map<String, String>? = null,
    val timestamp: Long,
)

// ─── Notifications ──────────────────────────────────────────────────────────

@Serializable
data class Notification(
    val _id: String = "",
    val userId: String = "",
    val type: String = "",
    val title: String = "",
    val body: String? = null,
    val link: String? = null,
    val read: Boolean = false,
    val _creationTime: Long = 0L,
)

// ─── Checkout ────────────────────────────────────────────────────────────────

@Serializable
data class CheckoutInput(
    val addressId: String,
    val paymentMethod: String = "cod",
    val shippingMethod: String = "standard",
    val note: String? = null,
)

@Serializable
data class CheckoutResult(
    val parentOrderId: String = "",
    val parentOrderNumber: String = "",
    val orders: List<CheckoutSubOrder> = emptyList(),
    val total: Double = 0.0,
    val itemCount: Int = 0,
)

@Serializable
data class CheckoutSubOrder(
    val orderId: String = "",
    val orderNumber: String = "",
    val shopId: String = "",
    val sellerId: String = "",
    val shopName: String = "",
    val subtotal: Double = 0.0,
    val shippingFee: Double = 0.0,
    val total: Double = 0.0,
)

// ─── API Response wrapper ───────────────────────────────────────────────────

@Serializable
data class ApiResponse<T>(
    val success: Boolean = true,
    val data: T? = null,
    val error: String? = null,
    val code: String? = null,
)

// ─── Search ──────────────────────────────────────────────────────────────────

@Serializable
data class SearchResults(
    val products: List<Product> = emptyList(),
    val totalCount: Int = 0,
    val query: String = "",
)

// ─── Pagination ─────────────────────────────────────────────────────────────

@Serializable
data class PaginatedResult<T>(
    val items: List<T> = emptyList(),
    val totalCount: Int = 0,
    val hasMore: Boolean = false,
    val cursor: String? = null,
)
