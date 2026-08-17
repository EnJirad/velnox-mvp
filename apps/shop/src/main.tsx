import { Toaster } from "@velnox/shared/components/ui/sonner";
import { RequireAuth } from "@velnox/shared/components/RequireAuth";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { CartProvider } from "@/lib/cart";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@velnox/shared/lib/app-shell";
import { siteBasename } from "@velnox/shared/lib/sites";
import { initMonitoring } from "@velnox/shared/lib/monitoring";

initMonitoring();
import { MobileTabBar, type MobileTabItem } from "@velnox/shared/components/MobileTabBar";
import { IdentityMerge } from "@velnox/shared/lib/track";
import { useCart } from "@/lib/cart";
import { Home, Package, ReceiptText, ShoppingCart, User } from "lucide-react";
import { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "../../../packages/shared/src/index.css";

/**
 * VelShop mobile bottom navigation — app-like fixed tab bar (5 items).
 * Routes are the standalone VelShop paths; the bar is hidden on md+ where the
 * desktop header navigation takes over.
 */
function ShopTabBar() {
  const { count } = useCart();
  const { t } = useLanguage();
  const items: MobileTabItem[] = [
    { to: "/", label: t("nav.home"), icon: Home, activeMatch: (p) => p === "/" },
    { to: "/products", label: t("nav.products"), icon: Package },
    {
      to: "/cart",
      label: t("nav.cart"),
      icon: ShoppingCart,
      badge: count,
      activeMatch: (p) => p.startsWith("/cart") || p.startsWith("/checkout"),
    },
    { to: "/orders", label: t("nav.orders"), icon: ReceiptText },
    { to: "/profile", label: t("nav.profile"), icon: User },
  ];
  return <MobileTabBar items={items} />;
}

const ShopHome = lazy(() => import("@/pages/ShopHome"));
const ShopProducts = lazy(() => import("@/pages/ShopProducts"));
const ShopCategories = lazy(() => import("@/pages/ShopCategories"));
const ShopProductDetail = lazy(() => import("@/pages/ShopProductDetail"));
const ShopDetail = lazy(() => import("@/pages/ShopDetail"));
const ShopCart = lazy(() => import("@/pages/ShopCart"));
const ShopCheckout = lazy(() => import("@/pages/ShopCheckout"));
const MyOrders = lazy(() => import("@/pages/MyOrders"));
const ShopOrderDetail = lazy(() => import("@/pages/ShopOrderDetail"));
const ShopTracking = lazy(() => import("@/pages/ShopTracking"));
const VelRepeatPage = lazy(() => import("@/pages/VelRepeatPage"));
const ShopWishlist = lazy(() => import("@/pages/ShopWishlist"));
const ShopAddresses = lazy(() => import("@/pages/ShopAddresses"));
const ShopProfile = lazy(() => import("@/pages/ShopProfile"));
const ShopAccount = lazy(() => import("@/pages/ShopAccount"));
const ShopNotifications = lazy(() => import("@/pages/ShopNotifications"));
const AuthPage = lazy(() => import("@velnox/shared/pages/Auth"));
const NotFound = lazy(() => import("@velnox/shared/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <LanguageProvider>
      <ConvexAuthProvider client={convex}>
        <IdentityMerge />
        <BrowserRouter basename={siteBasename("velshop")}>
        <RouteSyncer />
        <CartProvider>
          <div className="site-app">
          <SiteSuspense>
            <Routes>
              <Route path="/" element={<ShopHome />} />
              <Route path="/products" element={<ShopProducts />} />
              <Route path="/categories" element={<ShopCategories />} />
              <Route path="/products/:productId" element={<ShopProductDetail />} />
              <Route path="/shops/:shopId" element={<ShopDetail />} />
              <Route path="/cart" element={<ShopCart />} />
              <Route
                path="/checkout"
                element={
                  <RequireAuth>
                    <ShopCheckout />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders"
                element={
                  <RequireAuth>
                    <MyOrders />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders/:orderId"
                element={
                  <RequireAuth>
                    <ShopOrderDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders/:orderId/tracking"
                element={
                  <RequireAuth>
                    <ShopTracking />
                  </RequireAuth>
                }
              />
              <Route
                path="/velrepeat"
                element={
                  <RequireAuth>
                    <VelRepeatPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/wishlist"
                element={
                  <RequireAuth>
                    <ShopWishlist />
                  </RequireAuth>
                }
              />
              <Route
                path="/addresses"
                element={
                  <RequireAuth>
                    <ShopAddresses />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ShopProfile />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile/account"
                element={
                  <RequireAuth>
                    <ShopAccount />
                  </RequireAuth>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RequireAuth>
                    <ShopNotifications />
                  </RequireAuth>
                }
              />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SiteSuspense>
          <ShopTabBar />
          </div>
        </CartProvider>
      </BrowserRouter>          <Toaster />
        </ConvexAuthProvider>
    </LanguageProvider>
  </RootErrorBoundary>,
);
