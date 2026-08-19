package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.velnox.velshop.data.model.Address
import com.velnox.velshop.data.repository.OrderRepository
import com.velnox.velshop.data.repository.RepoResult
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressesScreen(
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val orderRepo = remember { OrderRepository() }

    var addresses by remember { mutableStateOf<List<Address>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        when (val result = orderRepo.getAddresses()) {
            is RepoResult.Success -> addresses = result.data
            is RepoResult.Error -> error = result.message
            is RepoResult.Loading -> {}
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ที่อยู่จัดส่ง") },
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
                        when (val result = orderRepo.getAddresses()) {
                            is RepoResult.Success -> addresses = result.data
                            is RepoResult.Error -> error = result.message
                            is RepoResult.Loading -> {}
                        }
                        isLoading = false
                    }
                },
            )
            addresses.isEmpty() -> EmptyState(
                message = "ยังไม่มีที่อยู่จัดส่ง",
                modifier = Modifier.padding(padding),
                actionLabel = "เพิ่มที่อยู่",
                onAction = { /* TODO: open add address form */ },
            )
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(addresses, key = { it._id }) { address ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                            ),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        address.label,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.weight(1f),
                                    )
                                    if (address.isDefault) {
                                        AssistChip(
                                            onClick = {},
                                            label = { Text("ค่าเริ่มต้น") },
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("${address.name} ${address.phone}")
                                Text("${address.line1}")
                                if (address.district != null) Text(address.district!!)
                                Text("${address.province} ${address.postalCode}")
                            }
                        }
                    }
                }
            }
        }
    }
}
