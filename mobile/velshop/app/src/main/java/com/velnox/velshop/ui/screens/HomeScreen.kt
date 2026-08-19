package com.velnox.velshop.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.velnox.velshop.data.model.Category
import com.velnox.velshop.data.model.Product
import com.velnox.velshop.data.remote.VelShopApiClient
import com.velnox.velshop.data.repository.ProductRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.data.tracking.EventTracker
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onProductClick: (String) -> Unit,
    onCategoryClick: (String) -> Unit,
    onStoreClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onCartClick: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }

    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var categories by remember { mutableStateOf<List<Category>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        EventTracker.get().trackAppOpen()
        EventTracker.get().trackSessionStart()

        isLoading = true
        error = null

        val productsResult = productRepo.getProducts(limit = 20)
        val categoriesResult = productRepo.getCategories()

        products = when (productsResult) {
            is RepoResult.Success -> productsResult.data
            is RepoResult.Error -> { error = productsResult.message; emptyList() }
            is RepoResult.Loading -> emptyList()
        }
        categories = when (categoriesResult) {
            is RepoResult.Success -> categoriesResult.data
            is RepoResult.Error -> emptyList()
            is RepoResult.Loading -> emptyList()
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "VelShop",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                actions = {
                    IconButton(onClick = onCartClick) {
                        Icon(Icons.Filled.ShoppingCart, "ตะกร้า")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        if (isLoading) {
            LoadingState(modifier = Modifier.padding(padding))
        } else if (error != null) {
            ErrorState(
                message = error!!,
                modifier = Modifier.padding(padding),
                onRetry = {
                    scope.launch {
                        isLoading = true
                        error = null
                        val result = productRepo.getProducts(limit = 20)
                        products = when (result) {
                            is RepoResult.Success -> result.data
                            is RepoResult.Error -> { error = result.message; emptyList() }
                            is RepoResult.Loading -> emptyList()
                        }
                        isLoading = false
                    }
                },
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                // Search bar
                item {
                    SearchBar(
                        onClick = onSearchClick,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }

                // Categories
                if (categories.isNotEmpty()) {
                    item {
                        SectionHeader(title = "หมวดหมู่")
                    }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(categories, key = { it._id }) { category ->
                                CategoryChip(
                                    category = category,
                                    onClick = { onCategoryClick(category._id) },
                                )
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(8.dp)) }
                }

                // Popular products header
                item {
                    SectionHeader(title = "สินค้าแนะนำ")
                }

                // Product grid
                item {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 5000.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        userScrollEnabled = false,
                    ) {
                        items(products, key = { it._id }) { product ->
                            ProductCard(
                                product = product,
                                onClick = {
                                    EventTracker.get().trackProductClick(product._id, product.sellerId)
                                    onProductClick(product._id)
                                },
                            )
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

// ─── Search Bar placeholder ──────────────────────────────────────────────────

@Composable
private fun SearchBar(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.Search,
                contentDescription = "ค้นหา",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                "ค้นหาสินค้า...",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// ─── Category chip ───────────────────────────────────────────────────────────

@Composable
private fun CategoryChip(
    category: Category,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (category.image != null) {
                AsyncImage(
                    model = category.image,
                    contentDescription = category.name.display(),
                    modifier = Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(6.dp)),
                    contentScale = ContentScale.Crop,
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = category.name.display(),
                style = MaterialTheme.typography.labelLarge,
            )
        }
    }
}
