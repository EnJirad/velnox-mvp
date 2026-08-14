import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { CartProvider } from "@/lib/cart";
import { RequireRole } from "@/components/RequireRole";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Reorder = lazy(() => import("./pages/Reorder.tsx"));
const SellerOrders = lazy(() => import("./pages/SellerOrders.tsx"));
const ShopHome = lazy(() => import("./pages/ShopHome.tsx"));
const ShopCheckout = lazy(() => import("./pages/ShopCheckout.tsx"));
const MyOrders = lazy(() => import("./pages/MyOrders.tsx"));
const Center = lazy(() => import("./pages/Center.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <CartProvider>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<AuthPage />} />

                {/* velshop — customer storefront (browse public, checkout auth) */}
                <Route path="/shop" element={<ShopHome />} />
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

                {/* velseller — owner tools (seller or admin) */}
                <Route path="/seller" element={<Navigate to="/seller/goals" replace />} />
                <Route
                  path="/seller/goals"
                  element={
                    <RequireRole role="seller">
                      <Dashboard />
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

                {/* velcenter — admin / control center */}
                <Route
                  path="/center"
                  element={
                    <RequireRole role="admin">
                      <Center />
                    </RequireRole>
                  }
                />

                {/* legacy paths redirect to the new site namespaces */}
                <Route path="/dashboard" element={<Navigate to="/seller/goals" replace />} />
                <Route path="/reorder" element={<Navigate to="/seller/reorder" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CartProvider>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
