package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.velnox.velshop.data.model.Product
import com.velnox.velshop.data.remote.VelShopApiClient
import com.velnox.velshop.data.repository.ProductRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistScreen(
    onProductClick: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var wishlistProducts by remember { mutableStateOf<List<Product>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val wishlistResp = VelShopApiClient.api.getWishlist()
            if (wishlistResp.success && wishlistResp.data != null) {
                // Fetch each product
                val productRepo = ProductRepository()
                val products = wishlistResp.data.mapNotNull { item ->
                    when (val result = productRepo.getProduct(item.productId)) {
                        is RepoResult.Success -> result.data
                        else -> null
                    }
                }
                wishlistProducts = products
            }
        } catch (e: Exception) {
            error = e.localizedMessage ?: "เกิดข้อผิดพลาด"
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("รายการโปรด") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "กลับ")
                    }
                },
            )
        },
    ) { padding ->
        when {
            isLoading -> LoadingState(modifier = Modifier.padding(padding))
            error != null -> ErrorState(
                message = error!!,
                modifier = Modifier.padding(padding),
                onRetry = {
                    scope.launch {
                        isLoading = true
                        error = null
                        try {
                            val wishlistResp = VelShopApiClient.api.getWishlist()
                            if (wishlistResp.success && wishlistResp.data != null) {
                                val productRepo = ProductRepository()
                                wishlistProducts = wishlistResp.data.mapNotNull { item ->
                                    when (val result = productRepo.getProduct(item.productId)) {
                                        is RepoResult.Success -> result.data
                                        else -> null
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            error = e.localizedMessage
                        }
                        isLoading = false
                    }
                },
            )
            wishlistProducts.isEmpty() -> EmptyState(
                message = "ยังไม่มีรายการโปรด",
                modifier = Modifier.padding(padding),
            )
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(wishlistProducts, key = { it._id }) { product ->
                    ProductCard(
                        product = product,
                        onClick = { onProductClick(product._id) },
                    )
                }
            }
        }
    }
}
