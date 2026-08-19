package com.velnox.velshop.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.velnox.velshop.ui.screens.*
import kotlinx.coroutines.launch

private data class BottomNavItem(
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
    val route: String,
)

private val bottomNavItems = listOf(
    BottomNavItem("หน้าหลัก", Icons.Outlined.Home, Icons.Filled.Home, Screen.Home.route),
    BottomNavItem("ค้นหา", Icons.Outlined.Search, Icons.Filled.Search, Screen.Search.createRoute()),
    BottomNavItem("ตะกร้า", Icons.Outlined.ShoppingCart, Icons.Filled.ShoppingCart, Screen.Cart.route),
    BottomNavItem("คำสั่งซื้อ", Icons.Outlined.Receipt, Icons.Filled.Receipt, Screen.Orders.route),
    BottomNavItem("ฉัน", Icons.Outlined.Person, Icons.Filled.Person, Screen.Profile.route),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VelShopNavHost() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val showBottomBar = currentDestination?.route in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    if (selected) item.selectedIcon else item.icon,
                                    contentDescription = item.label,
                                )
                            },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) },
        ) {
            composable(Screen.Splash.route) {
                SplashScreen(onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                })
            }

            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                )
            }

            composable(Screen.Home.route) {
                HomeScreen(
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onCategoryClick = { navController.navigate(Screen.Category.createRoute(it)) },
                    onStoreClick = { navController.navigate(Screen.Store.createRoute(it)) },
                    onSearchClick = { navController.navigate(Screen.Search.createRoute()) },
                    onCartClick = { navController.navigate(Screen.Cart.route) },
                )
            }

            composable(
                Screen.Search.route,
                arguments = listOf(navArgument("query") { type = NavType.StringType; defaultValue = "" }),
            ) { entry ->
                val query = entry.arguments?.getString("query") ?: ""
                SearchScreen(
                    initialQuery = query,
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                Screen.ProductDetail.route,
                arguments = listOf(navArgument("productId") { type = NavType.StringType }),
            ) { entry ->
                val productId = entry.arguments?.getString("productId") ?: ""
                ProductDetailScreen(
                    productId = productId,
                    onBack = { navController.popBackStack() },
                    onAddToCart = { navController.navigate(Screen.Cart.route) },
                    onStoreClick = { navController.navigate(Screen.Store.createRoute(it)) },
                )
            }

            composable(
                Screen.Category.route,
                arguments = listOf(navArgument("categoryId") { type = NavType.StringType }),
            ) { entry ->
                val categoryId = entry.arguments?.getString("categoryId") ?: ""
                CategoryScreen(
                    categoryId = categoryId,
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                Screen.Store.route,
                arguments = listOf(navArgument("sellerId") { type = NavType.StringType }),
            ) { entry ->
                val sellerId = entry.arguments?.getString("sellerId") ?: ""
                StoreScreen(
                    sellerId = sellerId,
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Cart.route) {
                CartScreen(
                    onCheckout = { navController.navigate(Screen.Checkout.route) },
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Checkout.route) {
                CheckoutScreen(
                    onOrderSuccess = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId)) {
                            popUpTo(Screen.Cart.route) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Orders.route) {
                OrdersScreen(
                    onOrderClick = { navController.navigate(Screen.OrderDetail.createRoute(it)) },
                )
            }

            composable(
                Screen.OrderDetail.route,
                arguments = listOf(navArgument("orderId") { type = NavType.StringType }),
            ) { entry ->
                val orderId = entry.arguments?.getString("orderId") ?: ""
                OrderDetailScreen(
                    orderId = orderId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    onNavigateToOrders = { navController.navigate(Screen.Orders.route) },
                    onNavigateToWishlist = { navController.navigate(Screen.Wishlist.route) },
                    onNavigateToAddresses = { navController.navigate(Screen.Addresses.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onLogin = { navController.navigate(Screen.Login.route) },
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen(onBack = { navController.popBackStack() })
            }

            composable(Screen.Addresses.route) {
                AddressesScreen(onBack = { navController.popBackStack() })
            }

            composable(Screen.Wishlist.route) {
                WishlistScreen(
                    onProductClick = { navController.navigate(Screen.ProductDetail.createRoute(it)) },
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
