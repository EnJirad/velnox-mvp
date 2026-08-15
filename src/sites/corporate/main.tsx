/**
 * VELNOX GROUP — Corporate website (velnox.com)
 *
 * Public, content-only entry. Deliberately has NO Convex client, NO auth and
 * NO dashboard code — corporate is the company face of the ecosystem and
 * links out to the real apps (VelShop / VelSeller / VelCenter) via SITE_URLS.
 *
 * Deploy independently:  bun run build:corporate  (see vite.config.corporate.ts)
 */
import {
  RootErrorBoundary,
  RouteSyncer,
  SiteSuspense,
} from "@/lib/app-shell";
import { siteBasename } from "@/lib/sites";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "../../index.css";
import { Contact } from "@/pages/corporate/Contact";
import { CorporateHome } from "@/pages/corporate/CorporateHome";
import { CorporateLayout } from "@/pages/corporate/CorporateLayout";
import { StaticPage } from "@/pages/corporate/StaticPage";

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <BrowserRouter basename={siteBasename("corporate")}>
      <RouteSyncer />
      <SiteSuspense>
        <Routes>
          <Route element={<CorporateLayout />}>
            <Route path="/" element={<CorporateHome />} />
            <Route path="/about" element={<StaticPage page="about" />} />
            <Route path="/vision" element={<StaticPage page="vision" />} />
            <Route path="/business" element={<StaticPage page="business" />} />
            <Route path="/ecosystem" element={<StaticPage page="ecosystem" />} />
            <Route path="/technology" element={<StaticPage page="technology" />} />
            <Route path="/careers" element={<StaticPage page="careers" />} />
            <Route path="/news" element={<StaticPage page="news" />} />
            <Route path="/privacy" element={<StaticPage page="privacy" />} />
            <Route path="/terms" element={<StaticPage page="terms" />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SiteSuspense>
    </BrowserRouter>
  </RootErrorBoundary>,
);
