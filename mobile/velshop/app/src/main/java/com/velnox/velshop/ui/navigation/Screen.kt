package com.velnox.velshop.ui.navigation

sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    data object Home : Screen("home")
    data object Search : Screen("search?q={query}") {
        fun createRoute(query: String = "") = "search?q=$query"
    }
    data object ProductDetail : Screen("product/{productId}") {
        fun createRoute(productId: String) = "product/$productId"
    }
    data object Category : Screen("category/{categoryId}") {
        fun createRoute(categoryId: String) = "category/$categoryId"
    }
    data object Store : Screen("store/{sellerId}") {
        fun createRoute(sellerId: String) = "store/$sellerId"
    }
    data object Cart : Screen("cart")
    data object Checkout : Screen("checkout")
    data object Orders : Screen("orders")
    data object OrderDetail : Screen("orders/{orderId}") {
        fun createRoute(orderId: String) = "orders/$orderId"
    }
    data object Profile : Screen("profile")
    data object Settings : Screen("settings")
    data object Addresses : Screen("addresses")
    data object Wishlist : Screen("wishlist")
}
