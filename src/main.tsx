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
import React, { lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
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

/**
 * The 3 sites are SEPARATE apps (velshop.html / velseller.html / velcenter.html).
 * Client-side <Navigate> can't switch apps — it would just re-render this router
 * against a path it doesn't know. These redirects must load the other document.
 */
function HardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

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
                Old single-app paths hard-redirect to the right site entry. */}
            <Route path="/shop/*" element={<HardRedirect to={SITE_URLS.velshop} />} />
            <Route path="/seller/*" element={<HardRedirect to={SITE_URLS.velseller} />} />
            <Route path="/center/*" element={<HardRedirect to={SITE_URLS.velcenter} />} />
            <Route path="/dashboard/*" element={<HardRedirect to={SITE_URLS.velseller} />} />
            <Route path="/reorder/*" element={<HardRedirect to={SITE_URLS.velseller} />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </SiteSuspense>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  </RootErrorBoundary>,
);
