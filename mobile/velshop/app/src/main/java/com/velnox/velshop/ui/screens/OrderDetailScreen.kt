package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.velnox.velshop.data.model.Order
import com.velnox.velshop.data.repository.OrderRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val orderRepo = remember { OrderRepository() }

    var order by remember { mutableStateOf<Order?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var isCancelling by remember { mutableStateOf(false) }
    var snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(orderId) {
        isLoading = true
        when (val result = orderRepo.getOrder(orderId)) {
            is RepoResult.Success -> order = result.data
            is RepoResult.Error -> error = result.message
            is RepoResult.Loading -> {}
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("รายละเอียดคำสั่งซื้อ") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "กลับ")
                    }
                },
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
                        when (val result = orderRepo.getOrder(orderId)) {
                            is RepoResult.Success -> order = result.data
                            is RepoResult.Error -> error = result.message
                            is RepoResult.Loading -> {}
                        }
                        isLoading = false
                    }
                },
            )
            order != null -> {
                val o = order!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                ) {
                    // Order number + status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(o.orderNumber, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        OrderStatusChip(status = o.status)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Shipping address
                    if (o.shippingAddress != null) {
                        Text("ที่อยู่จัดส่ง", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(o.shippingAddress!!.name)
                        Text(o.shippingAddress!!.phone)
                        Text("${o.shippingAddress!!.line1}, ${o.shippingAddress!!.province} ${o.shippingAddress!!.postalCode}")
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Items
                    Text("สินค้าในคำสั่งซื้อ", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(8.dp))

                    o.items.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                        ) {
                            AsyncImage(
                                model = item.image,
                                contentDescription = item.productName,
                                modifier = Modifier.size(48.dp),
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.productName, style = MaterialTheme.typography.bodyMedium)
                                Text("x${item.quantity}", style = MaterialTheme.typography.bodySmall)
                            }
                            PriceText(price = item.subtotal, style = MaterialTheme.typography.bodyMedium)
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    // Summary
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("ค่าสินค้า")
                        PriceText(price = o.itemsSubtotal, style = MaterialTheme.typography.bodyMedium)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("ค่าจัดส่ง")
                        PriceText(price = o.shippingFee, style = MaterialTheme.typography.bodyMedium)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("รวมทั้งหมด", fontWeight = FontWeight.Bold)
                        PriceText(price = o.total, style = MaterialTheme.typography.titleMedium)
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Cancel button (only for pending orders)
                    if (o.status == "PENDING" || o.status == "CONFIRMED") {
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    isCancelling = true
                                    when (val result = orderRepo.cancelOrder(orderId)) {
                                        is RepoResult.Success -> {
                                            order = result.data
                                            snackbarHostState.showSnackbar("ยกเลิกคำสั่งซื้อแล้ว")
                                        }
                                        is RepoResult.Error -> snackbarHostState.showSnackbar(result.message)
                                        is RepoResult.Loading -> {}
                                    }
                                    isCancelling = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isCancelling,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error,
                            ),
                        ) {
                            Text("ยกเลิกคำสั่งซื้อ")
                        }
                    }
                }
            }
        }
    }
}
