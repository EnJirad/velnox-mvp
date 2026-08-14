import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@/lib/app-shell";
import { SITE_URLS } from "@/lib/sites";
import React, { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <ToolbarErrorBoundary>
      <VlyToolbar />
    </ToolbarErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <RouteSyncer />
        <SiteSuspense>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* The 3 sites are SEPARATE deployable entries (velshop.html,
                velseller.html, velcenter.html) sharing one Convex backend.
                Old single-app paths redirect to the right site entry. */}
            <Route path="/shop/*" element={<Navigate to={SITE_URLS.velshop} replace />} />
            <Route path="/seller/*" element={<Navigate to={SITE_URLS.velseller} replace />} />
            <Route path="/center/*" element={<Navigate to={SITE_URLS.velcenter} replace />} />
            <Route path="/dashboard/*" element={<Navigate to={SITE_URLS.velseller} replace />} />
            <Route path="/reorder/*" element={<Navigate to={SITE_URLS.velseller} replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </SiteSuspense>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
