package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.velnox.velshop.data.model.Product
import com.velnox.velshop.data.remote.VelShopApiClient
import com.velnox.velshop.data.repository.CartRepository
import com.velnox.velshop.data.repository.ProductRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.data.tracking.EventTracker
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    onBack: () -> Unit,
    onAddToCart: () -> Unit,
    onStoreClick: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }
    val cartRepo = remember { CartRepository() }

    var product by remember { mutableStateOf<Product?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var quantity by remember { mutableIntStateOf(1) }
    var isAddingToCart by remember { mutableStateOf(false) }
    var addedMessage by remember { mutableStateOf<String?>(null) }
    var snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(productId) {
        isLoading = true
        EventTracker.get().trackProductView(productId)

        when (val result = productRepo.getProduct(productId)) {
            is RepoResult.Success -> {
                product = result.data
                EventTracker.get().trackProductView(productId, result.data.sellerId)
            }
            is RepoResult.Error -> error = result.message
            is RepoResult.Loading -> {}
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(product?.name ?: "สินค้า") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "กลับ")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                        when (val result = productRepo.getProduct(productId)) {
                            is RepoResult.Success -> product = result.data
                            is RepoResult.Error -> error = result.message
                            is RepoResult.Loading -> {}
                        }
                        isLoading = false
                    }
                },
            )
            product != null -> {
                val p = product!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState()),
                ) {
                    // Product image
                    AsyncImage(
                        model = p.primaryImage,
                        contentDescription = p.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)),
                        contentScale = ContentScale.Crop,
                    )

                    Column(modifier = Modifier.padding(16.dp)) {
                        // Store name
                        if (!p.storeName.isNullOrBlank()) {
                            TextButton(
                                onClick = { onStoreClick(p.sellerId) },
                                contentPadding = PaddingValues(0.dp),
                            ) {
                                Icon(
                                    Icons.Filled.Store,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(p.storeName)
                            }
                        }

                        // Product name
                        Text(
                            text = p.name,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Price
                        Text(
                            text = p.priceFormatted,
                            style = MaterialTheme.typography.headlineLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )

                        // Stock info
                        Text(
                            text = if (p.isAvailable) "มีสินค้า ${p.availableStock} ชิ้น" else "สินค้าหมด",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (p.isAvailable)
                                MaterialTheme.colorScheme.onSurfaceVariant
                            else
                                MaterialTheme.colorScheme.error,
                        )

                        if (p.totalSold > 0) {
                            Text(
                                text = "ขายแล้ว ${p.totalSold} ชิ้น",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider()
                        Spacer(modifier = Modifier.height(16.dp))

                        // Description
                        Text(
                            text = "รายละเอียดสินค้า",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = p.description.ifBlank { "ไม่มีรายละเอียด" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Quantity selector
                        if (p.isAvailable) {
                            Text(
                                text = "จำนวน",
                                style = MaterialTheme.typography.titleSmall,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                IconButton(
                                    onClick = { if (quantity > 1) quantity-- },
                                    enabled = quantity > 1,
                                ) {
                                    Icon(Icons.Filled.Remove, "ลด")
                                }
                                Text(
                                    text = "$quantity",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                IconButton(
                                    onClick = { if (quantity < p.availableStock) quantity++ },
                                    enabled = quantity < p.availableStock,
                                ) {
                                    Icon(Icons.Filled.Add, "เพิ่ม")
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(32.dp))
                    }
                }

                // Bottom bar — add to cart
                if (p.isAvailable) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(padding),
                        shadowElevation = 8.dp,
                        color = MaterialTheme.colorScheme.background,
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        isAddingToCart = true
                                        when (val result = cartRepo.addItem(p._id, quantity = quantity)) {
                                            is RepoResult.Success -> {
                                                EventTracker.get().trackCartAdd(p._id, quantity)
                                                snackbarHostState.showSnackbar("เพิ่มลงตะกร้าแล้ว")
                                                onAddToCart()
                                            }
                                            is RepoResult.Error -> {
                                                snackbarHostState.showSnackbar(result.message)
                                            }
                                            is RepoResult.Loading -> {}
                                        }
                                        isAddingToCart = false
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                enabled = !isAddingToCart,
                            ) {
                                Icon(Icons.Filled.ShoppingCart, null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("เพิ่มลงตะกร้า")
                            }

                            Button(
                                onClick = {
                                    scope.launch {
                                        isAddingToCart = true
                                        when (val result = cartRepo.addItem(p._id, quantity = quantity)) {
                                            is RepoResult.Success -> {
                                                EventTracker.get().trackCartAdd(p._id, quantity)
                                                onAddToCart()
                                            }
                                            is RepoResult.Error -> {
                                                snackbarHostState.showSnackbar(result.message)
                                            }
                                            is RepoResult.Loading -> {}
                                        }
                                        isAddingToCart = false
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                enabled = !isAddingToCart,
                            ) {
                                Text("ซื้อเลย")
                            }
                        }
                    }
                }
            }
        }
    }
}
