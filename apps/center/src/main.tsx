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
import { IdentityMerge } from "@velnox/shared/lib/track";
import { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "../../../packages/shared/src/index.css";
import { initMonitoring } from "@velnox/shared/lib/monitoring";

initMonitoring();

const Center = lazy(() => import("@/pages/Center"));
const AuthPage = lazy(() => import("@velnox/shared/pages/Auth"));
const NotFound = lazy(() => import("@velnox/shared/pages/NotFound"));

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <IdentityMerge />
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
