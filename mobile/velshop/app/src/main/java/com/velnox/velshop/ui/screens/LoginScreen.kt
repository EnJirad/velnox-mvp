package com.velnox.velshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.velnox.velshop.data.local.SessionManager
import com.velnox.velshop.data.remote.VelShopApiClient
import com.velnox.velshop.data.repository.AuthRepository
import com.velnox.velshop.ui.components.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var step by remember { mutableIntStateOf(0) } // 0 = email, 1 = OTP
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("เข้าสู่ระบบ") })
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "VelShop",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "ยินดีต้อนรับ",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (step == 0) {
                // Email input
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("อีเมล") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                    ),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        if (email.isBlank()) {
                            scope.launch {
                                snackbarHostState.showSnackbar("กรุณากรอกอีเมล")
                            }
                            return@Button
                        }
                        isLoading = true
                        error = null
                        // In production, sends OTP via Convex Auth
                        step = 1
                        isLoading = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading,
                ) {
                    Text("ส่งรหัส OTP")
                }

                // Guest browse option
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = onLoginSuccess,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("เข้าชมโดยไม่เข้าสู่ระบบ")
                }
            } else {
                // OTP input
                Text(
                    "ส่งรหัสไปที่ $email",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = otp,
                    onValueChange = { otp = it },
                    label = { Text("รหัส OTP") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        isLoading = true
                        // In production, verifies OTP via Convex Auth
                        // For now, mark as authenticated
                        isLoading = false
                        onLoginSuccess()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading && otp.length >= 4,
                ) {
                    Text("ยืนยัน")
                }

                Spacer(modifier = Modifier.height(8.dp))
                TextButton(onClick = { step = 0 }) {
                    Text("เปลี่ยนอีเมล")
                }
            }

            if (error != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    error!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}
