package com.velnox.velshop.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.velnox.velshop.data.model.Order
import com.velnox.velshop.data.repository.OrderRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onOrderClick: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val orderRepo = remember { OrderRepository() }

    var orders by remember { mutableStateOf<List<Order>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        when (val result = orderRepo.getOrders()) {
            is RepoResult.Success -> orders = result.data
            is RepoResult.Error -> error = result.message
            is RepoResult.Loading -> {}
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("คำสั่งซื้อของฉัน") })
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
                        when (val result = orderRepo.getOrders()) {
                            is RepoResult.Success -> orders = result.data
                            is RepoResult.Error -> error = result.message
                            is RepoResult.Loading -> {}
                        }
                        isLoading = false
                    }
                },
            )
            orders.isEmpty() -> EmptyState(
                message = "ยังไม่มีคำสั่งซื้อ",
                modifier = Modifier.padding(padding),
            )
            else -> LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(orders, key = { it._id }) { order ->
                    OrderCard(order = order, onClick = { onOrderClick(order._id) })
                }
            }
        }
    }
}

@Composable
private fun OrderCard(order: Order, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    order.orderNumber,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                OrderStatusChip(status = order.status)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "${order.items.size} ชิ้น",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            PriceText(
                price = order.total,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun OrderStatusChip(status: String) {
    val (label, color) = when (status) {
        "PENDING" -> "รอยืนยัน" to MaterialTheme.colorScheme.tertiary
        "CONFIRMED" -> "ยืนยันแล้ว" to MaterialTheme.colorScheme.secondary
        "PROCESSING" -> "กำลังเตรียม" to MaterialTheme.colorScheme.secondary
        "SHIPPED" -> "จัดส่งแล้ว" to MaterialTheme.colorScheme.primary
        "DELIVERED" -> "ได้รับแล้ว" to MaterialTheme.colorScheme.primary
        "COMPLETED" -> "เสร็จสิ้น" to MaterialTheme.colorScheme.primary
        "CANCELLED" -> "ยกเลิก" to MaterialTheme.colorScheme.error
        else -> status to MaterialTheme.colorScheme.onSurfaceVariant
    }
    AssistChip(
        onClick = {},
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
        colors = AssistChipDefaults.assistChipColors(containerColor = color.copy(alpha = 0.15f)),
    )
}
