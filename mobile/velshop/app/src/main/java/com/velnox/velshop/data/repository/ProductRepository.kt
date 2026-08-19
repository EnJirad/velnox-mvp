package com.velnox.velshop.data.repository

import com.velnox.velshop.data.model.Category
import com.velnox.velshop.data.model.Product
import com.velnox.velshop.data.remote.VelShopApiClient

sealed class RepoResult<out T> {
    data class Success<T>(val data: T) : RepoResult<T>()
    data class Error(val message: String, val code: String? = null) : RepoResult<Nothing>()
    data object Loading : RepoResult<Nothing>()
}

class ProductRepository {

    suspend fun getProducts(
        categoryId: String? = null,
        search: String? = null,
        sellerId: String? = null,
        limit: Int = 20,
        offset: Int = 0,
    ): RepoResult<List<Product>> {
        return try {
            val resp = VelShopApiClient.api.getProducts(
                categoryId = categoryId,
                search = search,
                sellerId = sellerId,
                limit = limit,
                offset = offset,
            )
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data.items)
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถโหลดสินค้าได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun getProduct(id: String): RepoResult<Product> {
        return try {
            val resp = VelShopApiClient.api.getProduct(id)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data)
            } else {
                RepoResult.Error(resp.error ?: "ไม่พบสินค้า")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun getCategories(): RepoResult<List<Category>> {
        return try {
            val resp = VelShopApiClient.api.getCategories()
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data.filter { it.active })
            } else {
                RepoResult.Error(resp.error ?: "ไม่สามารถโหลดหมวดหมู่ได้")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }

    suspend fun search(query: String, categoryId: String? = null): RepoResult<List<Product>> {
        return try {
            val resp = VelShopApiClient.api.search(query = query, categoryId = categoryId)
            if (resp.success && resp.data != null) {
                RepoResult.Success(resp.data.products)
            } else {
                RepoResult.Error(resp.error ?: "ไม่พบผลลัพธ์")
            }
        } catch (e: Exception) {
            RepoResult.Error(e.localizedMessage ?: "เกิดข้อผิดพลาด")
        }
    }
}
