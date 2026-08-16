import { Toaster } from "@velnox/shared/components/ui/sonner";
import { RequireRole } from "@velnox/shared/components/RequireRole";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@velnox/shared/lib/app-shell";
import { siteBasename } from "@velnox/shared/lib/sites";
import { MobileTabBar, type MobileTabItem } from "@velnox/shared/components/MobileTabBar";
import { IdentityMerge } from "@velnox/shared/lib/track";
import { RefreshCw, ShoppingBag, Store, Target, Wallet } from "lucide-react";
import { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "../../../packages/shared/src/index.css";
import { initMonitoring } from "@velnox/shared/lib/monitoring";

/** App-like bottom navigation for mobile (velseller). */
const SELLER_TABS: MobileTabItem[] = [
  { to: "/seller/goals", label: "เป้าหมาย", icon: Target },
  { to: "/seller/shop", label: "ร้านของฉัน", icon: Store },
  { to: "/seller/orders", label: "ออเดอร์", icon: ShoppingBag },
  { to: "/seller/income", label: "รายได้", icon: Wallet },
  { to: "/seller/reorder", label: "สั่งซื้อซ้ำ", icon: RefreshCw },
];

initMonitoring();

const SellerGoals = lazy(() => import("@/pages/SellerGoals"));
const MyShop = lazy(() => import("@/pages/MyShop"));
const Reorder = lazy(() => import("@/pages/Reorder"));
const SellerOrders = lazy(() => import("@/pages/SellerOrders"));
const Income = lazy(() => import("@/pages/Income"));
const AuthPage = lazy(() => import("@velnox/shared/pages/Auth"));
const NotFound = lazy(() => import("@velnox/shared/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <IdentityMerge />
      <BrowserRouter basename={siteBasename("velseller")}>
        <RouteSyncer />
        <div className="site-app">
        <SiteSuspense>
          <Routes>
            <Route path="/" element={<Navigate to="/seller/goals" replace />} />
            <Route
              path="/seller/goals"
              element={
                <RequireRole role="seller">
                  <SellerGoals />
                </RequireRole>
              }
            />
            <Route
              path="/seller/shop"
              element={
                <RequireRole role="seller">
                  <MyShop />
                </RequireRole>
              }
            />
            <Route
              path="/seller/reorder"
              element={
                <RequireRole role="seller">
                  <Reorder />
                </RequireRole>
              }
            />
            <Route
              path="/seller/orders"
              element={
                <RequireRole role="seller">
                  <SellerOrders />
                </RequireRole>
              }
            />
            <Route
              path="/seller/income"
              element={
                <RequireRole role="seller">
                  <Income />
                </RequireRole>
              }
            />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SiteSuspense>
        <MobileTabBar items={SELLER_TABS} />
        </div>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
