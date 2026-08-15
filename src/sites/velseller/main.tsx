import { Toaster } from "@/components/ui/sonner";
import { RequireRole } from "@/components/RequireRole";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@/lib/app-shell";
import { siteBasename } from "@/lib/sites";
import { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "../../index.css";
import { initMonitoring } from "@/lib/monitoring";

initMonitoring();

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const MyShop = lazy(() => import("@/pages/MyShop"));
const Reorder = lazy(() => import("@/pages/Reorder"));
const SellerOrders = lazy(() => import("@/pages/SellerOrders"));
const Income = lazy(() => import("@/pages/Income"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter basename={siteBasename("velseller")}>
        <RouteSyncer />
        <SiteSuspense>
          <Routes>
            <Route path="/" element={<Navigate to="/seller/goals" replace />} />
            <Route
              path="/seller/goals"
              element={
                <RequireRole role="seller">
                  <Dashboard />
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
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
