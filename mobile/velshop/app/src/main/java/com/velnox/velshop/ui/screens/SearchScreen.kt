package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.velnox.velshop.data.model.Product
import com.velnox.velshop.data.repository.ProductRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.data.tracking.EventTracker
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    initialQuery: String = "",
    onProductClick: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }
    var query by remember { mutableStateOf(initialQuery) }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var hasSearched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun performSearch(q: String) {
        if (q.isBlank()) return
        isLoading = true
        error = null
        hasSearched = true
        EventTracker.get().trackSearch(q)
        scope.launch {
            when (val result = productRepo.search(q)) {
                is RepoResult.Success -> {
                    products = result.data
                    result.data.forEach { product ->
                        EventTracker.get().trackSearchResultClick(q, product._id)
                    }
                }
                is RepoResult.Error -> {
                    error = result.message
                    products = emptyList()
                }
                is RepoResult.Loading -> {}
            }
            isLoading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text("ค้นหาสินค้า...") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                        ),
                        trailingIcon = {
                            if (query.isNotEmpty()) {
                                IconButton(onClick = { query = "" }) {
                                    Icon(Icons.Filled.Clear, "ล้าง")
                                }
                            }
                        },
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "กลับ")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { performSearch(query) },
                        enabled = query.isNotBlank(),
                    ) {
                        Icon(Icons.Filled.Search, "ค้นหา")
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
                onRetry = { performSearch(query) },
            )
            !hasSearched -> EmptyState(
                message = "พิมพ์เพื่อค้นหาสินค้า",
                modifier = Modifier.padding(padding),
            )
            products.isEmpty() -> EmptyState(
                message = "ไม่พบสินค้าที่ค้นหา",
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
                items(products, key = { it._id }) { product ->
                    ProductCard(
                        product = product,
                        onClick = {
                            EventTracker.get().trackSearchResultClick(query, product._id)
                            onProductClick(product._id)
                        },
                    )
                }
            }
        }
    }
}
