package com.velnox.velshop.data.repository

import com.velnox.velshop.data.model.*
import com.velnox.velshop.data.remote.VelShopApiClient

class OrderRepository {

    suspend fun checkout(input: CheckoutInput): RepoResult<CheckoutResult> {
        return try {
            val resp = VelShopApiClient.api.checkout(input)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถดำเนินการสั่งซื้อได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun getOrders(limit: Int = 20, offset: Int = 0): RepoResult<List<Order>> {
        return try {
            val resp = VelShopApiClient.api.getOrders(limit = limit, offset = offset)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data.items)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถโหลดคำสั่งซื้อได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun getOrder(id: String): RepoResult<Order> {
        return try {
            val resp = VelShopApiClient.api.getOrder(id)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่พบคำสั่งซื้อ")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun cancelOrder(id: String): RepoResult<Order> {
        return try {
            val resp = VelShopApiClient.api.cancelOrder(id)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถยกเลิกได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    // ── Addresses ──────────────────────────────────────────────────────────

    suspend fun getAddresses(): RepoResult<List<Address>> {
        return try {
            val resp = VelShopApiClient.api.getAddresses()
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถโหลดที่อยู่ได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun createAddress(address: Address): RepoResult<Address> {
        return try {
            val resp = VelShopApiClient.api.createAddress(address)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถเพิ่มที่อยู่ได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }
}
