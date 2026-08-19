package com.velnox.velshop.data.repository

import com.velnox.velshop.data.model.*
import com.velnox.velshop.data.remote.VelShopApiClient

class CartRepository {

    suspend fun getCart(): RepoResult<CartSummary> {
        return try {
            val resp = VelShopApiClient.api.getCart()
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถโหลดตะกร้าได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun addItem(productId: String, variantId: String? = null, quantity: Int = 1): RepoResult<CartItem> {
        return try {
            val resp = VelShopApiClient.api.addToCart(
                AddToCartRequest(productId = productId, variantId = variantId, quantity = quantity)
            )
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถเพิ่มสินค้าได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun updateQuantity(itemId: String, quantity: Int): RepoResult<CartItem> {
        return try {
            val resp = VelShopApiClient.api.updateCartItem(
                itemId = itemId,
                body = UpdateCartRequest(quantity = quantity),
            )
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถอัปเดตได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun removeItem(itemId: String): RepoResult<Unit> {
        return try {
            val resp = VelShopApiClient.api.removeFromCart(itemId)
            if (resp.success) {
                RepoResult.Success(Unit)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถลบสินค้าได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }
}
