package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.velnox.velshop.data.model.CartItem
import com.velnox.velshop.data.model.CartSummary
import com.velnox.velshop.data.repository.CartRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.data.tracking.EventTracker
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    onCheckout: () -> Unit,
    onProductClick: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val cartRepo = remember { CartRepository() }

    var cart by remember { mutableStateOf<CartSummary?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        EventTracker.get().trackCartView()
        isLoading = true
        when (val result = cartRepo.getCart()) {
            is RepoResult.Success -> cart = result.data
            is RepoResult.Error -> error = result.message
            is RepoResult.Loading -> {}
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ตะกร้าสินค้า") },
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
                        when (val result = cartRepo.getCart()) {
                            is RepoResult.Success -> cart = result.data
                            is RepoResult.Error -> error = result.message
                            is RepoResult.Loading -> {}
                        }
                        isLoading = false
                    }
                },
            )
            cart == null || cart!!.items.isEmpty() -> EmptyState(
                message = "ตะกร้าว่างเปล่า",
                modifier = Modifier.padding(padding),
                actionLabel = "เลือกซื้อสินค้า",
                onAction = onBack,
            )
            else -> {
                val c = cart!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                ) {
                    // Cart items list
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(c.items, key = { it._id }) { item ->
                            CartItemRow(
                                item = item,
                                onQuantityChange = { newQty ->
                                    scope.launch {
                                        if (newQty <= 0) {
                                            cartRepo.removeItem(item._id)
                                            EventTracker.get().trackCartRemove(item.productId)
                                        } else {
                                            cartRepo.updateQuantity(item._id, newQty)
                                        }
                                        // Refresh cart
                                        when (val result = cartRepo.getCart()) {
                                            is RepoResult.Success -> cart = result.data
                                            else -> {}
                                        }
                                    }
                                },
                                onClick = { onProductClick(item.productId) },
                            )
                        }
                    }

                    // Bottom summary
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shadowElevation = 8.dp,
                        color = MaterialTheme.colorScheme.background,
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    "สินค้า ${c.itemCount} ชิ้น",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Text(
                                    c.currency,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    "รวมทั้งหมด",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                PriceText(
                                    price = c.subtotal,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = onCheckout,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("ดำเนินการสั่งซื้อ")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CartItemRow(
    item: CartItem,
    onQuantityChange: (Int) -> Unit,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AsyncImage(
                model = item.productImage,
                contentDescription = item.productName,
                modifier = Modifier
                    .size(64.dp)
                    .then(Modifier),
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.productName ?: "สินค้า",
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 2,
                )
                if (item.storeName != null) {
                    Text(
                        text = item.storeName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                PriceText(
                    price = (item.productPrice ?: 0.0) * item.quantity,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { onQuantityChange(item.quantity - 1) }) {
                        Icon(Icons.Filled.Remove, "ลด", modifier = Modifier.size(16.dp))
                    }
                    Text("${item.quantity}", fontWeight = FontWeight.Bold)
                    IconButton(onClick = { onQuantityChange(item.quantity + 1) }) {
                        Icon(Icons.Filled.Add, "เพิ่ม", modifier = Modifier.size(16.dp))
                    }
                }
                IconButton(onClick = { onQuantityChange(0) }) {
                    Icon(
                        Icons.Filled.Delete,
                        "ลบ",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
