import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { CartProvider } from "@/lib/cart";
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@/lib/app-shell";
import { siteBasename } from "@/lib/sites";
import { initMonitoring } from "@/lib/monitoring";

initMonitoring();
import { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "../../index.css";

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
const ShopNotifications = lazy(() => import("@/pages/ShopNotifications"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter basename={siteBasename("velshop")}>
        <RouteSyncer />
        <CartProvider>
          <SiteSuspense>
            <Routes>
              <Route path="/" element={<Navigate to="/shop" replace />} />
              <Route path="/shop" element={<ShopHome />} />
              <Route path="/shop/products" element={<ShopProducts />} />
              <Route path="/shop/categories" element={<ShopCategories />} />
              <Route path="/shop/products/:productId" element={<ShopProductDetail />} />
              <Route path="/shop/shops/:shopId" element={<ShopDetail />} />
              <Route path="/shop/cart" element={<ShopCart />} />
              <Route
                path="/shop/checkout"
                element={
                  <RequireAuth>
                    <ShopCheckout />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/orders"
                element={
                  <RequireAuth>
                    <MyOrders />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/orders/:orderId"
                element={
                  <RequireAuth>
                    <ShopOrderDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/orders/:orderId/tracking"
                element={
                  <RequireAuth>
                    <ShopTracking />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/velrepeat"
                element={
                  <RequireAuth>
                    <VelRepeatPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/wishlist"
                element={
                  <RequireAuth>
                    <ShopWishlist />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/addresses"
                element={
                  <RequireAuth>
                    <ShopAddresses />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/profile"
                element={
                  <RequireAuth>
                    <ShopProfile />
                  </RequireAuth>
                }
              />
              <Route
                path="/shop/notifications"
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
        </CartProvider>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
