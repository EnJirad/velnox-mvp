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
import { BrowserRouter, Route, Routes } from "react-router";
import "../../index.css";
import { initMonitoring } from "@/lib/monitoring";

initMonitoring();

const Center = lazy(() => import("@/pages/Center"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter basename={siteBasename("velcenter")}>
        <RouteSyncer />
        <div className="site-app">
        <SiteSuspense>
          <Routes>
            <Route
              path="/"
              element={
                <RequireRole role="center">
                  <Center />
                </RequireRole>
              }
            />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SiteSuspense>
        </div>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
