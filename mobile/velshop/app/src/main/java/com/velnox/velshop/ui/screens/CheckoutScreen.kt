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
import com.velnox.velshop.data.model.Address
import com.velnox.velshop.data.model.CartSummary
import com.velnox.velshop.data.model.CheckoutInput
import com.velnox.velshop.data.repository.CartRepository
import com.velnox.velshop.data.repository.OrderRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.data.tracking.EventTracker
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    onOrderSuccess: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val cartRepo = remember { CartRepository() }
    val orderRepo = remember { OrderRepository() }

    var cart by remember { mutableStateOf<CartSummary?>(null) }
    var addresses by remember { mutableStateOf<List<Address>>(emptyList()) }
    var selectedAddress by remember { mutableStateOf<Address?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        EventTracker.get().trackCheckoutStart()
        isLoading = true
        val cartResult = cartRepo.getCart()
        val addressResult = orderRepo.getAddresses()
        cart = (cartResult as? RepoResult.Success)?.data
        addresses = (addressResult as? RepoResult.Success)?.data ?: emptyList()
        selectedAddress = addresses.firstOrNull { it.isDefault } ?: addresses.firstOrNull()
        isLoading = false
        if (cart == null) error = "ไม่สามารถโหลดตะกร้าได้"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ชำระเงิน") },
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
                onRetry = { onBack() },
            )
            cart != null -> {
                val c = cart!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState()),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Shipping address section
                        Text(
                            "ที่อยู่จัดส่ง",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        if (selectedAddress != null) {
                            val addr = selectedAddress!!
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface,
                                ),
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(addr.label, fontWeight = FontWeight.Bold)
                                    Text("${addr.name} ${addr.phone}")
                                    Text("${addr.line1}, ${addr.province} ${addr.postalCode}")
                                }
                            }
                        } else {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.errorContainer,
                                ),
                            ) {
                                Text(
                                    "กรุณาเพิ่มที่อยู่จัดส่ง",
                                    modifier = Modifier.padding(12.dp),
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Order summary
                        Text(
                            "สรุปคำสั่งซื้อ",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        c.items.forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    "${item.productName ?: "สินค้า"} x${item.quantity}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f),
                                )
                                PriceText(
                                    price = (item.productPrice ?: 0.0) * item.quantity,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text("รวมทั้งหมด", fontWeight = FontWeight.Bold)
                            PriceText(price = c.subtotal, style = MaterialTheme.typography.titleMedium)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Payment method
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "วิธีชำระเงิน",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                            ),
                        ) {
                            Text(
                                "ชำระเงินปลายทาง (COD)",
                                modifier = Modifier.padding(12.dp),
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Place order button
                    Button(
                        onClick = {
                            if (selectedAddress == null) {
                                scope.launch {
                                    snackbarHostState.showSnackbar("กรุณาเลือกที่อยู่จัดส่ง")
                                }
                                return@Button
                            }
                            scope.launch {
                                isSubmitting = true
                                val result = orderRepo.checkout(
                                    CheckoutInput(
                                        addressId = selectedAddress!!._id,
                                        paymentMethod = "cod",
                                    )
                                )
                                when (result) {
                                    is RepoResult.Success -> {
                                        EventTracker.get().trackPurchase(result.data.parentOrderId)
                                        onOrderSuccess(result.data.parentOrderId)
                                    }
                                    is RepoResult.Error -> {
                                        snackbarHostState.showSnackbar(result.message)
                                    }
                                    is RepoResult.Loading -> {}
                                }
                                isSubmitting = false
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        enabled = !isSubmitting && selectedAddress != null,
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        } else {
                            Text("สั่งซื้อ")
                        }
                    }

                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }
}
